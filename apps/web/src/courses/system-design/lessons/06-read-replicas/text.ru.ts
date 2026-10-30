import { type SimResult, simulationRules } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('ru', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`
const incoming = (sim: SimResult, id: string) => sim.nodes[id]?.incoming ?? 0
const utilization = (sim: SimResult, id: string) =>
  sim.nodes[id]?.utilization ?? 0
const served = (sim: SimResult) =>
  ['app1', 'app2', 'app3', 'app4', 'app5'].reduce(
    (sum, id) => sum + (sim.nodes[id]?.served ?? 0),
    0,
  )
const writes = (sim: SimResult) => served(sim) * simulationRules.writeShare
const reads = (sim: SimResult) => served(sim) - writes(sim)

export default {
  title: 'Read replicas. Копии database для чтения',
  summary:
    'Read replicas, replication lag, failover и почему вся запись по-прежнему идёт в primary.',
  steps: {
    'one-database': {
      title: 'Пять блоков «Server», одна database',
      body: ({ sim }) =>
        `Интернет-магазин вырос. [[users|Users]] приходят через [[lb|load balancer]] на пять блоков «Server», от [[app1|app1]] до [[app5|app5]], а все они читают и записывают данные в одну [[db|database]].

Блоки «Server» не хранят состояния, они stateless (урок 2), поэтому добавлять их легко (урок 3). С database иначе: она одна и выдерживает около **${n(1500)} rps**. Сейчас к ней приходит ${n(incoming(sim, 'db'))} rps, то есть она уже загружена на ${percent(utilization(sim, 'db'))}.

Большая часть этих запросов — **чтение** (read): «Мои заказы», личный кабинет, рекомендации, статус доставки. Лишь примерно один запрос из пяти меняет данные (заказ, корзина, оплата), это **запись** (write). Cache из урока 4 помогает, когда многие читают одно и то же, например страницу популярного товара. Здесь же каждый пользователь читает свои данные, одну и ту же запись редко спрашивают дважды, и cache hit почти не было бы. Поэтому блока «Cache» на доске нет.`,
    },
    'evening-peak': {
      title: 'Вечерний пик',
      body: ({ sim }) =>
        `Вечером нагрузка вырастает до **${n(sim.load)} rps**. Блоки «Server» справляются: каждый загружен на ${percent(utilization(sim, 'app1'))}. Но все запросы сходятся в одной [[db|database]], и ей приходится на ${n(sim.nodes['db']?.dropped ?? 0)} запросов в секунду больше, чем она может обработать. Эти запросы теряются: пользователи получают ошибку, а прибор «Ошибки» показывает ${percent(sim.errorRate)}.

Ещё один server не поможет: он отправит свои запросы в ту же database. Более мощная database поможет на время, но и у неё есть потолок, а цена растёт быстрее мощности, как и у server в уроке 1.`,
    },
    'reads-and-writes': {
      title: 'Чтение можно размножить',
      body: ({ sim }) =>
        `Посмотрите, чем занята [[db|database]]: из её ${n(incoming(sim, 'db'))} rps на чтение приходится ${n(reads(sim))}, а на запись — только ${n(writes(sim))}. Если бы чтение взял на себя кто-то другой, у database появился бы большой запас.

Чтение не меняет данных, поэтому ответить на него может любая точная **копия** database. Поддержание таких копий называется **репликацией** (replication). Главную database называют **primary** (по-русски — основная база), или leader. Она принимает всю запись и заносит каждое изменение в **replication log** (журнал репликации). **Replicas** (по-русски — реплики), или followers, получают этот replication log, применяют те же изменения в том же порядке и отвечают на чтение.

Запись идёт **только в primary**. Если бы две копии принимали запись независимо, они могли бы внести противоречащие друг другу изменения: например, обе продали бы последний товар на складе.`,
    },
    'add-replicas': {
      title: 'Задача: read replicas',
      body: `В палитре появился блок «Read replica». **Read replica** (по-русски — реплика для чтения) — копия database, которая отвечает только на чтение. Server, подключённый к database и к replicas, отправляет запись только в database, а чтение делит поровну между database и своими replicas.

Replica — тоже server, и она может отказать. Если единственная replica упадёт, всё её чтение вернётся на primary, и та снова перегрузится. Вспомните правило **N+1** из урока 3.`,
    },
    'replication-lag': {
      title: 'Replication lag',
      body: `Теперь [[db|primary]] принимает всю запись и свою долю чтения, а [[replica-1|replica-1]] отвечает только на чтение.

Копирование не мгновенно. Primary подтверждает запись сразу, а replicas отправляет её чуть позже. Это **асинхронная репликация** (asynchronous replication), а задержку называют **replication lag** (по-русски — лаг репликации). Обычно это миллисекунды, но под нагрузкой или после сбоя сети replication lag вырастает до секунд.

Анна оформляет заказ, и запись уходит в primary. Её следующий запрос, «Мои заказы», попадает на replica, до которой изменение ещё не дошло, и заказа в списке нет. Анна решает, что заказ потерялся, и оформляет его снова. Чтение с replica **eventually consistent** (по-русски — согласовано в конечном счёте): replica догонит primary, но не сразу.

Обычное решение называется **read-your-own-writes** («читай свои записи»): несколько секунд после того, как пользователь что-то записал, его данные читаются из primary. Важные страницы, например корзину и оплату, можно всегда читать из primary. Другой вариант — **синхронная репликация** (synchronous replication): primary ждёт, пока replica подтвердит запись. Replication lag тогда нет, но каждая запись становится медленнее, а одна медленная replica тормозит всю запись.`,
    },
    failover: {
      title: 'Primary упала',
      body: ({ sim }) =>
        `В самый пик у [[db|primary]] отказывает диск. Без replicas это был бы урок 2: данные недоступны, и все запросы заканчиваются ошибкой.

Но у replicas есть полная копия. Система замечает, что primary не отвечает, и **повышает** (promote) одну из replicas: та становится новой primary и принимает запись, остальные replicas следуют за ней, а блоки «Server» переключаются на неё. Это называется **failover** (по-русски — переключение при отказе). ${
          sim.errorRate > 0.01
            ? `Правда, переключиться смогли не все блоки «Server»: ошибок ${percent(sim.errorRate)}. Если server не подключён ни к одной replica, ему некуда записывать, и он теряет свои запросы.`
            : `Ошибок ${percent(sim.errorRate)}: replicas выдерживают все ${n(sim.load)} rps.`
        }

У failover есть цена. При асинхронной репликации последние записи, которые не успели дойти до replica, теряются. А ещё два узла ни в коем случае не должны одновременно считать себя primary: это называется **split brain** («расщепление мозга»). Чтобы этого не случилось, новую primary выбирают голосованием нескольких узлов.`,
    },
    summary: {
      title: 'Итог',
      body: ({ sim }) =>
        `Старую primary починили. На доске она снова главная; на практике она обычно возвращается как replica новой primary.

Replicas **масштабируют чтение**: каждая берёт свою долю, и их можно добавлять. Ещё это **hot standby** (по-русски — горячий резерв): когда primary падает, replica занимает её место за секунды, а не за часы восстановления из backup (резервной копии). Цена — replication lag, который приложение должно учитывать, и сами replicas, по 0,60 $ в час за каждую.

С **записью** replicas не помогают. Вся запись, ${n(writes(sim))} rps, по-прежнему идёт в [[db|primary]], а каждая replica повторяет каждое изменение, чтобы её копия не отставала (доска считает только чтение, которое обслуживает replica). Когда запись сама по себе перестанет помещаться в одну database, данные придётся разделить между несколькими. Это **sharding** (по-русски — шардирование), тема урока 9.`,
    },
  },
  annotations: {
    dbLoad: sim =>
      `${n(incoming(sim, 'db'))} rps из ${n(1500)} · ${percent(utilization(sim, 'db'))}`,
    dbOverload: sim =>
      `${n(incoming(sim, 'db'))} rps из ${n(1500)} · ошибки ${percent(sim.errorRate)}`,
    readsAndWrites: sim =>
      `чтение ${n(reads(sim))} · запись ${n(writes(sim))} rps`,
    primaryWrites: sim =>
      `запись ${n(writes(sim))} rps + чтение · ${percent(utilization(sim, 'db'))}`,
    replicaBehind: sim =>
      `чтение ${n(incoming(sim, 'replica-1'))} rps · чуть отстаёт`,
    primaryDown: sim => `primary упала · ошибки ${percent(sim.errorRate)}`,
    promoted: sim => `новая primary · ${n(incoming(sim, 'replica-1'))} rps`,
    writesStayHere: sim => `вся запись, ${n(writes(sim))} rps · только здесь`,
  },
  tasks: {
    'add-replicas': {
      prompt: `Распределите чтение так, чтобы у database оставался запас при ${n(1600)} rps, даже если одна replica откажет.`,
      goals: {
        'replica-exists': 'На доске есть блок «Read replica»',
        'servers-read-replicas': 'Блоки «Server» подключены к replica',
        'primary-headroom': `Database загружена не больше чем на 80% при ${n(1600)} rps`,
        'holds-load': `Держит ${n(1600)} rps с ошибками меньше 1%`,
        'spare-replica': 'Переживает отказ любой одной replica',
      },
      hints: [
        'Database завалена чтением, а на чтение может ответить любая копия данных.',
        'Поставьте два блока «Read replica» справа от блоков «Server» и подключите каждый server к обоим. Связи «Server → Database» оставьте: только по ним идёт запись.',
        'На доске появился пунктирный контур. Поставьте replicas туда и проведите отмеченные связи от каждого блока «Server».',
      ],
      solvedNote:
        'Запись идёт в primary, чтение делится на троих, и если одна replica откажет, database больше не перегрузится.',
    },
  },
} satisfies LessonTexts<typeof lesson>
