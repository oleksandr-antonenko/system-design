import { Option } from 'effect'

import { type SimResult, simulationRules } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('uk', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`
const p95 = (sim: SimResult) =>
  Option.match(sim.p95, { onNone: () => '—', onSome: ms => `${n(ms)} мс` })
const incoming = (sim: SimResult, id: string) => sim.nodes[id]?.incoming ?? 0
const utilization = (sim: SimResult, id: string) =>
  sim.nodes[id]?.utilization ?? 0
const { writeShare, cacheHitShare, cacheHitMs } = simulationRules
// Запись не кешируется: вся она идёт в базу, остальное в базе — чтения мимо кеша.
const writes = (sim: SimResult) =>
  Math.min(sim.databaseLoad, sim.load * writeShare)
const missedReads = (sim: SimResult) => sim.databaseLoad - writes(sim)

const LOAD = 1600
const quizWrites = LOAD * writeShare
const quizReads = LOAD - quizWrites
const quizMisses = quizReads * (1 - cacheHitShare)

export default {
  title: 'Cache. Швидкі відповіді з пам’яті',
  summary: 'Cache-aside, hit rate і TTL: як зняти навантаження з database.',
  preview: {
    alt: 'Схема: cache поруч із server відповідає на більшість читань із пам’яті, а в database ідуть лише запити при cache miss, тож вона майже вільна.',
  },
  steps: {
    'five-servers': {
      title: 'П’ять блоків «Server», одна database',
      body: `Інтернет-магазин з уроку 3 виріс. [[users|Users]] приходять через [[lb|load balancer]] на п’ять блоків «Server», від [[app1|app1]] до [[app5|app5]], і всі вони працюють з однією [[db|database]]. Зараз надходить 1200 rps.

Кожному server дістається по 240 rps — 60% його потужності. А database доводиться важче: до неї сходяться запити від усіх блоків «Server», тому вона отримує всі 1200 rps із 1500 можливих. Це 80%, найзавантаженіший блок на дошці.`,
    },
    'db-overload': {
      title: 'Database захлинається',
      body: `Почався святковий розпродаж, і навантаження зросло до **1600 rps**. Блоки «Server» дають раду: кожен [[app3|server]] отримує 320 rps, це 80% потужності. А [[db|database]] отримує всі 1600 rps і встигає обробити лише 1500. Решта 100 губляться: це червоні точки на зв’язках до database, близько 6% помилок. Запити, що пройшли, чекають у черзі, і p95 підскочив понад пів секунди.

Шостий server не допоможе. Блокам «Server» стане легше, але database і далі отримуватиме ті самі 1600 rps. Вузьке місце тепер не в блоках «Server», а за ними.`,
    },
    'reads-and-writes': {
      title: 'Читання і запис',
      body: `Погляньмо, про що блоки «Server» питають database. Більшість запитів лише **читають** (read): відкрити товар, показати каталог, перевірити залишок. І тільки небагато **записують** (write): оформити замовлення, залишити відгук. У цьому курсі ${percent(1 - writeShare)} запитів — читання і ${percent(writeShare)} — запис, тож із 1600 rps на читання припадає 1280.

І читання повторюються. Головну сторінку й сотню популярних товарів відкривають тисячі людей, і щоразу database заново шукає ті самі рядки. Якщо запам’ятати відповідь на популярний запит, питати database вдруге не треба.

Така пам’ять — це **Cache** (українською — кеш): сховище, яке тримає дані в оперативній пам’яті, наприклад Redis або Memcached. Читання з cache триває ${cacheHitMs} мс. Частку читань, на які cache відповідає сам, називають **hit rate** (частка влучань, від cache hit — влучання); у цьому курсі вона становить ${percent(cacheHitShare)}. Решта читань — промахи, або **cache miss**: вони йдуть далі до database.`,
    },
    'place-cache': {
      title: 'Задача: cache',
      body: `Поставте cache між блоками «Server» і [[db|database]]. Блоки «Server» надсилають читання в cache: кожен hit він обслуговує сам, а кожен miss передає database.

Зв’язок кожного server із database залиште: запис іде лише туди. У cache лежать копії, а оригінали зберігаються в database. Блок «Cache» уже є в палітрі.`,
    },
    'stale-data': {
      title: 'Застарілі дані',
      body: ({ sim }) =>
        `[[db|Database]] зітхнула вільніше: тепер вона отримує ${n(sim.databaseLoad)} rps замість 1600. З них ${n(writes(sim))} — запис. Із ним cache не допомагає: кожен запис і далі йде в database. Решта ${n(missedReads(sim))} — читання, яких не знайшлося в cache. p95 упав до ${p95(sim)}.

Як дані потрапляють у cache? Зазвичай цим займається server: спершу питає cache, а в разі miss читає з database й кладе відповідь у cache. Такий підхід називається **cache-aside**. На дошці [[cache-1|cache]] сам ходить до database (read-through), але для database різниці немає.

За cache доводиться платити **застарілими даними** (stale data). Ціна товару в database змінилася, а cache і далі віддає стару. Один захист — **TTL** (time to live, час життя): кожен ключ живе в cache, скажімо, 60 секунд і зникає, а наступне читання бере свіже значення з database. Інший — **інвалідація** (invalidation): під час запису server одразу видаляє ключ із cache. TTL простий, але лишає вікно застарілих даних; інвалідація точніша, але її легко забути в одному з місць, де відбувається запис. Зазвичай їх поєднують.`,
    },
    'cache-down': {
      title: 'Якщо cache упав',
      body: ({ sim }) =>
        `[[cache-1|Cache]] упав. ${
          sim.errorRate > 0.01
            ? `Блоки «Server» знову надсилають читання просто в [[db|database]]. Вона отримує ${n(sim.databaseLoad)} rps, і ${percent(sim.errorRate)} запитів губляться, як до появи cache.`
            : `На вашій дошці читання підхопив інший cache, тому [[db|database]] тримається: ${n(sim.databaseLoad)} rps. З одним cache вона знову отримала б 1600 rps і помилки.`
        }

У cache лежать лише копії, але без нього система вже не живе. Небезпечний навіть перезапуск: cache повертається порожнім, або **холодним** (cold), і певний час кожне читання — miss. Тому cache запускають на кількох вузлах і прогрівають (warm-up), перш ніж пустити на нього трафік, а навантаження, яке database отримає без cache, завжди тримають у голові.`,
    },
    summary: {
      title: 'Підсумок',
      body: ({ sim }) =>
        `Cache знову працює. Він знімає з database повторювані читання: за hit rate ${percent(cacheHitShare)} до неї доходить лише ${percent(1 - cacheHitShare)} читань. Навантаження на database впало з 1600 до ${n(sim.databaseLoad)} rps, а cache коштує 0,15 $ на годину.

Кешуйте те, що часто читають і рідко змінюють. Задавайте ключам TTL і видаляйте їх із cache, коли дані змінюються. Пам’ятайте, що запис і далі йде в database, а без cache вона знову перевантажена.

Тепер найзавантаженіші блоки — server, як-от [[app3|app3]], на 80%. Чимала частина їхньої роботи — зовсім не логіка магазину, а зображення, скрипти та стилі, однакові для всіх відвідувачів. В уроці 5 їх забере **CDN** (Content Delivery Network, українською — мережа доставки контенту: вузли по всьому світу, які роздають такі файли).`,
    },
  },
  annotations: {
    dbLoad: sim => `${n(incoming(sim, 'db'))} rps із ${n(1500)} можливих`,
    dbOverload: sim =>
      `завантаження ${percent(utilization(sim, 'db'))} · помилки ${percent(sim.errorRate)}`,
    serverCalm: sim => `${n(incoming(sim, 'app3'))} rps із 400 · дає раду`,
    readsWrites: sim =>
      `читання ${n(incoming(sim, 'db') * (1 - writeShare))} · запис ${n(incoming(sim, 'db') * writeShare)}`,
    cacheHits: sim =>
      `hit ${n(incoming(sim, 'cache-1') * cacheHitShare)} із ${n(incoming(sim, 'cache-1'))} rps`,
    dbAfter: sim => `запис ${n(writes(sim))} + miss ${n(missedReads(sim))} rps`,
    serversNext: sim =>
      `${n(incoming(sim, 'app3'))} rps із 400 · ${percent(utilization(sim, 'app3'))}`,
  },
  quizzes: {
    'db-after-cache': {
      question: `Cache сам відповідає на ${percent(cacheHitShare)} читань. Скільки запитів на секунду дійде до database при ${n(LOAD)} rps, коли cache стане на місце?`,
      options: {
        unchanged: `${n(LOAD)} rps — стільки ж`,
        'all-reads': `${n(quizReads)} rps`,
        'writes-and-misses': `${n(quizWrites + quizMisses)} rps`,
        misses: `${n(quizMisses)} rps`,
      },
      wrong: {
        unchanged:
          'Cache забирає собі читання, на які знає відповідь: до database доходить помітно менше.',
        'all-reads': `${n(quizReads)} — це всі читання. Але ${percent(cacheHitShare)} з них cache віддасть сам, у database підуть лише cache miss.`,
        misses: `${n(quizMisses)} — це лише cache miss. Запис іде в database повз cache: ще ${n(quizWrites)} rps.`,
      },
      explain: `До database дійдуть усі записи — ${percent(writeShare)} від ${n(LOAD)}, це ${n(quizWrites)} rps, — і cache miss: ${percent(1 - cacheHitShare)} від ${n(quizReads)} читань, це ${n(quizMisses)} rps. Разом ${n(quizWrites + quizMisses)} rps із 1500 можливих: database видихне. Перевірте це в задачі.`,
    },
  },
  tasks: {
    'place-cache': {
      prompt:
        'Зніміть читання з database: поставте cache між блоками «Server» і database.',
      goals: {
        'cache-exists': 'На дошці є блок «Cache»',
        'servers-use-cache': 'Блоки «Server» підключені до cache',
        'cache-backed-by-db': 'Cache підключений до database',
        'db-relieved': 'Database завантажена не більше ніж на 60% при 1600 rps',
        'holds-load': 'Витримує 1600 rps з помилками менше 1%',
      },
      hints: [
        'Більшість запитів до database — повторювані читання. Відповіді на них можна тримати ближче, у швидкій пам’яті.',
        'Поставте cache між блоками «Server» і database. Підключіть до нього кожен server, а сам cache — до database, для cache miss. Зв’язків server із database не видаляйте: ними йде запис.',
        'На дошці з’явився пунктирний контур. Поставте cache туди й проведіть позначені зв’язки: від кожного з п’яти server до cache і від cache до database.',
      ],
      solvedNote:
        'Чотири читання з п’яти тепер обслуговує cache, і в database з’явився запас.',
    },
  },
} satisfies LessonTexts<typeof lesson>
