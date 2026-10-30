import { catalog } from '../../../../domain/catalog'
import { type SimResult, simulationRules } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('uk', Math.round(value))
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
  title: 'Sharding. Дані частинами',
  summary:
    'Як розділити дані між незалежними databases: shard key, hot shards, запити через усі shards і resharding.',
  steps: {
    'one-primary': {
      title: 'Маркетплейс на одній database',
      body: ({ sim }) =>
        `Магазин перетворився на маркетплейс із тисячами продавців, і навантаження тепер вимірюється тисячами rps. Щоб усе вмістилося на дошці, блок «Server» у цьому уроці позначає **групу servers** (їх шість) за своїм load balancer: від [[group1|group1]] до [[group4|group4]], по ${n(2400)} rps на групу. Запити від [[users|Users]] розподіляє між групами DNS.

Читання йде через [[cache-1|cache]] з уроку 4: ${percent(simulationRules.cacheHitShare)} запитів він віддає сам, і лише **cache misses** (промахи кешу) доходять до [[db|database]]. Запис закешувати не можна: замовлення, оплату чи зміну залишку на складі треба зберегти в database.

Підпис над блоком «Database» показує обидва потоки. При ${n(sim.load)} rps до неї надходить ${n(writesInto(sim, 'db'))} rps запису і лише ${n(missesInto(sim, 'db'))} rps cache misses: запис уже становить більшу частину.`,
    },
    'sale-day': {
      title: 'Розпродаж',
      body: ({ sim }) =>
        `Почався великий розпродаж, і навантаження подвоїлося до **${n(sim.load)} rps**. Групи servers завантажені лише на ${percent(utilization(sim, 'group1'))}, cache майже не помітив різниці. Але до [[db|database]] надходить ${n(incoming(sim, 'db'))} rps: ${n(writesInto(sim, 'db'))} rps запису і ${n(missesInto(sim, 'db'))} rps cache misses, набагато більше за її ${n(capacity)}. Втрачається ${n(sim.nodes['db']?.dropped ?? 0)} rps, помилок ${percent(sim.errorRate)}.

Обидва потоки зросли вдвічі разом із навантаженням. А якщо розпродаж буде вдалим, наступного року він буде ще більшим.`,
    },
    'replicas-wont-help': {
      title: 'Чому read replicas не допоможуть',
      body: ({ sim }) =>
        `В уроці 6 database врятували read replicas. Тут вони могли б узяти на себе лише cache misses. Запис і далі йде в primary, і кожна read replica змушена його повторювати. Додавайте read replicas скільки завгодно: на [[db|primary]] однаково залишиться ${n(writesInto(sim, 'db'))} rps запису, ${percent(writesInto(sim, 'db') / capacity)} його потужності, і жодного запасу на наступний розпродаж.

Потужніша database дасть трохи часу, але її стеля близько, а найпотужніші машини коштують цілий статок. Одна database просто не може прийняти стільки запису. Отже, ділити доведеться самі **дані**.`,
    },
    'split-data': {
      title: 'Задача: shards',
      body: `**Sharding** (українською — шардування) ділить дані між незалежними databases — **shards** (шардами). Кожен shard зберігає лише свою частину даних, наприклад половину користувачів з усіма їхніми замовленнями, кошиками й відгуками, і отримує читання та запис лише для цієї частини.

У якому shard лежить запис, вирішує **shard key** (ключ шардування), наприклад id користувача. Групи servers і cache обчислюють за ключем, куди надіслати кожен запит, тому кожному з них потрібен зв’язок із кожним shard. На дошці блок, що має зв’язки з кількома блоками «Database», ділить свій запис або cache misses між ними порівну, ніби ключ ділить користувачів порівну.

У палітрі є database: вона стане другим shard.`,
    },
    'shard-key': {
      title: 'Вибір shard key',
      body: `Тепер кожен користувач живе в одному shard. Server бере хеш від id користувача й остачу від ділення на два: одна половина користувачів потрапляє в [[db|db]], інша — в [[db2|db2]]. Усі дані користувача лежать в одному shard, тому «Мої замовлення» чи оформлення замовлення звертаються до однієї database.

Поганий ключ створює **hot shard** (гарячий шард): один shard отримує набагато більше за свою частку й перевантажується, поки інші простоюють. Sharding за країною складе більшість користувачів у shard найбільшої країни. Sharding за датою замовлення надішле всі нові замовлення в найновіший shard. Навіть у доброго ключа буває **hot spot** (гаряча точка): один запис, потрібний усім одночасно, наприклад залишок товару, який раптом став хітом.

Дошка ділить навантаження порівну, як за вдало обраного ключа. На практиці ключ обирають так, щоб навантаження розподілялося рівномірно, а більшість запитів зверталася до одного shard.`,
    },
    resharding: {
      title: 'Запити через усі shards і resharding',
      body: ({ sim }) =>
        `Деякі запити не лягають на ключ. Продавець хоче побачити всі замовлення на свої товари, а ці замовлення належать покупцям з усіх shards. Такий запит доводиться розіслати **в усі shards** й склеїти відповіді (**scatter-gather**, «розіслати й зібрати»), і працює він зі швидкістю найповільнішого shard. JOIN між shards більше не зробити, а транзакція, що зачіпає більше ніж один shard, наприклад переказ грошей між двома користувачами, потребує спеціальних протоколів. Такі запити зазвичай обслуговує окрема копія даних, упорядкована за іншим ключем, наприклад **search index** (українською — пошуковий індекс; докладно про нього в уроці 12).

Минув рік, навантаження — ${n(sim.load)} rps. ${
          utilization(sim, 'db') > 0.8
            ? `Shards знову завантажені на ${percent(utilization(sim, 'db'))}, потрібен третій.`
            : `Ваші shards поки мають запас (${percent(utilization(sim, 'db'))}), але зростання наздожене і їх.`
        } Тут і починається біль **resharding** (решардингу, перерозподілу даних). За правила «хеш за модулем 2» перехід на «за модулем 3» переносить в інший shard близько двох третин усіх записів: терабайти доводиться копіювати, не зупиняючи магазин.

Тому resharding планують заздалегідь. Дані ділять на маленькі **logical shards** (логічні шарди), скажімо на 256 штук, і розкладають їх по наявних databases, а нова database забирає собі частину з них цілком. Ту саму задачу розв’язує **consistent hashing** (консистентне хешування): коли додають shard, переїжджає лише невелика частка ключів.`,
    },
    summary: {
      title: 'Підсумок',
      body: `Sharding — спосіб **масштабувати запис**: кожен shard бере свою частку, і потужність зростає разом із кількістю shards.

Ціна — складність: маршрутизація за ключем, hot shards, запити через усі shards без JOIN і транзакцій, болісний resharding. Тому sharding залишають насамкінець: спершу cache, read replicas і потужніша database, а shards — лише коли запис чи обсяг даних перестають уміщатися на одну машину.

І ще одне: кожен shard — **єдина копія** даних своїх користувачів. Якщо [[db2|db2]] упаде, половина користувачів утратить доступ до своїх замовлень, а інша половина працюватиме як ні в чому не бувало. На практиці кожен shard має власні read replicas, як в уроці 6. Як пережити відмову будь-якого блока, розберемо в уроці 10.`,
    },
  },
  annotations: {
    writesAndMisses: sim =>
      `запис ${n(writesInto(sim, 'db'))} + misses ${n(missesInto(sim, 'db'))} rps`,
    dbOverload: sim =>
      `${n(incoming(sim, 'db'))} rps із ${n(capacity)} · помилки ${percent(sim.errorRate)}`,
    writesAlone: sim =>
      `лише запис: ${n(writesInto(sim, 'db'))} rps · ${percent(writesInto(sim, 'db') / capacity)}`,
    shardOne: sim => `hash(user_id) % 2 = 0 · ${n(incoming(sim, 'db'))} rps`,
    shardTwo: sim => `hash(user_id) % 2 = 1 · ${n(incoming(sim, 'db2'))} rps`,
    shardOneGrowth: sim =>
      `${n(incoming(sim, 'db'))} rps із ${n(capacity)} · ${percent(utilization(sim, 'db'))}`,
    shardTwoGrowth: sim =>
      `${n(incoming(sim, 'db2'))} rps із ${n(capacity)} · ${percent(utilization(sim, 'db2'))}`,
    onlyCopyOne: sim => `${n(incoming(sim, 'db'))} rps · єдина копія`,
    onlyCopyTwo: sim => `${n(incoming(sim, 'db2'))} rps · єдина копія`,
  },
  tasks: {
    'split-data': {
      prompt: `Розділіть дані між shards так, щоб кожна database мала запас при ${n(6400)} rps.`,
      goals: {
        'servers-use-shards': 'Групи servers пишуть у два блоки «Database»',
        'cache-uses-shards': 'Cache читає misses з двох блоків «Database»',
        'shard-headroom': `Кожен shard завантажений не більше ніж на 80% при ${n(6400)} rps`,
        'holds-load': `Витримує ${n(6400)} rps з помилками менше 1%`,
      },
      hints: [
        'Жодна database не прийме весь запис. Його потік треба розділити між кількома блоками «Database».',
        'Поставте другу database поруч із першою й підключіть до неї кожну групу servers і cache. Старі зв’язки залиште: кожен shard зберігає свою частину даних.',
        'На дошці з’явився пунктирний контур. Поставте database туди й проведіть позначені зв’язки від усіх чотирьох груп і від cache.',
      ],
      solvedNote:
        'Кожен shard бере половину запису й половину cache misses, і обидва завантажені менше ніж на 80%.',
    },
  },
} satisfies LessonTexts<typeof lesson>
