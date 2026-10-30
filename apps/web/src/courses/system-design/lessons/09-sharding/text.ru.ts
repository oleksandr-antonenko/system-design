import { catalog } from '../../../../domain/catalog'
import { type SimResult, simulationRules } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('ru', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`
const capacity = catalog.db.capacity
const incoming = (sim: SimResult, id: string) => sim.nodes[id]?.incoming ?? 0
const utilization = (sim: SimResult, id: string) =>
  sim.nodes[id]?.utilization ?? 0
const edge = (sim: SimResult, from: string, to: string) =>
  sim.edges[`${from}>${to}`] ?? 0
const writesInto = (sim: SimResult, id: string) =>
  ['group1', 'group2', 'group3', 'group4'].reduce(
    (sum, group) => sum + edge(sim, group, id),
    0,
  )
const missesInto = (sim: SimResult, id: string) => edge(sim, 'cache-1', id)

export default {
  title: 'Sharding',
  summary:
    'Как разделить данные между независимыми databases: shard key, hot shards, запросы через все shards и resharding.',
  steps: {
    'one-primary': {
      title: 'Маркетплейс на одной database',
      body: ({ sim }) =>
        `Магазин превратился в маркетплейс с тысячами продавцов, и нагрузка теперь измеряется тысячами rps. Чтобы всё поместилось на доске, блок «Server» в этом уроке обозначает **группу servers** (их шесть) за своим load balancer: от [[group1|group1]] до [[group4|group4]], по ${n(2400)} rps на группу. Запросы от [[users|Users]] распределяет между группами DNS.

Чтение идёт через [[cache-1|cache]] из урока 4: ${percent(simulationRules.cacheHitShare)} запросов он отдаёт сам, и только **cache misses** (промахи кеша) доходят до [[db|database]]. Запись закешировать нельзя: заказ, оплату или изменение остатка на складе нужно сохранить в database.

Подпись над блоком «Database» показывает оба потока. При ${n(sim.load)} rps в неё приходит ${n(writesInto(sim, 'db'))} rps записи и всего ${n(missesInto(sim, 'db'))} rps cache misses: запись уже составляет большую часть.`,
    },
    'sale-day': {
      title: 'Распродажа',
      body: ({ sim }) =>
        `Началась большая распродажа, и нагрузка удвоилась до **${n(sim.load)} rps**. Группы servers загружены всего на ${percent(utilization(sim, 'group1'))}, cache почти не заметил разницы. Но в [[db|database]] приходит ${n(incoming(sim, 'db'))} rps: ${n(writesInto(sim, 'db'))} rps записи и ${n(missesInto(sim, 'db'))} rps cache misses, намного больше её ${n(capacity)}. Теряется ${n(sim.nodes['db']?.dropped ?? 0)} rps, ошибок ${percent(sim.errorRate)}.

Оба потока выросли вдвое вместе с нагрузкой. А если распродажа пройдёт удачно, в следующем году она будет ещё больше.`,
    },
    'replicas-wont-help': {
      title: 'Почему read replicas не помогут',
      body: ({ sim }) =>
        `В уроке 6 database спасли read replicas. Здесь они могли бы взять на себя только cache misses. Запись по-прежнему идёт в primary, и каждая read replica вынуждена её повторять. Добавляйте read replicas сколько угодно: на [[db|primary]] всё равно останется ${n(writesInto(sim, 'db'))} rps записи, ${percent(writesInto(sim, 'db') / capacity)} его мощности, и никакого запаса на следующую распродажу.

Более мощная database даст немного времени, но её потолок близко, а самые мощные машины стоят целое состояние. Одна database просто не может принять столько записи. Значит, делить придётся сами **данные**.`,
    },
    'split-data': {
      title: 'Задача: shards',
      body: `**Sharding** (по-русски — шардирование) делит данные между независимыми databases — **shards** (шардами). Каждый shard хранит только свою часть данных, например половину пользователей со всеми их заказами, корзинами и отзывами, и получает чтение и запись только для этой части.

В каком shard лежит запись, решает **shard key** (ключ шардирования), например id пользователя. Группы servers и cache вычисляют по ключу, куда отправить каждый запрос, поэтому каждому из них нужна связь с каждым shard. На доске блок, у которого есть связи с несколькими блоками «Database», делит свою запись или cache misses между ними поровну, как будто ключ делит пользователей поровну.

В палитре есть database: она станет вторым shard.`,
    },
    'shard-key': {
      title: 'Выбор shard key',
      body: `Теперь каждый пользователь живёт в одном shard. Server берёт хеш от id пользователя и остаток от деления на два: одна половина пользователей попадает в [[db|db]], другая — в [[db2|db2]]. Все данные пользователя лежат в одном shard, поэтому «Мои заказы» или оформление заказа обращаются к одной database.

Плохой ключ создаёт **hot shard** (горячий шард): один shard получает гораздо больше своей доли и перегружается, пока остальные простаивают. Sharding по стране сложит большинство пользователей в shard самой большой страны. Sharding по дате заказа отправит все новые заказы в самый новый shard. Даже у хорошего ключа бывает **hot spot** (горячая точка): одна запись, которая нужна всем сразу, например остаток товара, внезапно ставшего хитом.

Доска делит нагрузку поровну, как при удачно выбранном ключе. На практике ключ выбирают так, чтобы нагрузка распределялась равномерно, а большинство запросов обращалось к одному shard.`,
    },
    resharding: {
      title: 'Запросы через все shards и resharding',
      body: ({ sim }) =>
        `Некоторые запросы не ложатся на ключ. Продавец хочет увидеть все заказы на свои товары, а эти заказы принадлежат покупателям из всех shards. Такой запрос приходится разослать **во все shards** и склеить ответы (**scatter-gather**, «разослать и собрать»), и работает он со скоростью самого медленного shard. JOIN между shards больше не сделать, а транзакция, которая затрагивает больше одного shard, например перевод денег между двумя пользователями, требует специальных протоколов. Такие запросы обычно обслуживает отдельная копия данных, упорядоченная по другому ключу, например **search index** (по-русски — поисковый индекс; подробно о нём в уроке 12).

Прошёл год, нагрузка — ${n(sim.load)} rps. ${
          utilization(sim, 'db') > 0.8
            ? `Shards снова загружены на ${percent(utilization(sim, 'db'))}, нужен третий.`
            : `У ваших shards пока есть запас (${percent(utilization(sim, 'db'))}), но рост догонит и их.`
        } Здесь и начинается боль **resharding** (решардинга, перераспределения данных). При правиле «хеш по модулю 2» переход на «по модулю 3» переносит в другой shard около двух третей всех записей: терабайты приходится копировать, не останавливая магазин.

Поэтому resharding планируют заранее. Данные делят на маленькие **logical shards** (логические шарды), скажем на 256 штук, и раскладывают их по имеющимся databases, а новая database забирает себе часть из них целиком. Ту же задачу решает **consistent hashing** (консистентное хеширование): при добавлении shard переезжает лишь небольшая доля ключей.`,
    },
    summary: {
      title: 'Итог',
      body: `Sharding — способ **масштабировать запись**: каждый shard берёт свою долю, и мощность растёт вместе с числом shards.

Цена — сложность: маршрутизация по ключу, hot shards, запросы через все shards без JOIN и транзакций, болезненный resharding. Поэтому sharding оставляют напоследок: сначала cache, read replicas и database помощнее, а shards — только когда запись или объём данных перестают помещаться на одну машину.

И ещё одно: каждый shard — **единственная копия** данных своих пользователей. Если [[db2|db2]] упадёт, половина пользователей потеряет доступ к своим заказам, а другая продолжит работать как ни в чём не бывало. На практике у каждого shard есть свои read replicas, как в уроке 6. Как пережить отказ любого блока, разберём в уроке 10.`,
    },
  },
  annotations: {
    writesAndMisses: sim =>
      `запись ${n(writesInto(sim, 'db'))} + misses ${n(missesInto(sim, 'db'))} rps`,
    dbOverload: sim =>
      `${n(incoming(sim, 'db'))} rps из ${n(capacity)} · ошибки ${percent(sim.errorRate)}`,
    writesAlone: sim =>
      `только запись: ${n(writesInto(sim, 'db'))} rps · ${percent(writesInto(sim, 'db') / capacity)}`,
    shardOne: sim => `hash(user_id) % 2 = 0 · ${n(incoming(sim, 'db'))} rps`,
    shardTwo: sim => `hash(user_id) % 2 = 1 · ${n(incoming(sim, 'db2'))} rps`,
    shardOneGrowth: sim =>
      `${n(incoming(sim, 'db'))} rps из ${n(capacity)} · ${percent(utilization(sim, 'db'))}`,
    shardTwoGrowth: sim =>
      `${n(incoming(sim, 'db2'))} rps из ${n(capacity)} · ${percent(utilization(sim, 'db2'))}`,
    onlyCopyOne: sim => `${n(incoming(sim, 'db'))} rps · единственная копия`,
    onlyCopyTwo: sim => `${n(incoming(sim, 'db2'))} rps · единственная копия`,
  },
  tasks: {
    'split-data': {
      prompt: `Разделите данные между shards так, чтобы у каждой database оставался запас при ${n(6400)} rps.`,
      goals: {
        'servers-use-shards': 'Группы servers пишут в два блока «Database»',
        'cache-uses-shards': 'Cache читает misses из двух блоков «Database»',
        'shard-headroom': `Каждый shard загружен не больше чем на 80% при ${n(6400)} rps`,
        'holds-load': `Держит ${n(6400)} rps с ошибками меньше 1%`,
      },
      hints: [
        'Ни одна database не примет всю запись. Её поток нужно разделить между несколькими блоками «Database».',
        'Поставьте вторую database рядом с первой и подключите к ней каждую группу servers и cache. Старые связи оставьте: каждый shard хранит свою часть данных.',
        'На доске появился пунктирный контур. Поставьте database туда и проведите отмеченные связи от всех четырёх групп и от cache.',
      ],
      solvedNote:
        'Каждый shard берёт половину записи и половину cache misses, и оба загружены меньше чем на 80%.',
    },
  },
} satisfies LessonTexts<typeof lesson>
