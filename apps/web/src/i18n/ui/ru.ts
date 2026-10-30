import { Array } from 'effect'

import type { ComponentKind } from '../../domain/catalog'
import { formatNumber } from '../format'
import { plural } from '../plural'
import { panelRu } from './panel/ru'
import { packetBoardRu } from './packetBoard/ru'
import type { UiStrings } from './types'

const inLanguage: UiStrings['inLanguage'] = {
  uk: 'на украинском',
  ru: 'на русском',
  en: 'на английском',
  lt: 'на литовском',
}

const kindName: UiStrings['kindName'] = {
  client: 'Пользователи',
  cdn: 'CDN',
  limiter: 'Ограничитель',
  lb: 'Балансировщик',
  server: 'Сервер',
  cache: 'Кеш',
  queue: 'Очередь',
  events: 'Шина событий',
  worker: 'Обработчик',
  db: 'База данных',
  replica: 'Реплика базы',
  search: 'Поисковый индекс',
}

const regionName: UiStrings['regionName'] = {
  eu: 'Европа',
  us: 'США',
  asia: 'Азия',
}

const n = (value: number) => formatNumber('ru', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`
const perHour = (dollars: number) =>
  `${dollars.toFixed(2).replace('.', ',')} $/ч`
const kindList = (kinds: ReadonlyArray<ComponentKind>) =>
  kinds.map(kind => kindName[kind]).join(', ')
const idList = (lead: string, ids: ReadonlyArray<string>) =>
  Array.isReadonlyArrayNonEmpty(ids) ? `${lead}${ids.join(', ')}.` : ''

export const ru = {
  siteTitle: 'Интерактивные курсы',
  siteTagline: 'Теория на живой схеме и задачи своими руками',
  courseSwitcherLabel: 'Курс',
  languageSwitcherLabel: 'Язык',
  inLanguage,
  kindName,
  regionName,
  home: {
    heading: 'Программа курса',
    lessonCount: count =>
      `${formatNumber('ru', count)} ${plural('ru', count, {
        one: 'урок',
        few: 'урока',
        many: 'уроков',
        other: 'урока',
      })}`,
    lessonNumber: order => `Урок ${formatNumber('ru', order)}`,
    comingSoon: 'Скоро',
  },
  lesson: {
    backToCourse: 'К программе курса',
    theoryRegion: 'Теория',
    boardRegion: 'Доска',
    instrumentsRegion: 'Приборы',
    theoryPlaceholder: 'Урок ещё готовится. Здесь появятся шаги теории.',
    boardPlaceholder: 'Здесь будет доска со схемой системы.',
    instrumentsPlaceholder: 'Здесь будут нагрузка, ошибки и время ответа.',
  },
  board: {
    label: 'Схема системы',
    paletteTitle: 'Палитра',
    laterTitle: 'Позже в курсе',
    paletteClosed: 'Откроется в задаче',
    paletteHint: 'Перетащите на доску или нажмите, чтобы добавить',
    lockedUntilLesson: order => `урок ${order}`,
    newBadge: 'новое',
    capacityTag: rps => `до ${n(rps)} rps`,
    modeView: 'Доска следует за текстом',
    modeEdit: 'Задача · доска ваша',
    modeReplay: 'Показываю решение…',
    deleteEdge: 'Удалить связь',
    deleteNode: 'Удалить блок',
    connectHint: 'Потяните, чтобы соединить',
    nodeLoad: (rps, utilization) => `${n(rps)} rps · ${percent(utilization)}`,
    clientsLoad: rps => `${n(rps)} rps →`,
    nodeDown: 'недоступен',
    queueGrowing: rps => `растёт +${n(rps)}/с`,
    rejecting: rps => `отклонено ${n(rps)}/с`,
    zoneDown: region => `${regionName[region]} · регион недоступен`,
    edgeFlow: rps => `${n(rps)} rps`,
    ghost: kind => `сюда: ${kindName[kind]}`,
    modePick: 'Вопрос · выберите на доске',
    loadHidden: 'нагрузка скрыта до ответа',
  },
  hud: {
    load: 'Нагрузка',
    errors: 'Ошибки',
    p95: 'p95 ответа',
    database: 'Запросы к базе',
    rejected: 'Отклонено',
    backlog: 'Очередь растёт',
    cost: 'Цена',
    rps: value => `${n(value)} rps`,
    growth: value => `+${n(value)} rps`,
    ms: value => `${n(value)} мс`,
    percent,
    perHour,
    pause: 'Пауза',
    play: 'Трафик',
    speed: 'Скорость',
    undo: 'Отменить',
    redo: 'Повторить',
    reset: 'Сбросить доску',
    journal: 'Журнал операций',
    legendOk: 'запрос обработан',
    legendHot: 'блок почти на пределе',
    legendLost: 'запрос потерян',
    modelNote: 'Модель, цифры условные',
  },
  player: {
    stepOf: (step, total) => `Шаг ${step} из ${total}`,
    step: step => `Шаг ${step}`,
    prev: '← Назад',
    next: 'Далее →',
    nextTo: stepTitle => `Далее: ${stepTitle} →`,
    navHint: 'Стрелки ← → тоже работают',
    solveFirst: 'Решите задачу на доске, чтобы продолжить',
    lessonEnd: 'Конец урока',
    revisit: 'Вернуться к этому шагу',
    journalScript: stepTitle => `Сценарий шага «${stepTitle}»`,
    journalMine: 'Ваши ходы в задаче',
    journalScriptEmpty: 'На этом шаге доска не меняется.',
    journalMineEmpty: 'Пока пусто. Ходы появятся, когда начнёте задачу.',
    journalNote:
      'Доска на любом шаге получается применением этих операций с начала урока. Демонстрации и ходы ученика записываются одним языком, поэтому работают перемотка, отмена и «Показать решение».',
    finishedTitle: 'Урок пройден',
    finishedBody: 'Следующие уроки появятся в программе курса.',
    answerFirst: 'Сначала ответьте на вопрос',
    moreBadge: 'для любопытных',
    askAiTitle: 'Как спросить ИИ',
    copy: 'Скопировать',
    copied: 'Скопировано',
  },
  task: {
    heading: 'Задача на доске',
    solved: 'Решено',
    solvedWithHint: 'Решено с подсказкой',
    attempts: count => `попыток: ${n(count)}`,
    howTo:
      'Перетащите блок из палитры на доску. Связь тянется из кружка на правом краю блока. Чтобы удалить связь, нажмите на неё, затем на красный крестик.',
    hiddenGoal: 'Ещё один критерий проверяется прогоном нагрузки',
    metricGoal: load => `Держит ${n(load)} rps с ошибками меньше 1%`,
    metricGoalPassed: (load, errorRate) =>
      `Держит ${n(load)} rps, ошибок ${percent(errorRate)}`,
    check: 'Проверить',
    hint: (shown, total) => `Подсказка · ${shown} из ${total}`,
    showSolution: 'Показать решение',
    resultErrors: 'Ошибки',
    resultP95: 'p95 ответа',
    resultServers: 'Загрузка серверов',
    resultCost: 'Цена',
    continueLesson: 'Дальше →',
    surfaces: 'Где решать задачу',
  },
  quiz: {
    heading: 'Вопрос',
    correct: 'Верно с первой попытки',
    incorrect: 'Не совсем',
    oneAttempt: 'Попытка одна: после неё покажем ответ и объяснение.',
    pickOnBoard: 'Нажмите ответ на доске. С клавиатуры: Tab до него и Enter.',
    choices: 'Варианты ответа',
    answerWas: answer => `Правильный ответ: ${answer}`,
  },
  network: {
    boardLabel: 'Схема сети',
    placeholder: 'Доска сети в разработке: пока здесь только список устройств.',
    run: 'Пуск',
    wifiTab: device => `Wi-Fi: ${device}`,
    wifiNetworks: 'Сети рядом',
    wifiNone: 'Рядом нет сетей Wi-Fi.',
    wifiPassword: 'Пароль',
    wifiJoin: 'Подключиться',
    wifiJoined: ssid => `Подключено к сети «${ssid}»`,
  },
  panel: panelRu,
  packetBoard: packetBoardRu,
  notFound: {
    title: 'Страница не найдена',
    body: path => `По адресу «${path}» ничего нет.`,
    backHome: 'К списку курсов',
  },
  domain: {
    UnknownCourse: ({ course }) => `Курса «${course}» нет.`,
    UnknownLesson: ({ slug }) => `Урока «${slug}» нет в курсе.`,
    LessonNotTranslated: ({ shownIn }) =>
      `Этот урок ещё не переведён на русский, поэтому показываем его ${inLanguage[shownIn]}.`,
    ConnectSelf: () => 'Блок нельзя соединить с самим собой.',
    ConnectDuplicate: () => 'Такая связь уже есть.',
    ConnectIntoClients: () =>
      'В пользователей запросы не входят: они источник трафика.',
    ConnectClientsToDatabase: () =>
      'Пользователи не ходят в базу напрямую. Между ними должен стоять сервер.',
    ConnectServerToServer: () =>
      'Серверы не передают запросы друг другу. Распределять нагрузку должен балансировщик.',
    ConnectBalancerToDatabase: () =>
      'Балансировщик раздаёт запросы серверам, а не базе.',
    ConnectWrongDirection: () =>
      'Запросы идут слева направо: пользователи, балансировщик, серверы, база.',
    NodeIsPartOfTask: ({ id }) =>
      `Блок ${id} входит в условие задачи, его нельзя удалить.`,
    UnknownNode: ({ id }) => `Блока ${id} нет на доске.`,
    DuplicateNodeId: ({ id }) => `Блок с именем ${id} уже есть.`,
    GoalMissingKind: ({ kind }) =>
      `На доске пока нет блока «${kindName[kind]}». Он в палитре слева.`,
    GoalTooFewTargets: ({ from, to, have, need }) =>
      `Связей от «${kindName[from]}» к блокам «${kindName[to]}»: ${n(have)} из ${n(need)}. Протяните недостающие.`,
    GoalDirectPath: ({ from, via, targets }) =>
      `«${kindName[from]}» ходят на ${targets.join(', ')} напрямую, мимо блока «${kindName[via]}». Нажмите на подсвеченную связь и удалите её.`,
    GoalNotConnected: ({ from, via }) =>
      `Нет связи от «${kindName[from]}» к блоку «${kindName[via]}»: запросам некуда идти.`,
    GoalTooManyErrors: ({ load, errorRate, overloaded }) =>
      `При ${n(load)} rps теряется ${percent(errorRate)} запросов. Теряют запросы: ${overloaded.join(', ')}.`,
    ConnectFromSink: ({ from }) =>
      `На блоке «${kindName[from]}» путь запроса заканчивается: дальше он ничего не передаёт.`,
    ConnectNotAllowed: ({ from, to, allowed }) =>
      `«${kindName[from]}» не передаёт запросы блоку «${kindName[to]}». Допустимые связи: ${kindList(allowed)}.`,
    InvalidCapacity: ({ id }) => `Блоку ${id} нужна ёмкость больше нуля.`,
    RegionHasNoBlocks: ({ region }) =>
      `В регионе «${regionName[region]}» нет блоков.`,
    GoalSlowResponse: ({ load, p95, max, hottest }) =>
      `При ${n(load)} rps p95 — ${n(p95)} мс, выше порога ${n(max)} мс.${idList(' Самый загруженный блок: ', hottest)}`,
    GoalOverUtilized: ({ kind, load, utilization, max, nodes }) =>
      `При ${n(load)} rps блоки «${kindName[kind]}» загружены до ${percent(utilization)}, выше порога ${percent(max)}: ${nodes.join(', ')}.`,
    GoalBacklogGrowing: ({ load, backlog, max, nodes }) =>
      `При ${n(load)} rps очереди растут на ${n(backlog)} rps, допустимо ${n(max)} rps.${idList(' Не успевают: ', nodes)}`,
    GoalTooExpensive: ({ cost, max }) =>
      `Система стоит ${perHour(cost)}, это дороже бюджета ${perHour(max)}.`,
    GoalFailureNotSurvived: ({ id, kind, load, errorRate, max }) =>
      `При отказе ${id} («${kindName[kind]}») и нагрузке ${n(load)} rps теряется ${percent(errorRate)} запросов, допустимо не больше ${percent(max)}.`,
    GoalRegionFailureNotSurvived: ({
      region,
      load,
      errorRate,
      max,
      overloaded,
    }) =>
      `При отказе региона «${regionName[region]}» и нагрузке ${n(load)} rps теряется ${percent(errorRate)} запросов, допустимо не больше ${percent(max)}.${idList(' Теряют запросы: ', overloaded)}`,
  },
} satisfies UiStrings
