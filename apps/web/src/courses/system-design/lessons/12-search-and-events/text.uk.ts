import type { SimResult } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('uk', Math.round(value))
const indexIn = (sim: SimResult) => sim.nodes['search']?.incoming ?? 0
const analyticsIn = (sim: SimResult) => sim.nodes['worker-1']?.incoming ?? 0

export default {
  title: 'Search index і event bus',
  summary:
    'Event bus доставляє кожну зміну в search index і в аналітику: publish/subscribe, lag subscriber і eventual consistency.',
  steps: {
    catalog: {
      title: 'Каталог',
      body: `Маркетплейс на мільйон товарів. На цій дошці кожен запит — це зміна каталогу: продавці змінюють ціни, залишки й описи, близько 150 змін на секунду. Продавці тут — блок [[users|Users]]. Їхні запити приймають два блоки «Server», [[app1|app1]] і [[app2|app2]], і кожна зміна зберігається в [[db|database]]. Як і в уроці 7, load balancer не намальовано, щоб вистачило місця.

Database — **source of truth** (джерело істини): якщо щось із нею розходиться, права database.`,
    },
    'stale-index': {
      title: 'Пошук відстає на добу',
      body: `Покупці шукають товари словами: «червона бавовняна сукня». Database дає з цим раду погано. Запит на кшталт LIKE '%червона сукня%' читає всю таблицю, мільйон рядків, і все одно не впорається з одруківками, формами слів і сортуванням за релевантністю. Тому пошук обслуговує окремий елемент системи.

**Search index** (українською — пошуковий індекс) — окреме сховище, побудоване саме під такі запити. Наприклад, Elasticsearch чи OpenSearch.

[[search|Search index]] уже є, але його перебудовують із копії database раз на добу, вночі. Удень зміни до нього не доходять: підпис показує 0 rps. Продавець підняв ціну о 10 ранку, а пошук до завтра показує стару. Покупець натискає «від 19 €» і бачить на сторінці товару 29 €.

Ті самі зміни потрібні й аналітикам: історія цін, які товари закінчуються, які продавці активні. Кожна зміна має потрапити одразу в кілька місць.`,
    },
    'publish-subscribe': {
      title: 'Publish/subscribe',
      body: `Як доставити зміну в search index і в аналітику? Є три шляхи.

**Server сам пише всюди.** Після збереження в database він ще оновлює search index і надсилає зміну в аналітику. Продавець чекає на всі три записи. Якщо search index недоступний, збереження або падає, або search index мовчки втрачає зміну. А кожен новий consumer — це зміна коду й нове розгортання server.

**Queue, як в уроці 7.** Server залишає повідомлення, consumers забирають його з queue. Але queue віддає кожне повідомлення **одному** worker і ділить роботу між ними. Якби search index і аналітика брали з однієї queue, кожен отримав би половину: зі 150 змін на секунду по 75. Половина цін у пошуку лишилася б старою, а звіти порахували б половину змін.

**Event bus** (українською — шина подій) — посередник, який роздає кожну подію всім, хто на неї підписаний. Server **публікує** (publish) одну подію «товар 42 змінено», а event bus віддає повну **копію** кожному **subscriber** (підписникові). Кожен читає у своєму темпі, а новий subscriber не чіпає коду server. Це шаблон **publish/subscribe** (pub/sub, «публікація й підписка»); так працює, наприклад, Kafka.`,
    },
    'connect-bus': {
      title: 'Задача: event bus',
      body: `Event bus та worker є в палітрі ліворуч від дошки. Публікувати зміни в event bus мають і app1, і app2. [[search|Search index]] підписується на event bus, а для аналітики потрібен новий subscriber — worker, який зводить зміни у звіти.

Зверніть увагу: аналітиці нічого не потрібно від servers, їй досить підписатися на event bus. Наступна команда зробить так само.`,
    },
    'lagging-subscriber': {
      title: 'Subscriber відстає',
      body: `Великий продавець завантажує свій каталог: двадцять хвилин поспіль **300 змін на секунду**. Event bus віддає кожному subscriber копію всіх 300.

[[search|Search index]] приймає всі: він тягне близько ${n(1500)}. [[worker-1|Worker]] аналітики встигає лише 200 на секунду, і решту 100 на секунду event bus тримає для нього. Це **lag** (відставання) subscriber, і на дошці його видно так само, як зростання queue. За двадцять хвилин аналітика відстане на ${n(120000)} подій. Нічого не губиться: event bus зберігає події (Kafka тримає їх днями), і worker дочитає їх із того місця, де зупинився. Після завантаження, за 150 змін на секунду, у нього буде запас у 50 на секунду, і він наздожене приблизно за 40 хвилин. Для звітів затримка в 40 хвилин прийнятна.

Зауважте: event bus не чекає на найповільнішого subscriber. Продавці зберігають зміни як зазвичай, а search index лишається свіжим. Другий worker аналітики, підписаний на event bus, не допоміг би: він отримав би власну повну копію й порахував би кожну зміну двічі. Щоб розділити потік одного subscriber між workers, у Kafka є **consumer groups** (групи споживачів): усередині групи події діляться, як у queue, а кожна група отримує свою копію.`,
    },
    'index-down': {
      title: 'Search index недоступний',
      body: `Завантаження закінчилося, навантаження повернулося до 150 rps. Тепер [[search|search index]] зупинили на оновлення версії, і зміни до нього не доходять. (Пошук для покупців поки обслуговує резервна копія, її на дошці немає.)

Якби server писав у search index сам, кожне збереження в продавців зараз падало б або зміна пропадала б для search index. З event bus продавці нічого не помічають: помилок немає. Event bus тримає для search index усі 150 подій на секунду, а [[worker-1|worker]] аналітики тим часом отримує свою копію як зазвичай.

Увесь цей час search index і database розходяться: пошук показує старі ціни. Навіть у звичайний день search index оновлюється трохи пізніше за database, за мілісекунди чи секунди. Це називають **eventual consistency** (узгодженість у кінцевому підсумку): копії зійдуться, але не тієї ж миті. Тому сторінка товару й оформлення замовлення беруть ціну з database, source of truth, а пошукові дозволено трохи відставати.`,
    },
    summary: {
      title: 'Підсумок',
      body: `Search index знову працює. Він дочитує пропущені події з event bus з того місця, де зупинився, і наздоганяє database: зрештою всі копії сходяться.

Servers публікують по одній події на зміну, а [[events-1|event bus]] роздає копію кожному subscriber: [[search|search index]] та [[worker-1|worker]] аналітики. Відмінність від уроку 7 — в одному слові. **Queue** ділить завдання між workers, і кожне завдання виконується один раз. **Event bus** копіює кожну подію всім subscribers, і кожен consumer бачить кожну зміну. Subscribers живуть незалежно: якщо один відстав чи впав, решти й продавців це не зачіпає.

Запис іде в database, а пошук читає з окремої моделі, зібраної з подій. Розділення моделі для запису й моделей для читання називають **CQRS** (Command Query Responsibility Segregation, розділення команд і запитів). Його ціна — eventual consistency: моделі для читання трохи відстають від source of truth.`,
    },
  },
  annotations: {
    sourceOfTruth: sim => `${n(sim.databaseLoad)} змін/с · source of truth`,
    staleIndex: sim => `${n(indexIn(sim))} rps · перебудова раз на добу`,
    wantsEveryChange: () => 'потрібна кожна зміна',
    indexKeepsUp: sim => `${n(indexIn(sim))} з ${n(1500)} rps · актуальний`,
    analyticsLag: sim => {
      const lag = sim.load - analyticsIn(sim)
      return lag >= 1
        ? `${n(analyticsIn(sim))} з ${n(sim.load)}/с · відстає +${n(lag)}/с`
        : `${n(analyticsIn(sim))}/с · встигає`
    },
    indexDown: () => 'зупинено на оновлення',
    busKeeps: sim =>
      sim.backlog >= 1
        ? `тримає +${n(sim.backlog)}/с на потім`
        : 'ніхто не чекає',
    caughtUp: sim => `${n(indexIn(sim))} rps · наздогнав database`,
    busCopies: sim => `${n(sim.load)}/с · копія кожному subscriber`,
  },
  tasks: {
    'connect-bus': {
      prompt:
        'Зробіть так, щоб кожна зміна потрапляла в search index і в аналітику через event bus.',
      goals: {
        'bus-exists': 'На дошці є event bus',
        'servers-publish': 'Кожен server публікує в event bus',
        'index-subscribed': 'Search index підписаний на event bus',
        'analytics-subscribed': 'Worker аналітики підписаний на event bus',
        'keeps-up': 'За 150 rps жоден subscriber не відстає',
      },
      hints: [
        'Server має оголосити про зміну один раз, а кожен consumer — отримати свою копію.',
        'Поставте event bus праворуч від servers і з’єднайте з нею app1 і app2. Потім проведіть зв’язки від event bus до search index і до нового блока «Worker».',
        'На дошці з’явився пунктирний контур. Поставте туди event bus і worker і проведіть позначені зв’язки.',
      ],
      solvedNote:
        'Кожна зміна потрапляє в event bus один раз, а search index і аналітика отримують по повній копії.',
    },
  },
} satisfies LessonTexts<typeof lesson>
