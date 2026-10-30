import { Array } from 'effect'

import type { ComponentKind } from '../../domain/catalog'
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
  cdn: 'CDN',
  limiter: 'Ribotuvas',
  lb: 'Balansuotuvas',
  server: 'Serveris',
  cache: 'Podėlis',
  queue: 'Eilė',
  events: 'Įvykių magistralė',
  worker: 'Vykdytojas',
  db: 'Duomenų bazė',
  replica: 'Bazės replika',
  search: 'Paieškos indeksas',
}

const regionName: UiStrings['regionName'] = {
  eu: 'Europa',
  us: 'JAV',
  asia: 'Azija',
}

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`
const perHour = (dollars: number) =>
  `${dollars.toFixed(2).replace('.', ',')} $/val.`
const kindList = (kinds: ReadonlyArray<ComponentKind>) =>
  kinds.map(kind => kindName[kind]).join(', ')
const idList = (lead: string, ids: ReadonlyArray<string>) =>
  Array.isReadonlyArrayNonEmpty(ids) ? `${lead}${ids.join(', ')}.` : ''

export const lt = {
  siteTitle: 'Interaktyvūs kursai',
  siteTagline: 'Teorija gyvoje schemoje ir praktinės užduotys',
  courseSwitcherLabel: 'Kursas',
  languageSwitcherLabel: 'Kalba',
  inLanguage,
  kindName,
  regionName,
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
    queueGrowing: rps => `auga +${n(rps)}/s`,
    rejecting: rps => `atmesta ${n(rps)}/s`,
    zoneDown: region => `${regionName[region]} · regionas neveikia`,
    edgeFlow: rps => `${n(rps)} rps`,
    ghost: kind => `čia: ${kindName[kind]}`,
    modePick: 'Klausimas · pasirinkite lentoje',
    loadHidden: 'apkrova paslėpta iki atsakymo',
  },
  hud: {
    load: 'Apkrova',
    errors: 'Klaidos',
    p95: 'p95 atsakas',
    database: 'Užklausos į bazę',
    rejected: 'Atmesta',
    backlog: 'Eilė auga',
    cost: 'Kaina',
    rps: value => `${n(value)} rps`,
    growth: value => `+${n(value)} rps`,
    ms: value => `${n(value)} ms`,
    percent,
    perHour,
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
    nextTo: stepTitle => `Toliau: ${stepTitle} →`,
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
    answerFirst: 'Pirmiau atsakykite į klausimą',
    moreBadge: 'smalsiems',
    askAiTitle: 'Kaip paklausti DI',
    copy: 'Kopijuoti',
    copied: 'Nukopijuota',
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
    surfaces: 'Kur spręsti užduotį',
  },
  quiz: {
    heading: 'Klausimas',
    correct: 'Teisingai iš pirmo karto',
    incorrect: 'Ne visai',
    oneAttempt: 'Vienas bandymas: po jo parodysime atsakymą ir paaiškinimą.',
    pickOnBoard:
      'Spustelėkite atsakymą lentoje. Klaviatūra: Tab iki jo ir Enter.',
    choices: 'Atsakymo variantai',
    answerWas: answer => `Teisingas atsakymas: ${answer}`,
  },
  network: {
    boardLabel: 'Tinklo schema',
    placeholder: 'Tinklo lenta dar kuriama: kol kas čia tik įrenginių sąrašas.',
    run: 'Paleisti',
    wifiTab: device => `Wi-Fi: ${device}`,
    wifiNetworks: 'Netoliese esantys tinklai',
    wifiNone: 'Netoliese nėra Wi-Fi tinklų.',
    wifiPassword: 'Slaptažodis',
    wifiJoin: 'Prisijungti',
    wifiJoined: ssid => `Prisijungta prie „${ssid}“`,
  },
  notFound: {
    title: 'Puslapis nerastas',
    body: path => `Adresu „${path}“ nieko nėra.`,
    backHome: 'Atgal į kursų sąrašą',
  },
  domain: {
    UnknownCourse: ({ course }) => `Kurso „${course}“ nėra.`,
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
    ConnectFromSink: ({ from }) =>
      `Bloke „${kindName[from]}“ užklausos kelias baigiasi: toliau jis nieko neperduoda.`,
    ConnectNotAllowed: ({ from, to, allowed }) =>
      `„${kindName[from]}“ neperduoda užklausų blokui „${kindName[to]}“. Galimi ryšiai: ${kindList(allowed)}.`,
    InvalidCapacity: ({ id }) =>
      `Blokui ${id} reikia pralaidumo, didesnio už nulį.`,
    RegionHasNoBlocks: ({ region }) =>
      `Regione „${regionName[region]}“ blokų nėra.`,
    GoalSlowResponse: ({ load, p95, max, hottest }) =>
      `Esant ${n(load)} rps, p95 yra ${n(p95)} ms – daugiau nei riba ${n(max)} ms.${idList(' Labiausiai apkrautas blokas: ', hottest)}`,
    GoalOverUtilized: ({ kind, load, utilization, max, nodes }) =>
      `Esant ${n(load)} rps, blokai „${kindName[kind]}“ apkrauti iki ${percent(utilization)} – daugiau nei riba ${percent(max)}: ${nodes.join(', ')}.`,
    GoalBacklogGrowing: ({ load, backlog, max, nodes }) =>
      `Esant ${n(load)} rps, eilės auga ${n(backlog)} rps, leidžiama ${n(max)} rps.${idList(' Nespėja: ', nodes)}`,
    GoalTooExpensive: ({ cost, max }) =>
      `Sistema kainuoja ${perHour(cost)} – daugiau nei biudžetas ${perHour(max)}.`,
    GoalFailureNotSurvived: ({ id, kind, load, errorRate, max }) =>
      `Sugedus ${id} („${kindName[kind]}“) ir esant ${n(load)} rps, prarandama ${percent(errorRate)} užklausų, leidžiama ne daugiau kaip ${percent(max)}.`,
    GoalRegionFailureNotSurvived: ({
      region,
      load,
      errorRate,
      max,
      overloaded,
    }) =>
      `Sugedus regionui „${regionName[region]}“ ir esant ${n(load)} rps, prarandama ${percent(errorRate)} užklausų, leidžiama ne daugiau kaip ${percent(max)}.${idList(' Užklausas praranda: ', overloaded)}`,
  },
} satisfies UiStrings
