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
  title: 'Кеширование',
  summary: 'Cache-aside, hit rate и TTL: как снять нагрузку с database.',
  steps: {
    'five-servers': {
      title: 'Пять servers, одна database',
      body: `Интернет-магазин из урока 3 вырос. [[users|Users]] приходят через [[lb|load balancer]] на пять блоков «Server», от [[app1|app1]] до [[app5|app5]], и все они работают с одной [[db|database]]. Сейчас приходит 1200 rps.

Каждому server достаётся по 240 rps — 60% его мощности. Database тяжелее: в неё сходятся запросы от всех блоков «Server», поэтому она получает все 1200 rps из 1500 возможных. Это 80%, самый загруженный блок на доске.`,
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
    'place-cache': {
      title: 'Задача: cache',
      body: `Поставьте cache между блоками «Server» и [[db|database]]. Блоки «Server» отправляют чтения в cache: при hit он отвечает сам, а при miss передаёт запрос в database.

Связь каждого server с database оставьте: запись идёт только туда. В cache лежат копии, а оригиналы хранятся в database. Блок «Cache» уже есть в палитре.`,
    },
    'stale-data': {
      title: 'Устаревшие данные',
      body: ({ sim }) =>
        `[[db|Database]] вздохнула свободно: теперь она получает ${n(sim.databaseLoad)} rps вместо 1600. Из них ${n(writes(sim))} — запись. С ней cache не помогает: каждая запись по-прежнему идёт в database. Остальные ${n(missedReads(sim))} — чтения, которые закончились cache miss. p95 упал до ${p95(sim)}.

Как данные попадают в cache? Обычно этим занимается server: сначала спрашивает cache, а при miss читает из database и кладёт ответ в cache. Такой подход называется **cache-aside**. На доске [[cache-1|cache]] сам ходит в database (такой подход называется read-through), но для database разницы нет.

За cache приходится платить **устаревшими данными** (stale data). Цена товара в database изменилась, а cache всё ещё отдаёт старую. Одна защита — **TTL** (time to live, время жизни): каждый ключ живёт в cache, скажем, 60 секунд и исчезает, а следующее чтение берёт свежее значение из database. Другая — **инвалидация** (invalidation): при записи server сразу удаляет ключ из cache. TTL прост, но оставляет окно устаревших данных; инвалидация точнее, но её легко забыть в одном из мест, где идёт запись. Обычно их сочетают.`,
    },
    'cache-down': {
      title: 'Если cache упал',
      body: ({ sim }) =>
        `[[cache-1|Cache]] упал. ${
          sim.errorRate > 0.01
            ? `Блоки «Server» снова отправляют чтения прямо в [[db|database]]. Она получает ${n(sim.databaseLoad)} rps, и ${percent(sim.errorRate)} запросов теряются, как до cache.`
            : `На вашей доске чтения подхватил другой cache, поэтому [[db|database]] держится: ${n(sim.databaseLoad)} rps. С одним cache она снова получила бы 1600 rps и ошибки.`
        }

В cache лежат только копии, но без него система уже не живёт. Опасен даже перезапуск: cache возвращается пустым, или **холодным** (cold), и какое-то время каждое чтение — miss. Поэтому cache запускают на нескольких узлах и прогревают (warm-up), прежде чем пустить на него трафик, а нагрузку, которую database получит без cache, всегда держат в голове.`,
    },
    summary: {
      title: 'Итог',
      body: ({ sim }) =>
        `Cache снова работает. Он снимает с database повторяющиеся чтения: при hit rate ${percent(cacheHitShare)} до неё доходит лишь ${percent(1 - cacheHitShare)} чтений. Нагрузка на database упала с 1600 до ${n(sim.databaseLoad)} rps, а cache стоит 0,15 $ в час.

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
      `hit ${n(incoming(sim, 'cache-1') * cacheHitShare)} из ${n(incoming(sim, 'cache-1'))} rps`,
    dbAfter: sim =>
      `запись ${n(writes(sim))} + miss ${n(missedReads(sim))} rps`,
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
      explain: `До database дойдут все записи — ${percent(writeShare)} от ${n(LOAD)}, это ${n(quizWrites)} rps, — и cache miss: ${percent(1 - cacheHitShare)} от ${n(quizReads)} чтений, это ${n(quizMisses)} rps. Всего ${n(quizWrites + quizMisses)} rps из 1500 возможных: database выдохнет. Проверьте это в задаче.`,
    },
  },
  tasks: {
    'place-cache': {
      prompt:
        'Снимите чтение с database: поставьте cache между блоками «Server» и database.',
      goals: {
        'cache-exists': 'На доске есть блок «Cache»',
        'servers-use-cache': 'Блоки «Server» подключены к cache',
        'cache-backed-by-db': 'Cache подключён к database',
        'db-relieved': 'Database загружена не больше чем на 60% при 1600 rps',
        'holds-load': 'Держит 1600 rps с ошибками меньше 1%',
      },
      hints: [
        'Большинство запросов к database — повторяющиеся чтения. Ответы на них можно держать ближе, в быстрой памяти.',
        'Поставьте cache между блоками «Server» и database. Подключите к нему каждый server, а сам cache — к database, для cache miss. Связи блоков «Server» с database не удаляйте: по ним идёт запись.',
        'На доске появился пунктирный контур. Поставьте cache туда и проведите отмеченные связи: от каждого из пяти блоков «Server» к cache и от cache к database.',
      ],
      solvedNote:
        'Четыре чтения из пяти теперь обслуживает cache, и у database появился запас.',
    },
  },
} satisfies LessonTexts<typeof lesson>
