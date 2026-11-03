import { Option } from 'effect'

import { type SimResult, simulationRules } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('ru', Math.round(value))
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
  title: 'Cache. Быстрые ответы из памяти',
  summary:
    'Cache-aside и read-through, hit rate и TTL: как снять нагрузку с database.',
  preview: {
    alt: 'Схема: cache рядом с server отвечает на большинство чтений из памяти, а в database уходят только запросы при cache miss, и она почти свободна.',
  },
  steps: {
    'five-servers': {
      title: 'Пять блоков «Server», одна database',
      body: `Интернет-магазин из урока 3 вырос. [[users|Users]] приходят через [[lb|load balancer]] на пять блоков «Server», от [[app1|app1]] до [[app5|app5]], и все они работают с одной [[db|database]]. Сейчас приходит 1200 rps.

Каждому server достаётся по 240 rps — 60% его мощности. Database тяжелее: в неё сходятся запросы от всех блоков «Server», поэтому она получает все 1200 rps из 1500 возможных. Это 80%, самый загруженный блок на доске. Подписи на связях говорят, что по ним идёт: каждый server шлёт в database и чтение, и запись.`,
    },
    'db-overload': {
      title: 'Database захлёбывается',
      body: `Началась праздничная распродажа, и нагрузка выросла до **1600 rps**. Блоки «Server» справляются: [[app3|каждый из них]] получает 320 rps, это 80% мощности. А [[db|database]] получает все 1600 rps и успевает обработать только 1500. Остальные 100 теряются: это красные точки на связях к database, около 6% ошибок. Прошедшие запросы ждут в очереди, и p95 подскочил выше полусекунды.

Шестой server не поможет. Блокам «Server» станет легче, но database по-прежнему получит те же 1600 rps. Узкое место теперь не в блоках «Server», а за ними.`,
    },
    'reads-and-writes': {
      title: 'Чтение и запись',
      body: `Посмотрим, о чём блоки «Server» спрашивают database. Большинство запросов только **читают** (read): открыть товар, показать каталог, проверить остаток. И лишь немногие **пишут** (write): оформить заказ, оставить отзыв. В этом курсе ${percent(1 - writeShare)} запросов — чтение и ${percent(writeShare)} — запись, так что из 1600 rps на чтение приходится 1280.

И чтения повторяются. Главную страницу и сотню популярных товаров открывают тысячи людей, и каждый раз database заново ищет одни и те же строки. Если запомнить ответ на популярный запрос, второй раз спрашивать database не нужно.

Для этого нужна быстрая память. **Cache** (по-русски — кеш) — хранилище, которое держит данные в оперативной памяти, например Redis или Memcached. Чтение из cache занимает ${cacheHitMs} мс. Если cache знает ответ, это **cache hit** (попадание), если нет — **cache miss** (промах), и такое чтение идёт дальше в database. Долю чтений, на которые cache отвечает сам, называют **hit rate**; в этом курсе она ${percent(cacheHitShare)}.`,
    },
    'two-patterns': {
      title: 'Кто читает database при miss',
      body: `В cache лежат копии, а оригиналы хранятся в [[db|database]]. При miss кто-то должен взять значение из database и положить его в cache. Распространены два ответа, и на доске они рисуются по-разному.

**Cache-aside** (по-русски — «кеш сбоку»): всё делает сам [[app3|server]]. Он спрашивает cache; при miss читает database, отвечает пользователю и кладёт значение в cache, чтобы следующее чтение стало hit. Cache о database ничего не знает. Это самый распространённый подход: Redis или Memcached рядом с приложением, и код приложения решает, что кешировать.

**Read-through** (по-русски — «чтение через кеш»): server спрашивает только cache. При miss cache сам читает database, сохраняет копию и отвечает. Так работают библиотеки кеширования и кеширующие прокси перед database: код приложения проще, но cache должен знать дорогу к database.

Кто идёт в database при miss:
- cache-aside — server. Связи: server → cache несёт чтение и заполнение, server → database — запись и промахи;
- read-through — cache. Связи: server → cache несёт чтение, cache → database — промахи, server → database — только запись.

Запись в обоих подходах идёт в database через server: cache ускоряет только чтение.`,
    },
    'cache-aside': {
      title: 'Задача: cache-aside',
      body: `Начнём с cache-aside. Поставьте cache рядом с блоками «Server» и подключите к нему каждый server: чтение сначала идёт туда. Связь каждого server с [[db|database]] оставьте: по ней идут запись и промахи.

Сам cache к database не подключается: доска даже не даст провести такую связь, ведь в cache-aside database читает server. Блок «Cache» уже есть в палитре, а метка на блоке показывает его режим.`,
    },
    'aside-result': {
      title: 'Cache-aside на доске',
      body: ({ sim }) =>
        `[[db|Database]] вздохнула свободно: теперь она получает ${n(sim.databaseLoad)} rps вместо 1600. Из них ${n(writes(sim))} — запись, с ней cache не помогает. Остальные ${n(missedReads(sim))} — промахи, которые блоки «Server» прочитали из database сами. p95 упал до ${p95(sim)}.

Посмотрите на подписи. Каждая связь server → [[cache-1|cache]] несёт чтение (${n(cacheReads(sim))} rps на все блоки «Server») и после каждого miss — заполнение: значение, которое server только что прочитал из database. Каждая связь server → database несёт запись и промахи. Четыре чтения из пяти — hit, до database они не доходят.`,
    },
    'read-through': {
      title: 'Задача: read-through',
      body: `Теперь переключим ту же доску на read-through: отныне блоки «Server» спрашивают только [[cache-1|cache]], а при miss database должен читать сам cache. Но связи с database у него нет, и промахам некуда идти: теряется ${n(quizMisses)} rps, ${percent(quizMisses / LOAD)} ошибок.

Дайте cache свою дорогу к [[db|database]]. Связи блоков «Server» с database остаются: по ним по-прежнему идёт запись, а промахи переходят на новую связь.`,
    },
    compare: {
      title: 'Нагрузка та же, роли разные',
      body: ({ sim }) =>
        `Database снова получает ${n(sim.databaseLoad)} rps — ровно столько же, сколько при cache-aside: запись плюс промахи. Для database оба подхода одинаковы. Разница в том, кто знает к ней дорогу.

В cache-aside server знает и cache, и database, а cache — просто быстрое хранилище рядом. В read-through server знает только cache, а путь к database принадлежит cache.`,
    },
    'stale-data': {
      title: 'Устаревшие данные',
      body: `За cache приходится платить **устаревшими данными** (stale data). Цена товара в database изменилась, а [[cache-1|cache]] всё ещё отдаёт старую — при любом из двух подходов.

Одна защита — **TTL** (time to live, время жизни): каждый ключ живёт в cache, скажем, 60 секунд и исчезает, а следующее чтение становится miss и берёт свежее значение из database. Другая — **инвалидация** (invalidation): при записи server сразу удаляет ключ из cache. TTL прост, но оставляет окно устаревших данных; инвалидация точнее, но её легко забыть в одном из мест, где идёт запись. Обычно их сочетают.`,
    },
    'cache-down': {
      title: 'Если cache упал',
      body: ({ sim }) =>
        `[[cache-1|Cache]] упал. ${
          sim.errorRate > 0.01
            ? `На доске блоки «Server» отправляют чтения прямо в [[db|database]]. Она получает ${n(sim.databaseLoad)} rps, и ${percent(sim.errorRate)} запросов теряются, как до cache.`
            : `На вашей доске чтения подхватил другой cache, поэтому [[db|database]] держится: ${n(sim.databaseLoad)} rps. С одним cache она снова получила бы 1600 rps и ошибки.`
        }

Для cache-aside обратиться к database — естественно: для server каждое чтение просто становится miss. Для read-through это отдельный код, запасной путь, который команде нужно написать и проверить, иначе чтения падают. В любом случае в cache лежат только копии, но без него система уже не живёт. Опасен даже перезапуск: cache возвращается пустым, или **холодным** (cold), и какое-то время каждое чтение — miss. Поэтому cache запускают на нескольких узлах и прогревают (warm-up), прежде чем пустить на него трафик, а нагрузку, которую database получит без cache, всегда держат в голове.`,
    },
    summary: {
      title: 'Итог',
      body: ({ sim }) =>
        `Cache снова работает. Он снимает с database повторяющиеся чтения: при hit rate ${percent(cacheHitShare)} до неё доходит лишь ${percent(1 - cacheHitShare)} чтений. Нагрузка на database упала с 1600 до ${n(sim.databaseLoad)} rps, а cache стоит 0,15 $ в час.

- Cache-aside: при miss database читает server и заполняет cache. Самый распространённый подход, и отказ cache он переживает сам.
- Read-through: при miss database читает cache. Код приложения проще, но cache нужна своя связь с database.

Кешируйте то, что часто читают и редко меняют. Задавайте ключам TTL и удаляйте их из cache, когда данные меняются. Помните, что запись по-прежнему идёт в database, а без cache она снова перегружена.

Теперь самые загруженные — блоки [[app3|Server]], на 80%. Немалая часть их работы — вовсе не логика магазина, а картинки, скрипты и стили, одинаковые для всех посетителей. В уроке 5 их заберёт **CDN** (Content Delivery Network, по-русски — сеть доставки контента).`,
    },
  },
  annotations: {
    dbLoad: sim => `${n(incoming(sim, 'db'))} rps из ${n(1500)} возможных`,
    dbOverload: sim =>
      `загрузка ${percent(utilization(sim, 'db'))} · ошибки ${percent(sim.errorRate)}`,
    serverCalm: sim => `${n(incoming(sim, 'app3'))} rps из 400 · справляется`,
    readsWrites: sim =>
      `чтение ${n(incoming(sim, 'db') * (1 - writeShare))} · запись ${n(incoming(sim, 'db') * writeShare)}`,
    cacheHits: sim =>
      `hit ${n(cacheReads(sim) * cacheHitShare)} из ${n(cacheReads(sim))} чтений`,
    dbAfter: sim =>
      `запись ${n(writes(sim))} + miss ${n(missedReads(sim))} rps`,
    missesLost: sim =>
      dropped(sim, 'cache-1') >= 1
        ? `промахи теряются: ${n(dropped(sim, 'cache-1'))} rps`
        : 'промахи доходят до database',
    serversNext: sim =>
      `${n(incoming(sim, 'app3'))} rps из 400 · ${percent(utilization(sim, 'app3'))}`,
  },
  quizzes: {
    'db-after-cache': {
      question: `Cache сам отвечает на ${percent(cacheHitShare)} чтений. Сколько запросов в секунду дойдёт до database при ${n(LOAD)} rps, когда cache встанет на место?`,
      options: {
        unchanged: `${n(LOAD)} rps — столько же`,
        'all-reads': `${n(quizReads)} rps`,
        'writes-and-misses': `${n(quizWrites + quizMisses)} rps`,
        misses: `${n(quizMisses)} rps`,
      },
      wrong: {
        unchanged:
          'Cache забирает себе чтения, на которые знает ответ: до database доходит заметно меньше.',
        'all-reads': `${n(quizReads)} — это все чтения. Но ${percent(cacheHitShare)} из них cache отдаст сам, в database уйдут только cache miss.`,
        misses: `${n(quizMisses)} — это только cache miss. Запись идёт в database мимо cache: ещё ${n(quizWrites)} rps.`,
      },
      explain: `До database дойдут все записи — ${percent(writeShare)} от ${n(LOAD)}, это ${n(quizWrites)} rps, — и cache miss: ${percent(1 - cacheHitShare)} от ${n(quizReads)} чтений, это ${n(quizMisses)} rps. Всего ${n(quizWrites + quizMisses)} rps из 1500 возможных: database выдохнет. Проверьте это в задачах.`,
    },
    'cache-down-pattern': {
      question:
        'Cache упал. При каком подходе приложение продолжит отвечать на чтения из database без дополнительного кода?',
      options: {
        'cache-aside': 'Cache-aside',
        'read-through': 'Read-through',
        both: 'При обоих: database же на месте',
        neither: 'Ни при каком: чтения падают, пока cache не вернётся',
      },
      wrong: {
        'read-through':
          'В read-through server знает только cache: путь к database принадлежит cache. Без отдельного запасного пути чтения падают.',
        both: 'Database на месте, но в read-through у server нет к ней пути для чтения: этот путь принадлежит cache.',
        neither:
          'В cache-aside server и так читает database при каждом miss. Когда cache упал, каждое чтение просто становится miss.',
      },
      explain:
        'В cache-aside server и так читает database при каждом miss, поэтому упавший cache просто превращает каждое чтение в miss: медленнее, и database получает всю нагрузку, но чтения обслуживаются. В read-through server говорит только с cache, поэтому команде нужно написать запасной путь к database, иначе чтения падают. На этой доске блоки «Server» обращаются к database сами, как будто такой путь уже написан.',
    },
  },
  tasks: {
    'cache-aside': {
      prompt:
        'Снимите чтение с database по схеме cache-aside: блоки «Server» спрашивают cache, а при miss читают database сами.',
      goals: {
        'cache-exists': 'На доске есть блок «Cache»',
        'servers-use-cache': 'Блоки «Server» подключены к cache',
        'no-cache-db':
          'У cache нет связи с database: при miss её читают блоки «Server»',
        'db-relieved': 'Database загружена не больше чем на 45% при 1600 rps',
        'holds-load': 'Держит 1600 rps с ошибками меньше 1%',
      },
      hints: [
        'Большинство запросов к database — повторяющиеся чтения. Ответы на них можно держать ближе, в быстрой памяти, и спрашивать её первой.',
        'Поставьте cache и подключите к нему каждый из пяти блоков «Server». Связи блоков «Server» с database не удаляйте: по ним идут запись и промахи. Сам cache остаётся без связи с database.',
        'На доске появился пунктирный контур. Поставьте cache туда и проведите отмеченные связи: от каждого из пяти блоков «Server» к cache.',
      ],
      solvedNote:
        'Четыре чтения из пяти теперь обслуживает cache; остальные блоки «Server» читают из database и заполняют cache.',
    },
    'read-through': {
      prompt:
        'В read-through при miss database читает сам cache: дайте ему дорогу к database.',
      goals: {
        'cache-reads-db': 'Cache подключён к database',
        'db-relieved': 'Database загружена не больше чем на 45% при 1600 rps',
        'holds-load': 'Держит 1600 rps с ошибками меньше 1%',
      },
      hints: [
        'Промахи теперь забота cache, а отправить их ему некуда.',
        'Проведите связь от cache к database. Связи блоков «Server» с database остаются: по ним идёт запись.',
        'На доске появилась пунктирная линия: проведите связь от cache к database.',
      ],
      solvedNote:
        'Промахи теперь идут от cache в database, а блоки «Server» шлют ей только запись.',
    },
  },
} satisfies LessonTexts<typeof lesson>
