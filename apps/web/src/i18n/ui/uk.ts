import { Array } from 'effect'

import type { ComponentKind } from '../../domain/catalog'
import { formatNumber } from '../format'
import { plural } from '../plural'
import { deviceUk } from './device/uk'
import { panelUk } from './panel/uk'
import { packetBoardUk } from './packetBoard/uk'
import type { UiStrings } from './types'

const inLanguage: UiStrings['inLanguage'] = {
  uk: 'українською',
  ru: 'російською',
  en: 'англійською',
  lt: 'литовською',
}

const kindName: UiStrings['kindName'] = {
  client: 'Користувачі',
  cdn: 'CDN',
  limiter: 'Обмежувач',
  lb: 'Балансувальник',
  server: 'Сервер',
  cache: 'Кеш',
  queue: 'Черга',
  events: 'Шина подій',
  worker: 'Обробник',
  db: 'База даних',
  replica: 'Репліка бази',
  search: 'Пошуковий індекс',
}

const regionName: UiStrings['regionName'] = {
  eu: 'Європа',
  us: 'США',
  asia: 'Азія',
}

const n = (value: number) => formatNumber('uk', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`
const perHour = (dollars: number) =>
  `${dollars.toFixed(2).replace('.', ',')} $/год`
const kindList = (kinds: ReadonlyArray<ComponentKind>) =>
  kinds.map(kind => kindName[kind]).join(', ')
const idList = (lead: string, ids: ReadonlyArray<string>) =>
  Array.isReadonlyArrayNonEmpty(ids) ? `${lead}${ids.join(', ')}.` : ''

export const uk = {
  siteTitle: 'Інтерактивні курси',
  siteTagline: 'Теорія на живій схемі та задачі власноруч',
  courseSwitcherLabel: 'Курс',
  languageSwitcherLabel: 'Мова',
  inLanguage,
  kindName,
  regionName,
  home: {
    heading: 'Програма курсу',
    lessonCount: count =>
      `${formatNumber('uk', count)} ${plural('uk', count, {
        one: 'урок',
        few: 'уроки',
        many: 'уроків',
        other: 'уроку',
      })}`,
    lessonNumber: order => `Урок ${formatNumber('uk', order)}`,
    comingSoon: 'Скоро',
  },
  lesson: {
    backToCourse: 'До програми курсу',
    theoryRegion: 'Теорія',
    boardRegion: 'Дошка',
    instrumentsRegion: 'Прилади',
    theoryPlaceholder: 'Урок ще готується. Тут з’являться кроки теорії.',
    boardPlaceholder: 'Тут буде дошка зі схемою системи.',
    instrumentsPlaceholder:
      'Тут будуть навантаження, помилки та час відповіді.',
  },
  board: {
    label: 'Схема системи',
    paletteTitle: 'Палітра',
    laterTitle: 'Пізніше в курсі',
    paletteClosed: 'Відкриється в задачі',
    paletteHint: 'Перетягніть на дошку або натисніть, щоб додати',
    lockedUntilLesson: order => `урок ${order}`,
    newBadge: 'нове',
    capacityTag: rps => `до ${n(rps)} rps`,
    modeView: 'Дошка йде за текстом',
    modeEdit: 'Задача · дошка ваша',
    modeReplay: 'Показую розв’язок…',
    deleteEdge: 'Видалити зв’язок',
    deleteNode: 'Видалити блок',
    connectHint: 'Потягніть, щоб з’єднати',
    nodeLoad: (rps, utilization) => `${n(rps)} rps · ${percent(utilization)}`,
    clientsLoad: rps => `${n(rps)} rps →`,
    nodeDown: 'недоступний',
    queueGrowing: rps => `росте +${n(rps)}/с`,
    rejecting: rps => `відхилено ${n(rps)}/с`,
    zoneDown: region => `${regionName[region]} · регіон недоступний`,
    edgeFlow: rps => `${n(rps)} rps`,
    ghost: kind => `сюди: ${kindName[kind]}`,
    modePick: 'Питання · оберіть на дошці',
    loadHidden: 'навантаження приховане до відповіді',
  },
  hud: {
    load: 'Навантаження',
    errors: 'Помилки',
    p95: 'p95 відповіді',
    database: 'Запити до бази',
    rejected: 'Відхилено',
    backlog: 'Черга росте',
    cost: 'Ціна',
    rps: value => `${n(value)} rps`,
    growth: value => `+${n(value)} rps`,
    ms: value => `${n(value)} мс`,
    percent,
    perHour,
    pause: 'Пауза',
    play: 'Трафік',
    speed: 'Швидкість',
    undo: 'Скасувати',
    redo: 'Повторити',
    reset: 'Скинути дошку',
    journal: 'Журнал операцій',
    legendOk: 'запит оброблено',
    legendHot: 'блок майже на межі',
    legendLost: 'запит втрачено',
    modelNote: 'Модель, цифри умовні',
  },
  player: {
    stepOf: (step, total) => `Крок ${step} з ${total}`,
    step: step => `Крок ${step}`,
    prev: '← Назад',
    next: 'Далі →',
    nextTo: stepTitle => `Далі: ${stepTitle} →`,
    navHint: 'Стрілки ← → теж працюють',
    solveFirst: 'Розв’яжіть задачу на дошці, щоб продовжити',
    lessonEnd: 'Кінець уроку',
    revisit: 'Повернутися до цього кроку',
    journalScript: stepTitle => `Сценарій кроку «${stepTitle}»`,
    journalMine: 'Ваші ходи в задачі',
    journalScriptEmpty: 'На цьому кроці дошка не змінюється.',
    journalMineEmpty: 'Поки порожньо. Ходи з’являться, коли почнете задачу.',
    journalNote:
      'Дошка на будь-якому кроці — це результат застосування цих операцій від початку уроку. Демонстрації та ходи учня записуються однією мовою, тому працюють перемотування, скасування і «Показати розв’язок».',
    finishedTitle: 'Урок пройдено',
    finishedBody: 'Наступні уроки з’являться в програмі курсу.',
    answerFirst: 'Спершу дайте відповідь на питання',
    moreBadge: 'для допитливих',
    askAiTitle: 'Як запитати ШІ',
    copy: 'Скопіювати',
    copied: 'Скопійовано',
  },
  task: {
    heading: 'Задача на дошці',
    solved: 'Розв’язано',
    solvedWithHint: 'Розв’язано з підказкою',
    attempts: count => `спроб: ${n(count)}`,
    howTo:
      'Перетягніть блок із палітри на дошку. Зв’язок тягнеться з кружечка на правому краї блока. Щоб видалити зв’язок, натисніть на нього, потім на червоний хрестик.',
    hiddenGoal: 'Ще один критерій перевіряється прогоном навантаження',
    metricGoal: load => `Витримує ${n(load)} rps з помилками менше 1%`,
    metricGoalPassed: (load, errorRate) =>
      `Витримує ${n(load)} rps, помилок ${percent(errorRate)}`,
    check: 'Перевірити',
    hint: (shown, total) => `Підказка · ${shown} з ${total}`,
    showSolution: 'Показати розв’язок',
    resultErrors: 'Помилки',
    resultP95: 'p95 відповіді',
    resultServers: 'Завантаження серверів',
    resultCost: 'Ціна',
    continueLesson: 'Далі →',
    surfaces: 'Де розв’язувати задачу',
  },
  quiz: {
    heading: 'Питання',
    correct: 'Правильно з першої спроби',
    incorrect: 'Не зовсім',
    oneAttempt: 'Спроба одна: після неї покажемо відповідь і пояснення.',
    pickOnBoard:
      'Натисніть відповідь на дошці. З клавіатури: Tab до неї та Enter.',
    choices: 'Варіанти відповіді',
    answerWas: answer => `Правильна відповідь: ${answer}`,
  },
  network: {
    boardLabel: 'Схема мережі',
    placeholder: 'Дошка мережі в розробці: поки що тут лише список пристроїв.',
    run: 'Пуск',
  },
  device: deviceUk,
  panel: panelUk,
  packetBoard: packetBoardUk,
  notFound: {
    title: 'Сторінку не знайдено',
    body: path => `За адресою «${path}» нічого немає.`,
    backHome: 'До списку курсів',
  },
  domain: {
    UnknownCourse: ({ course }) => `Курсу «${course}» немає.`,
    UnknownLesson: ({ slug }) => `Уроку «${slug}» немає в курсі.`,
    LessonNotTranslated: ({ shownIn }) =>
      `Цей урок ще не перекладено українською, тому показуємо його ${inLanguage[shownIn]}.`,
    ConnectSelf: () => 'Блок не можна з’єднати із самим собою.',
    ConnectDuplicate: () => 'Такий зв’язок уже є.',
    ConnectIntoClients: () =>
      'У користувачів запити не входять: вони джерело трафіку.',
    ConnectClientsToDatabase: () =>
      'Користувачі не ходять у базу напряму. Між ними має стояти сервер.',
    ConnectServerToServer: () =>
      'Сервери не передають запити один одному. Розподіляти навантаження має балансувальник.',
    ConnectBalancerToDatabase: () =>
      'Балансувальник роздає запити серверам, а не базі.',
    ConnectWrongDirection: () =>
      'Запити йдуть зліва направо: користувачі, балансувальник, сервери, база.',
    NodeIsPartOfTask: ({ id }) =>
      `Блок ${id} входить в умову задачі, його не можна видалити.`,
    UnknownNode: ({ id }) => `Блока ${id} немає на дошці.`,
    DuplicateNodeId: ({ id }) => `Блок з іменем ${id} уже є.`,
    GoalMissingKind: ({ kind }) =>
      `На дошці поки немає блока «${kindName[kind]}». Він у палітрі зліва.`,
    GoalTooFewTargets: ({ from, to, have, need }) =>
      `Зв’язків від «${kindName[from]}» до блоків «${kindName[to]}»: ${n(have)} з ${n(need)}. Протягніть відсутні.`,
    GoalDirectPath: ({ from, via, targets }) =>
      `«${kindName[from]}» ходять на ${targets.join(', ')} напряму, повз блок «${kindName[via]}». Натисніть на підсвічений зв’язок і видаліть його.`,
    GoalNotConnected: ({ from, via }) =>
      `Немає зв’язку від «${kindName[from]}» до блока «${kindName[via]}»: запитам нікуди йти.`,
    GoalTooManyErrors: ({ load, errorRate, overloaded }) =>
      `При ${n(load)} rps втрачається ${percent(errorRate)} запитів. Втрачають запити: ${overloaded.join(', ')}.`,
    ConnectFromSink: ({ from }) =>
      `На блоці «${kindName[from]}» шлях запиту закінчується: далі він нічого не передає.`,
    ConnectNotAllowed: ({ from, to, allowed }) =>
      `«${kindName[from]}» не передає запити блоку «${kindName[to]}». Допустимі зв’язки: ${kindList(allowed)}.`,
    InvalidCapacity: ({ id }) =>
      `Блоку ${id} потрібна пропускна здатність більша за нуль.`,
    RegionHasNoBlocks: ({ region }) =>
      `У регіоні «${regionName[region]}» немає блоків.`,
    GoalSlowResponse: ({ load, p95, max, hottest }) =>
      `При ${n(load)} rps p95 — ${n(p95)} мс, вище порогу ${n(max)} мс.${idList(' Найбільш завантажений блок: ', hottest)}`,
    GoalOverUtilized: ({ kind, load, utilization, max, nodes }) =>
      `При ${n(load)} rps блоки «${kindName[kind]}» завантажені до ${percent(utilization)}, вище порогу ${percent(max)}: ${nodes.join(', ')}.`,
    GoalBacklogGrowing: ({ load, backlog, max, nodes }) =>
      `При ${n(load)} rps черги ростуть на ${n(backlog)} rps, допустимо ${n(max)} rps.${idList(' Не встигають: ', nodes)}`,
    GoalTooExpensive: ({ cost, max }) =>
      `Система коштує ${perHour(cost)}, це дорожче за бюджет ${perHour(max)}.`,
    GoalFailureNotSurvived: ({ id, kind, load, errorRate, max }) =>
      `Після відмови ${id} («${kindName[kind]}») при навантаженні ${n(load)} rps втрачається ${percent(errorRate)} запитів, допустимо не більше ${percent(max)}.`,
    GoalRegionFailureNotSurvived: ({
      region,
      load,
      errorRate,
      max,
      overloaded,
    }) =>
      `Після відмови регіону «${regionName[region]}» при навантаженні ${n(load)} rps втрачається ${percent(errorRate)} запитів, допустимо не більше ${percent(max)}.${idList(' Втрачають запити: ', overloaded)}`,
  },
} satisfies UiStrings
