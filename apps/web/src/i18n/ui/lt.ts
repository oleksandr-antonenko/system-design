import { formatNumber } from '../format'
import { plural } from '../plural'
import type { UiStrings } from './types'

const inLanguage: UiStrings['inLanguage'] = {
  uk: 'ukrainiečių kalba',
  ru: 'rusų kalba',
  en: 'anglų kalba',
  lt: 'lietuvių kalba',
}

const kindName: UiStrings['kindName'] = {
  client: 'Naudotojai',
  lb: 'Balansuotuvas',
  server: 'Serveris',
  db: 'Duomenų bazė',
}

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`

export const lt = {
  courseTitle: 'System Design',
  courseTagline:
    'Interaktyvus kursas: teorija gyvoje schemoje ir praktinės užduotys',
  documentTitle: pageTitle => `${pageTitle} · System Design`,
  languageSwitcherLabel: 'Kalba',
  inLanguage,
  kindName,
  home: {
    heading: 'Kurso programa',
    lessonCount: count =>
      `${formatNumber('lt', count)} ${plural('lt', count, {
        one: 'pamoka',
        few: 'pamokos',
        many: 'pamokos',
        other: 'pamokų',
      })}`,
    lessonNumber: order => `${formatNumber('lt', order)} pamoka`,
    comingSoon: 'Netrukus',
    moduleTitle: {
      foundations: 'Pagrindai',
      scaling: 'Mastelio didinimas',
      distributed: 'Patikimumas ir paskirstytos sistemos',
    },
  },
  lesson: {
    backToCourse: 'Atgal į kurso programą',
    theoryRegion: 'Teorija',
    boardRegion: 'Lenta',
    instrumentsRegion: 'Prietaisai',
    theoryPlaceholder: 'Pamoka dar ruošiama. Čia atsiras teorijos žingsniai.',
    boardPlaceholder: 'Čia bus lenta su sistemos schema.',
    instrumentsPlaceholder: 'Čia bus apkrova, klaidos ir atsako laikas.',
  },
  board: {
    label: 'Sistemos schema',
    paletteTitle: 'Paletė',
    laterTitle: 'Vėliau kurse',
    paletteClosed: 'Atsivers užduotyje',
    paletteHint: 'Nuvilkite ant lentos arba spustelėkite, kad pridėtumėte',
    upcomingName: {
      cache: 'Podėlis',
      cdn: 'CDN',
      queue: 'Eilė',
      shard: 'Šardai',
    },
    lockedUntilLesson: order => `${order} pamoka`,
    newBadge: 'nauja',
    capacityTag: rps => `iki ${n(rps)} rps`,
    modeView: 'Lenta seka tekstą',
    modeEdit: 'Užduotis · lenta jūsų',
    modeReplay: 'Rodomas sprendimas…',
    deleteEdge: 'Ištrinti ryšį',
    deleteNode: 'Ištrinti bloką',
    connectHint: 'Vilkite, kad sujungtumėte',
    nodeLoad: (rps, utilization) => `${n(rps)} rps · ${percent(utilization)}`,
    clientsLoad: rps => `${n(rps)} rps →`,
    nodeDown: 'nepasiekiamas',
    edgeFlow: rps => `${n(rps)} rps`,
    ghost: kind => `čia: ${kindName[kind]}`,
  },
  hud: {
    load: 'Apkrova',
    errors: 'Klaidos',
    p95: 'p95 atsakas',
    database: 'Užklausos į bazę',
    cost: 'Kaina',
    rps: value => `${n(value)} rps`,
    ms: value => `${n(value)} ms`,
    percent,
    perHour: dollars => `${dollars.toFixed(2).replace('.', ',')} $/val.`,
    pause: 'Pauzė',
    play: 'Srautas',
    speed: 'Greitis',
    undo: 'Atšaukti',
    redo: 'Pakartoti',
    reset: 'Atstatyti lentą',
    journal: 'Operacijų žurnalas',
    legendOk: 'užklausa apdorota',
    legendHot: 'blokas beveik ties riba',
    legendLost: 'užklausa prarasta',
    modelNote: 'Modelis, skaičiai sąlyginiai',
  },
  player: {
    stepOf: (step, total) => `${step} žingsnis iš ${total}`,
    step: step => `${step} žingsnis`,
    prev: '← Atgal',
    next: 'Toliau →',
    navHint: 'Veikia ir klavišai ← →',
    solveFirst: 'Išspręskite užduotį lentoje, kad galėtumėte tęsti',
    lessonEnd: 'Pamokos pabaiga',
    revisit: 'Grįžti į šį žingsnį',
    journalScript: stepTitle => `Žingsnio „${stepTitle}“ scenarijus`,
    journalMine: 'Jūsų ėjimai užduotyje',
    journalScriptEmpty: 'Šiame žingsnyje lenta nesikeičia.',
    journalMineEmpty: 'Kol kas tuščia. Ėjimai atsiras, kai pradėsite užduotį.',
    journalNote:
      'Lenta bet kuriame žingsnyje – tai šios operacijos, pritaikytos nuo pamokos pradžios. Demonstracijos ir jūsų ėjimai užrašomi viena kalba, todėl veikia persukimas, atšaukimas ir „Rodyti sprendimą“.',
    finishedTitle: 'Pamoka baigta',
    finishedBody: 'Kitos pamokos atsiras kurso programoje.',
  },
  task: {
    heading: 'Užduotis lentoje',
    solved: 'Išspręsta',
    solvedWithHint: 'Išspręsta su užuomina',
    attempts: count => `bandymų: ${n(count)}`,
    howTo:
      'Nuvilkite bloką iš paletės į lentą. Ryšys tempiamas nuo apskritimo dešiniajame bloko krašte. Norėdami ištrinti ryšį, spustelėkite jį, tada raudoną kryželį.',
    hiddenGoal: 'Dar vienas kriterijus tikrinamas paleidus apkrovą',
    metricGoal: load => `Atlaiko ${n(load)} rps, kai klaidų mažiau nei 1 %`,
    metricGoalPassed: (load, errorRate) =>
      `Atlaiko ${n(load)} rps, klaidų ${percent(errorRate)}`,
    check: 'Tikrinti',
    hint: (shown, total) => `Užuomina · ${shown} iš ${total}`,
    showSolution: 'Rodyti sprendimą',
    resultErrors: 'Klaidos',
    resultP95: 'p95 atsakas',
    resultServers: 'Serverių apkrova',
    resultCost: 'Kaina',
    continueLesson: 'Toliau →',
  },
  notFound: {
    title: 'Puslapis nerastas',
    body: path => `Adresu „${path}“ nieko nėra.`,
    backHome: 'Atgal į kurso programą',
  },
  domain: {
    UnknownLesson: ({ slug }) => `Kurse nėra pamokos „${slug}“.`,
    LessonNotTranslated: ({ shownIn }) =>
      `Ši pamoka dar neišversta į lietuvių kalbą, todėl rodoma ${inLanguage[shownIn]}.`,
    ConnectSelf: () => 'Bloko negalima sujungti su pačiu savimi.',
    ConnectDuplicate: () => 'Toks ryšys jau yra.',
    ConnectIntoClients: () =>
      'Į naudotojus užklausos neateina: jie yra srauto šaltinis.',
    ConnectClientsToDatabase: () =>
      'Naudotojai nesikreipia į bazę tiesiogiai. Tarp jų turi būti serveris.',
    ConnectServerToServer: () =>
      'Serveriai neperduoda užklausų vieni kitiems. Apkrovą paskirsto balansuotuvas.',
    ConnectBalancerToDatabase: () =>
      'Balansuotuvas skirsto užklausas serveriams, o ne bazei.',
    ConnectWrongDirection: () =>
      'Užklausos eina iš kairės į dešinę: naudotojai, balansuotuvas, serveriai, bazė.',
    NodeIsPartOfTask: ({ id }) =>
      `Blokas ${id} yra užduoties sąlygos dalis, jo ištrinti negalima.`,
    UnknownNode: ({ id }) => `Bloko ${id} lentoje nėra.`,
    DuplicateNodeId: ({ id }) => `Blokas pavadinimu ${id} jau yra.`,
    GoalMissingKind: ({ kind }) =>
      `Lentoje dar nėra bloko „${kindName[kind]}“. Jis yra paletėje kairėje.`,
    GoalTooFewTargets: ({ from, to, have, need }) =>
      `Ryšių nuo „${kindName[from]}“ iki blokų „${kindName[to]}“: ${n(have)} iš ${n(need)}. Nutieskite trūkstamus.`,
    GoalDirectPath: ({ from, via, targets }) =>
      `„${kindName[from]}“ kreipiasi į ${targets.join(', ')} tiesiogiai, aplenkdami bloką „${kindName[via]}“. Spustelėkite paryškintą ryšį ir ištrinkite jį.`,
    GoalNotConnected: ({ from, via }) =>
      `Nėra ryšio nuo „${kindName[from]}“ iki bloko „${kindName[via]}“: užklausoms nėra kur eiti.`,
    GoalTooManyErrors: ({ load, errorRate, overloaded }) =>
      `Esant ${n(load)} rps prarandama ${percent(errorRate)} užklausų. Užklausas praranda: ${overloaded.join(', ')}.`,
  },
} satisfies UiStrings
