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
const dropped = (sim: SimResult, id: string) => sim.nodes[id]?.dropped ?? 0
const utilization = (sim: SimResult, id: string) =>
  sim.nodes[id]?.utilization ?? 0
const { writeShare, cacheHitShare, cacheHitMs } = simulationRules
// Запись не кешируется: вся она идёт в базу, остальное в базе — чтения мимо кеша.
const writes = (sim: SimResult) =>
  Math.min(sim.databaseLoad, sim.load * writeShare)
const missedReads = (sim: SimResult) => sim.databaseLoad - writes(sim)
// Чтение в кеш: в cache-aside по связям сервер → кеш идёт ещё и заполнение.
const cacheReads = (sim: SimResult) => sim.load * (1 - writeShare)

const LOAD = 1600
const quizWrites = LOAD * writeShare
const quizReads = LOAD - quizWrites
const quizMisses = quizReads * (1 - cacheHitShare)

export default {
  title: 'Cache. Швидкі відповіді з пам’яті',
  summary:
    'Cache-aside і read-through, hit rate і TTL: як зняти навантаження з database.',
  preview: {
    alt: 'Схема: cache поруч із server відповідає на більшість читань із пам’яті, а в database ідуть лише запити при cache miss, тож вона майже вільна.',
  },
  steps: {
    'five-servers': {
      title: 'П’ять блоків «Server», одна database',
      body: `Інтернет-магазин з уроку 3 виріс. [[users|Users]] приходять через [[lb|load balancer]] на п’ять блоків «Server», від [[app1|app1]] до [[app5|app5]], і всі вони працюють з однією [[db|database]]. Зараз надходить 1200 rps.

Кожному server дістається по 240 rps — 60% його потужності. А database доводиться важче: до неї сходяться запити від усіх блоків «Server», тому вона отримує всі 1200 rps із 1500 можливих. Це 80%, найзавантаженіший блок на дошці. Підписи на зв’язках кажуть, що ними йде: кожен server надсилає в database і читання, і запис.`,
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
    'two-patterns': {
      title: 'Хто читає database при miss',
      body: `У cache лежать копії, а оригінали зберігаються в [[db|database]]. При miss хтось має взяти значення з database і покласти його в cache. Поширені дві відповіді, і на дошці вони малюються по-різному.

**Cache-aside** (українською — «кеш збоку»): усе робить сам [[app3|server]]. Він питає cache; при miss читає database, відповідає користувачеві й кладе значення в cache, щоб наступне читання стало hit. Cache про database нічого не знає. Це найпоширеніший підхід: Redis або Memcached поруч із застосунком, і код застосунку вирішує, що кешувати.

**Read-through** (українською — «читання крізь кеш»): server питає тільки cache. При miss cache сам читає database, зберігає копію й відповідає. Так працюють бібліотеки кешування та кешувальні проксі перед database: код застосунку простіший, але cache має знати дорогу до database.

Хто йде в database при miss:
- cache-aside — server. Зв’язки: server → cache несе читання й заповнення, server → database — запис і промахи;
- read-through — cache. Зв’язки: server → cache несе читання, cache → database — промахи, server → database — лише запис.

Запис в обох підходах іде в database через server: cache пришвидшує тільки читання.`,
    },
    'cache-aside': {
      title: 'Задача: cache-aside',
      body: `Почнімо з cache-aside. Поставте cache поруч із блоками «Server» і підключіть до нього кожен server: читання спершу йде туди. Зв’язок кожного server із [[db|database]] залиште: ним ідуть запис і промахи.

Сам cache до database не підключається: дошка навіть не дасть провести такий зв’язок, адже в cache-aside database читає server. Блок «Cache» уже є в палітрі, а мітка на блоці показує його режим.`,
    },
    'aside-result': {
      title: 'Cache-aside на дошці',
      body: ({ sim }) =>
        `[[db|Database]] зітхнула вільніше: тепер вона отримує ${n(sim.databaseLoad)} rps замість 1600. З них ${n(writes(sim))} — запис, із ним cache не допомагає. Решта ${n(missedReads(sim))} — промахи, які блоки «Server» прочитали з database самі. p95 упав до ${p95(sim)}.

Погляньте на підписи. Кожен зв’язок server → [[cache-1|cache]] несе читання (${n(cacheReads(sim))} rps на всі блоки «Server») і після кожного miss — заповнення: значення, яке server щойно прочитав із database. Кожен зв’язок server → database несе запис і промахи. Чотири читання з п’яти — hit, до database вони не доходять.`,
    },
    'read-through': {
      title: 'Задача: read-through',
      body: `Тепер перемкнімо ту саму дошку на read-through: віднині блоки «Server» питають тільки [[cache-1|cache]], а при miss database має читати сам cache. Але зв’язку з database у нього немає, і промахам нікуди йти: губиться ${n(quizMisses)} rps, ${percent(quizMisses / LOAD)} помилок.

Дайте cache власну дорогу до [[db|database]]. Зв’язки блоків «Server» із database лишаються: ними й далі йде запис, а промахи переходять на новий зв’язок.`,
    },
    compare: {
      title: 'Навантаження те саме, ролі різні',
      body: ({ sim }) =>
        `Database знову отримує ${n(sim.databaseLoad)} rps — рівно стільки, скільки за cache-aside: запис плюс промахи. Для database обидва підходи однакові. Різниця в тому, хто знає до неї дорогу.

У cache-aside server знає і cache, і database, а cache — просто швидке сховище поруч. У read-through server знає тільки cache, а шлях до database належить cache.`,
    },
    'stale-data': {
      title: 'Застарілі дані',
      body: `За cache доводиться платити **застарілими даними** (stale data). Ціна товару в database змінилася, а [[cache-1|cache]] і далі віддає стару — за будь-якого з двох підходів.

Один захист — **TTL** (time to live, час життя): кожен ключ живе в cache, скажімо, 60 секунд і зникає, а наступне читання стає miss і бере свіже значення з database. Інший — **інвалідація** (invalidation): під час запису server одразу видаляє ключ із cache. TTL простий, але лишає вікно застарілих даних; інвалідація точніша, але її легко забути в одному з місць, де відбувається запис. Зазвичай їх поєднують.`,
    },
    'cache-down': {
      title: 'Якщо cache упав',
      body: ({ sim }) =>
        `[[cache-1|Cache]] упав. ${
          sim.errorRate > 0.01
            ? `На дошці блоки «Server» надсилають читання просто в [[db|database]]. Вона отримує ${n(sim.databaseLoad)} rps, і ${percent(sim.errorRate)} запитів губляться, як до появи cache.`
            : `На вашій дошці читання підхопив інший cache, тому [[db|database]] тримається: ${n(sim.databaseLoad)} rps. З одним cache вона знову отримала б 1600 rps і помилки.`
        }

Для cache-aside звернутися до database — природно: для server кожне читання просто стає miss. Для read-through це окремий код, запасний шлях, який команді треба написати й перевірити, інакше читання падають. У будь-якому разі в cache лежать лише копії, але без нього система вже не живе. Небезпечний навіть перезапуск: cache повертається порожнім, або **холодним** (cold), і певний час кожне читання — miss. Тому cache запускають на кількох вузлах і прогрівають (warm-up), перш ніж пустити на нього трафік, а навантаження, яке database отримає без cache, завжди тримають у голові.`,
    },
    summary: {
      title: 'Підсумок',
      body: ({ sim }) =>
        `Cache знову працює. Він знімає з database повторювані читання: за hit rate ${percent(cacheHitShare)} до неї доходить лише ${percent(1 - cacheHitShare)} читань. Навантаження на database впало з 1600 до ${n(sim.databaseLoad)} rps, а cache коштує 0,15 $ на годину.

- Cache-aside: при miss database читає server і заповнює cache. Найпоширеніший підхід, і відмову cache він переживає сам.
- Read-through: при miss database читає cache. Код застосунку простіший, але cache потрібен власний зв’язок із database.

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
      `hit ${n(cacheReads(sim) * cacheHitShare)} із ${n(cacheReads(sim))} читань`,
    dbAfter: sim => `запис ${n(writes(sim))} + miss ${n(missedReads(sim))} rps`,
    missesLost: sim =>
      dropped(sim, 'cache-1') >= 1
        ? `промахи губляться: ${n(dropped(sim, 'cache-1'))} rps`
        : 'промахи доходять до database',
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
      explain: `До database дійдуть усі записи — ${percent(writeShare)} від ${n(LOAD)}, це ${n(quizWrites)} rps, — і cache miss: ${percent(1 - cacheHitShare)} від ${n(quizReads)} читань, це ${n(quizMisses)} rps. Разом ${n(quizWrites + quizMisses)} rps із 1500 можливих: database видихне. Перевірте це в задачах.`,
    },
    'cache-down-pattern': {
      question:
        'Cache упав. За якого підходу застосунок і далі відповідатиме на читання з database без додаткового коду?',
      options: {
        'cache-aside': 'Cache-aside',
        'read-through': 'Read-through',
        both: 'За обох: database ж на місці',
        neither: 'За жодного: читання падають, доки cache не повернеться',
      },
      wrong: {
        'read-through':
          'У read-through server знає тільки cache: шлях до database належить cache. Без окремого запасного шляху читання падають.',
        both: 'Database на місці, але в read-through у server немає до неї шляху для читання: цей шлях належить cache.',
        neither:
          'У cache-aside server і так читає database при кожному miss. Коли cache упав, кожне читання просто стає miss.',
      },
      explain:
        'У cache-aside server і так читає database при кожному miss, тому cache, що впав, просто перетворює кожне читання на miss: повільніше, і database отримує все навантаження, але читання обслуговуються. У read-through server говорить лише з cache, тож команді треба написати запасний шлях до database, інакше читання падають. На цій дошці блоки «Server» звертаються до database самі, ніби такий шлях уже написано.',
    },
  },
  tasks: {
    'cache-aside': {
      prompt:
        'Зніміть читання з database за схемою cache-aside: блоки «Server» питають cache, а при miss читають database самі.',
      goals: {
        'cache-exists': 'На дошці є блок «Cache»',
        'servers-use-cache': 'Блоки «Server» підключені до cache',
        'no-cache-db':
          'У cache немає зв’язку з database: при miss її читають блоки «Server»',
        'db-relieved': 'Database завантажена не більше ніж на 45% при 1600 rps',
        'holds-load': 'Витримує 1600 rps з помилками менше 1%',
      },
      hints: [
        'Більшість запитів до database — повторювані читання. Відповіді на них можна тримати ближче, у швидкій пам’яті, і питати її першою.',
        'Поставте cache й підключіть до нього кожен із п’яти блоків «Server». Зв’язків блоків «Server» із database не видаляйте: ними йдуть запис і промахи. Сам cache лишається без зв’язку з database.',
        'На дошці з’явився пунктирний контур. Поставте cache туди й проведіть позначені зв’язки: від кожного з п’яти блоків «Server» до cache.',
      ],
      solvedNote:
        'Чотири читання з п’яти тепер обслуговує cache; решту блоки «Server» читають із database і заповнюють cache.',
    },
    'read-through': {
      prompt:
        'У read-through при miss database читає сам cache: дайте йому дорогу до database.',
      goals: {
        'cache-reads-db': 'Cache підключений до database',
        'db-relieved': 'Database завантажена не більше ніж на 45% при 1600 rps',
        'holds-load': 'Витримує 1600 rps з помилками менше 1%',
      },
      hints: [
        'Промахи тепер турбота cache, а надіслати їх йому нікуди.',
        'Проведіть зв’язок від cache до database. Зв’язки блоків «Server» із database лишаються: ними йде запис.',
        'На дошці з’явилася пунктирна лінія: проведіть зв’язок від cache до database.',
      ],
      solvedNote:
        'Промахи тепер ідуть від cache до database, а блоки «Server» надсилають їй лише запис.',
    },
  },
} satisfies LessonTexts<typeof lesson>
