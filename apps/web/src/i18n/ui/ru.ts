import { Array } from 'effect'

import { type ComponentKind, componentName } from '../../domain/catalog'
import { formatNumber } from '../format'
import { plural } from '../plural'
import { deviceRu } from './device/ru'
import { packetBoardRu } from './packetBoard/ru'
import { panelRu } from './panel/ru'
import type { UiStrings } from './types'

const inLanguage: UiStrings['inLanguage'] = {
  uk: 'на украинском',
  ru: 'на русском',
  en: 'на английском',
  lt: 'на литовском',
}

const kindHint: UiStrings['kindHint'] = {
  client: 'Пользователи: люди и программы, которые отправляют запросы',
  cdn: 'Сеть доставки контента: отдаёт статические файлы с серверов рядом с пользователем',
  limiter: 'Ограничитель частоты запросов: отклоняет запросы сверх лимита',
  lb: 'Балансировщик нагрузки: раздаёт запросы между серверами',
  server: 'Сервер приложения: выполняет код и отвечает на запросы',
  cache: 'Кеш: хранит частые ответы в памяти и разгружает базу данных',
  queue: 'Очередь сообщений: копит задачи, пока их не заберут обработчики',
  events: 'Шина событий: доставляет каждое событие всем подписчикам',
  worker: 'Фоновый обработчик: выполняет задачи из очереди',
  db: 'База данных: хранит данные системы',
  replica: 'Реплика для чтения: копия базы данных, которая отвечает на чтение',
  search: 'Поисковый индекс: быстро находит записи по тексту',
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
  kinds.map(kind => componentName[kind]).join(', ')
const idList = (lead: string, ids: ReadonlyArray<string>) =>
  Array.isReadonlyArrayNonEmpty(ids) ? `${lead}${ids.join(', ')}.` : ''

export const ru = {
  siteTitle: 'Интерактивные курсы',
  siteTagline: 'Теория на живой схеме и задачи своими руками',
  courseSwitcherLabel: 'Курс',
  languageSwitcherLabel: 'Язык',
  inLanguage,
  kindHint,
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
    ghost: kind => `сюда: ${componentName[kind]}`,
    modePick: 'Вопрос · выберите на доске',
    loadHidden: 'нагрузка скрыта до ответа',
  },
  hud: {
    load: 'Нагрузка',
    errors: 'Ошибки',
    p95: 'p95 ответа',
    database: 'Запросы к database',
    rejected: 'Отклонено',
    backlog: 'Queue растёт',
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
    resultServers: 'Загрузка servers',
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
  },
  device: deviceRu,
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
    SendNeedsIp: () =>
      'Впишите IP address: четыре числа через точку, например 192.168.1.10.',
    ConnectSelf: () => 'Блок нельзя соединить с самим собой.',
    ConnectDuplicate: () => 'Такая связь уже есть.',
    ConnectIntoClients: () =>
      'В блок «Users» запросы не входят: это источник трафика.',
    ConnectClientsToDatabase: () =>
      '«Users» не ходят в «Database» напрямую. Между ними должен стоять «Server».',
    ConnectServerToServer: () =>
      'Блоки «Server» не передают запросы друг другу. Распределять нагрузку должен «Load balancer».',
    ConnectBalancerToDatabase: () =>
      '«Load balancer» раздаёт запросы блокам «Server», а не «Database».',
    ConnectWrongDirection: () =>
      'Запросы идут слева направо: Users, Load balancer, Server, Database.',
    NodeIsPartOfTask: ({ id }) =>
      `Блок ${id} входит в условие задачи, его нельзя удалить.`,
    UnknownNode: ({ id }) => `Блока ${id} нет на доске.`,
    DuplicateNodeId: ({ id }) => `Блок с именем ${id} уже есть.`,
    GoalMissingKind: ({ kind }) =>
      `На доске пока нет блока «${componentName[kind]}». Он в палитре слева.`,
    GoalTooFewTargets: ({ from, to, have, need }) =>
      `Связей от «${componentName[from]}» к блокам «${componentName[to]}»: ${n(have)} из ${n(need)}. Протяните недостающие.`,
    GoalDirectPath: ({ from, via, targets }) =>
      `«${componentName[from]}» ходят на ${targets.join(', ')} напрямую, мимо блока «${componentName[via]}». Нажмите на подсвеченную связь и удалите её.`,
    GoalNotConnected: ({ from, via }) =>
      `Нет связи от «${componentName[from]}» к блоку «${componentName[via]}»: запросам некуда идти.`,
    GoalTooManyErrors: ({ load, errorRate, overloaded }) =>
      `При ${n(load)} rps теряется ${percent(errorRate)} запросов. Теряют запросы: ${overloaded.join(', ')}.`,
    ConnectFromSink: ({ from }) =>
      `На блоке «${componentName[from]}» путь запроса заканчивается: дальше он ничего не передаёт.`,
    ConnectNotAllowed: ({ from, to, allowed }) =>
      `«${componentName[from]}» не передаёт запросы блоку «${componentName[to]}». Допустимые связи: ${kindList(allowed)}.`,
    InvalidCapacity: ({ id }) => `Блоку ${id} нужна ёмкость больше нуля.`,
    RegionHasNoBlocks: ({ region }) =>
      `В регионе «${regionName[region]}» нет блоков.`,
    GoalSlowResponse: ({ load, p95, max, hottest }) =>
      `При ${n(load)} rps p95 — ${n(p95)} мс, выше порога ${n(max)} мс.${idList(' Самый загруженный блок: ', hottest)}`,
    GoalOverUtilized: ({ kind, load, utilization, max, nodes }) =>
      `При ${n(load)} rps блоки «${componentName[kind]}» загружены до ${percent(utilization)}, выше порога ${percent(max)}: ${nodes.join(', ')}.`,
    GoalBacklogGrowing: ({ load, backlog, max, nodes }) =>
      `При ${n(load)} rps queues растут на ${n(backlog)} rps, допустимо ${n(max)} rps.${idList(' Не успевают: ', nodes)}`,
    GoalTooExpensive: ({ cost, max }) =>
      `Система стоит ${perHour(cost)}, это дороже бюджета ${perHour(max)}.`,
    GoalFailureNotSurvived: ({ id, kind, load, errorRate, max }) =>
      `При отказе ${id} («${componentName[kind]}») и нагрузке ${n(load)} rps теряется ${percent(errorRate)} запросов, допустимо не больше ${percent(max)}.`,
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
