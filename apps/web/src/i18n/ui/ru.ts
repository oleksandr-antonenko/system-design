import { formatNumber } from '../format'
import { plural } from '../plural'
import type { UiStrings } from './types'

const inLanguage: UiStrings['inLanguage'] = {
  uk: 'на украинском',
  ru: 'на русском',
  en: 'на английском',
  lt: 'на литовском',
}

const kindName: UiStrings['kindName'] = {
  client: 'Пользователи',
  lb: 'Балансировщик',
  server: 'Сервер',
  db: 'База данных',
}

const n = (value: number) => formatNumber('ru', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`

export const ru = {
  courseTitle: 'System Design',
  courseTagline:
    'Интерактивный курс: теория на живой схеме и задачи своими руками',
  documentTitle: pageTitle => `${pageTitle} · System Design`,
  languageSwitcherLabel: 'Язык',
  inLanguage,
  kindName,
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
    moduleTitle: {
      foundations: 'Основы',
      scaling: 'Масштабирование',
      distributed: 'Надёжность и распределённость',
    },
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
    edgeFlow: rps => `${n(rps)} rps`,
    ghost: kind => `сюда: ${kindName[kind]}`,
  },
  hud: {
    load: 'Нагрузка',
    errors: 'Ошибки',
    p95: 'p95 ответа',
    database: 'Запросы к базе',
    cost: 'Цена',
    rps: value => `${n(value)} rps`,
    ms: value => `${n(value)} мс`,
    percent,
    perHour: dollars => `${dollars.toFixed(2).replace('.', ',')} $/ч`,
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
  },
  notFound: {
    title: 'Страница не найдена',
    body: path => `По адресу «${path}» ничего нет.`,
    backHome: 'К программе курса',
  },
  domain: {
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
      `При ${n(load)} rps теряется ${percent(errorRate)} запросов. Перегружены: ${overloaded.join(', ')}.`,
  },
} satisfies UiStrings
