import { type SimResult, simulationRules } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('uk', Math.round(value))
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
  title: 'Read replicas. Копії database для читання',
  summary:
    'Read replicas, replication lag, failover і чому весь запис і далі йде в primary.',
  steps: {
    'one-database': {
      title: 'П’ять блоків «Server», одна database',
      body: ({ sim }) =>
        `Інтернет-магазин виріс. [[users|Users]] приходять через [[lb|load balancer]] на п’ять блоків «Server», від [[app1|app1]] до [[app5|app5]], а всі вони читають і записують дані в одну [[db|database]].

Блоки «Server» не зберігають стану (урок 2), тому додавати їх легко (урок 3). З database інакше: вона одна й витримує близько **${n(1500)} rps**. Зараз до неї надходить ${n(incoming(sim, 'db'))} rps, тобто вона вже завантажена на ${percent(utilization(sim, 'db'))}.

Більшість цих запитів — **читання** (read): «Мої замовлення», особистий кабінет, рекомендації, статус доставки. Лише приблизно один запит із п’яти змінює дані (замовлення, кошик, оплата), це **запис** (write). Cache з уроку 4 допомагає, коли багато людей читають одне й те саме, наприклад сторінку популярного товару. Тут же кожен користувач читає свої дані, той самий запис рідко запитують двічі, і hit rate у cache був би мізерним. Тому cache на дошці немає.`,
    },
    'evening-peak': {
      title: 'Вечірній пік',
      body: ({ sim }) =>
        `Увечері навантаження зростає до **${n(sim.load)} rps**. Блоки «Server» дають раду: кожен завантажений на ${percent(utilization(sim, 'app1'))}. Але всі запити сходяться в одній [[db|database]], і їй припадає на ${n(sim.nodes['db']?.dropped ?? 0)} запитів на секунду більше, ніж вона може обробити. Ці запити губляться: користувачі отримують помилку, а прилад «Помилки» показує ${percent(sim.errorRate)}.

Ще один server не допоможе: він надішле свої запити в ту саму database. Потужніша database допоможе на якийсь час, але й вона має стелю, а ціна зростає швидше за потужність, як і з блоком «Server» в уроці 1.`,
    },
    'reads-and-writes': {
      title: 'Читання можна розмножити',
      body: ({ sim }) =>
        `Погляньте, чим зайнята [[db|database]]: з її ${n(incoming(sim, 'db'))} rps на читання припадає ${n(reads(sim))}, а на запис — лише ${n(writes(sim))}. Якби читання взяв на себе хтось інший, database мала б великий запас.

Читання не змінює даних, тому відповісти на нього може будь-яка точна **копія** database. Підтримання таких копій називається **реплікацією** (replication). Головну копію називають **primary** (українською — основна база; ще кажуть leader). Вона приймає весь запис і заносить кожну зміну в **replication log** (журнал реплікації). **Replica** (українською — репліка; ще кажуть follower) отримує цей журнал, застосовує ті самі зміни в тому самому порядку й відповідає на читання.

Запис іде **лише в primary**. Якби дві копії приймали запис незалежно, вони могли б внести суперечливі зміни: наприклад, обидві продали б останній товар на складі.`,
    },
    'add-replicas': {
      title: 'Задача: read replicas',
      body: `У палітрі з’явився блок «Read replica». **Read replica** (українською — репліка для читання) — копія database, яка відповідає лише на читання. Server, підключений до database і до read replica, надсилає запис лише в database, а читання ділить порівну між database та всіма своїми read replica.

Read replica — теж server, і вона може відмовити. Якщо єдина read replica впаде, усе її читання повернеться на primary, і та знову перевантажиться. Згадайте правило **N+1** з уроку 3.`,
    },
    'replication-lag': {
      title: 'Replication lag',
      body: `Тепер [[db|primary]] приймає весь запис і свою частку читання, а [[replica-1|replica-1]] відповідає лише на читання.

Копіювання не миттєве. Primary підтверджує запис одразу, а на кожну replica пересилає його трохи пізніше. Це **асинхронна реплікація** (asynchronous replication), а затримку називають **replication lag** (затримка реплікації). Зазвичай це мілісекунди, але під навантаженням або після збою мережі replication lag зростає до секунд.

Анна оформлює замовлення, і запис іде в primary. Її наступний запит, «Мої замовлення», потрапляє на replica, до якої зміна ще не дійшла, і замовлення в списку немає. Анна вирішує, що замовлення загубилося, і оформлює його знову. Читання з replica — **eventually consistent** (узгоджене зрештою): replica наздожене primary, але не одразу.

Звичайне рішення — **read-your-own-writes** («читай свої записи»): кілька секунд після того, як користувач щось записав, його дані читаються з primary. Важливі сторінки, як-от кошик і оплату, можна завжди читати з primary. Інший варіант — **синхронна реплікація** (synchronous replication): primary чекає, поки replica підтвердить запис. Replication lag тоді немає, але кожен запис стає повільнішим, а одна повільна replica гальмує весь запис.`,
    },
    failover: {
      title: 'Primary упала',
      body: ({ sim }) =>
        `У самий пік у [[db|primary]] відмовляє диск. Без жодної replica це був би урок 2: дані недоступні, і всі запити закінчуються помилкою.

Але кожна replica має повну копію. Система помічає, що primary не відповідає, і **підвищує** (promote) одну replica: та стає новою primary і приймає запис, інші блоки «Read replica» йдуть за нею, а блоки «Server» перемикаються на неї. Це називається **failover** (перемикання при відмові). ${
          sim.errorRate > 0.01
            ? `Щоправда, перемкнутися змогли не всі блоки «Server»: помилок ${percent(sim.errorRate)}. Блоку «Server» без зв’язку з жодною replica нікуди записувати, і він втрачає свої запити.`
            : `Помилок ${percent(sim.errorRate)}: блоки «Read replica» витримують усі ${n(sim.load)} rps.`
        }

Failover має ціну. За асинхронної реплікації останні записи, які не встигли дійти до replica, губляться. А ще два вузли за жодних умов не повинні одночасно вважати себе primary: це називається **split brain** («розщеплення мозку»). Щоб цього не сталося, нову primary обирають голосуванням кількох вузлів.`,
    },
    summary: {
      title: 'Підсумок',
      body: ({ sim }) =>
        `Стару primary полагодили. На дошці вона знову головна; на практиці вона зазвичай повертається як replica нової primary.

Блоки «Read replica» **масштабують читання**: кожен бере свою частку, і їх можна додавати. Ще це **hot standby** (гарячий резерв): коли primary падає, replica займає її місце за секунди, а не за години відновлення з **backup** (резервної копії). Ціна — replication lag, який застосунок має враховувати, і самі блоки «Read replica», по 0,60 $ на годину за кожен.

Із **записом** жодна replica не допоможе. Увесь запис, ${n(writes(sim))} rps, і далі йде в [[db|primary]], а кожна replica повторює кожну зміну, щоб її копія не відставала (дошка рахує лише читання, яке обслуговує replica). Коли запис сам по собі перестане вміщатися в одну database, дані доведеться розділити між кількома. Це **sharding** (українською — шардування: поділ даних між кількома базами), тема уроку 9.`,
    },
  },
  annotations: {
    dbLoad: sim =>
      `${n(incoming(sim, 'db'))} rps із ${n(1500)} · ${percent(utilization(sim, 'db'))}`,
    dbOverload: sim =>
      `${n(incoming(sim, 'db'))} rps із ${n(1500)} · помилки ${percent(sim.errorRate)}`,
    readsAndWrites: sim =>
      `читання ${n(reads(sim))} · запис ${n(writes(sim))} rps`,
    primaryWrites: sim =>
      `запис ${n(writes(sim))} rps + читання · ${percent(utilization(sim, 'db'))}`,
    replicaBehind: sim =>
      `читання ${n(incoming(sim, 'replica-1'))} rps · трохи відстає`,
    primaryDown: sim => `primary упала · помилки ${percent(sim.errorRate)}`,
    promoted: sim => `нова primary · ${n(incoming(sim, 'replica-1'))} rps`,
    writesStayHere: sim => `увесь запис, ${n(writes(sim))} rps · лише тут`,
  },
  tasks: {
    'add-replicas': {
      prompt: `Розподіліть читання так, щоб database мала запас при ${n(1600)} rps, навіть якщо одна replica відмовить.`,
      goals: {
        'replica-exists': 'На дошці є блок «Read replica»',
        'servers-read-replicas': 'Блоки «Server» підключені до replica',
        'primary-headroom': `Database завантажена не більше ніж на 80% при ${n(1600)} rps`,
        'holds-load': `Витримує ${n(1600)} rps з помилками менше 1%`,
        'spare-replica': 'Переживає відмову будь-якої однієї replica',
      },
      hints: [
        'Database завалена читанням, а на читання може відповісти будь-яка копія даних.',
        'Поставте два блоки «Read replica» праворуч від блоків «Server» і підключіть кожен server до обох. Зв’язки «Server → Database» залиште: лише ними йде запис.',
        'На дошці з’явився пунктирний контур. Поставте read replica туди й проведіть позначені зв’язки від кожного server.',
      ],
      solvedNote:
        'Запис іде в primary, читання ділиться на трьох, і відмова однієї replica більше не перевантажує database.',
    },
  },
} satisfies LessonTexts<typeof lesson>
