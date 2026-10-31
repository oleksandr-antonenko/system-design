import { Array } from 'effect'

import { type ComponentKind, componentName } from '../../domain/catalog'
import { formatNumber } from '../format'
import { plural } from '../plural'
import { deviceLt } from './device/lt'
import { packetBoardLt } from './packetBoard/lt'
import { panelLt } from './panel/lt'
import { scenarioLt } from './scenario/lt'
import type { UiStrings } from './types'

const inLanguage: UiStrings['inLanguage'] = {
  uk: 'ukrainiečių kalba',
  ru: 'rusų kalba',
  en: 'anglų kalba',
  lt: 'lietuvių kalba',
}

const kindHint: UiStrings['kindHint'] = {
  client: 'Naudotojai: žmonės ir programos, siunčiantys užklausas',
  cdn: 'Turinio pristatymo tinklas: pateikia statinius failus iš serverių, esančių arti naudotojo',
  limiter: 'Užklausų dažnio ribotuvas: atmeta užklausas, viršijančias limitą',
  lb: 'Apkrovos balansavimo priemonė: paskirsto užklausas serveriams',
  server: 'Programos serveris: vykdo kodą ir atsako į užklausas',
  cache:
    'Podėlis: laiko dažnus atsakymus atmintyje ir mažina duomenų bazės apkrovą',
  queue: 'Pranešimų eilė: kaupia užduotis, kol jas paima vykdytojai',
  events:
    'Įvykių magistralė: pristato kiekvieną įvykį visiems prenumeratoriams',
  worker: 'Foninis vykdytojas: atlieka užduotis iš eilės',
  db: 'Duomenų bazė: saugo sistemos duomenis',
  replica:
    'Skaitymo replika: duomenų bazės kopija, atsakanti į skaitymo užklausas',
  search: 'Paieškos indeksas: greitai randa įrašus pagal tekstą',
  storage:
    'Objektų saugykla: saugo failus – paveikslėlius, vaizdo įrašus, atsargines kopijas – ir atiduoda juos pagal nuorodą',
}

const regionName: UiStrings['regionName'] = {
  eu: 'Europa',
  us: 'JAV',
  asia: 'Azija',
}

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`
/** Доля профиля трафика: до десятых процента, чтобы 0,5 % не стало 1 %. */
const share = (ratio: number) =>
  `${formatNumber('lt', Math.round(ratio * 1000) / 10)} %`
const count = (value: number) => formatNumber('lt', value)
const perHour = (dollars: number) =>
  `${dollars.toFixed(2).replace('.', ',')} $/val.`
const kindList = (kinds: ReadonlyArray<ComponentKind>) =>
  kinds.map(kind => componentName[kind]).join(', ')
const idList = (lead: string, ids: ReadonlyArray<string>) =>
  Array.isReadonlyArrayNonEmpty(ids) ? `${lead}${ids.join(', ')}.` : ''

export const lt = {
  siteTitle: 'Interaktyvūs kursai',
  siteTagline: 'Teorija gyvoje schemoje ir praktinės užduotys',
  courseSwitcherLabel: 'Kursai',
  languageSwitcherLabel: 'Kalba',
  currentLanguage: 'dabartinė',
  inLanguage,
  kindHint,
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
    loading: 'Įkeliama pamoka…',
    loadFailed: 'Pamoka neįsikėlė. Patikrinkite ryšį ir bandykite dar kartą.',
    retry: 'Bandyti dar kartą',
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
    ghost: kind => `čia: ${componentName[kind]}`,
    modePick: 'Klausimas · pasirinkite lentoje',
    loadHidden: 'apkrova paslėpta iki atsakymo',
  },
  hud: {
    load: 'Apkrova',
    errors: 'Klaidos',
    p95: 'p95 atsakas',
    database: 'Database apkrova',
    rejected: 'Atmesta',
    backlog: 'Queue auga',
    cost: 'Kaina',
    rps: value => `${n(value)} rps`,
    growth: value => `+${n(value)} rps`,
    ms: value => `${n(value)} ms`,
    percent,
    perHour,
    trafficMix: 'Srauto sudėtis',
    trafficKnob: {
      writeShare: value => `rašymas ${share(value)}`,
      deferredShare: value => `atidėtas rašymas ${share(value)}`,
      cacheHitShare: value => `cache hit ${share(value)}`,
      cdnStaticShare: value => `CDN statika ${share(value)}`,
      jobsPerRequest: value => `užduočių užklausai ×${count(value)}`,
      writesPerJob: value => `įrašų užduočiai ×${count(value)}`,
    },
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
    nextLesson: title => `Kita pamoka: ${title} →`,
    courseFinishedTitle: 'Kursas baigtas',
    courseFinishedBody: 'Baigėte visas šiuo metu prieinamas kurso pamokas.',
    nextCourse: 'Kitas kursas',
    goToCourse: 'Eiti į kursą →',
    answerFirst: 'Pirmiau atsakykite į klausimą',
    toBoard: 'Žiūrėti lentoje →',
    toFrame: 'Žiūrėti kadrą →',
    toTask: 'Į užduotį →',
    toQuestion: 'Į klausimą →',
    toText: '← Tekstas',
    toTextLabel: 'Grįžti į žingsnio tekstą',
    moreBadge: 'smalsiems',
    askAiTitle: 'Kaip paklausti DI',
    copy: 'Kopijuoti',
    copied: 'Nukopijuota',
  },
  desktopNotice: {
    title: 'Patogiau kompiuteriu',
    body: 'Šias pamokas patogiau eiti kompiuteriu: ten lenta ir užduotys matomos visos. Telefonu irgi galima: tekstą ir lentą perjungia mygtukas.',
    ok: 'Supratau',
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
    resultServers: 'Server apkrova',
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
  },
  device: deviceLt,
  panel: panelLt,
  packetBoard: packetBoardLt,
  scenario: scenarioLt,
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
    SendNeedsIp: () =>
      'Įrašykite IP address: keturi skaičiai, atskirti taškais, pavyzdžiui, 192.168.1.10.',
    ConnectSelf: () => 'Bloko negalima sujungti su pačiu savimi.',
    ConnectDuplicate: () => 'Toks ryšys jau yra.',
    ConnectIntoClients: () =>
      'Į bloką „Users“ užklausos neateina: jis yra srauto šaltinis.',
    ConnectClientsToDatabase: () =>
      '„Users“ nesikreipia į „Database“ tiesiogiai. Tarp jų turi būti „Server“.',
    ConnectServerToServer: () =>
      'Blokai „Server“ neperduoda užklausų vieni kitiems. Apkrovą paskirsto „Load balancer“.',
    ConnectBalancerToDatabase: () =>
      '„Load balancer“ skirsto užklausas blokams „Server“, o ne „Database“.',
    ConnectWrongDirection: () =>
      'Užklausos eina iš kairės į dešinę: Users, Load balancer, Server, Database.',
    NodeIsPartOfTask: ({ id }) =>
      `Blokas ${id} yra užduoties sąlygos dalis, jo ištrinti negalima.`,
    UnknownNode: ({ id }) => `Bloko ${id} lentoje nėra.`,
    DuplicateNodeId: ({ id }) => `Blokas pavadinimu ${id} jau yra.`,
    GoalMissingKind: ({ kind }) =>
      `Lentoje dar nėra bloko „${componentName[kind]}“. Jis yra paletėje kairėje.`,
    GoalTooFewTargets: ({ from, to, have, need }) =>
      `Ryšių nuo „${componentName[from]}“ iki blokų „${componentName[to]}“: ${n(have)} iš ${n(need)}. Nutieskite trūkstamus.`,
    GoalDirectPath: ({ from, via, targets }) =>
      `„${componentName[from]}“ kreipiasi į ${targets.join(', ')} tiesiogiai, aplenkdami bloką „${componentName[via]}“. Spustelėkite paryškintą ryšį ir ištrinkite jį.`,
    GoalNotConnected: ({ from, via }) =>
      `Nėra ryšio nuo „${componentName[from]}“ iki bloko „${componentName[via]}“: užklausoms nėra kur eiti.`,
    GoalTooManyErrors: ({ load, errorRate, overloaded }) =>
      `Esant ${n(load)} rps prarandama ${percent(errorRate)} užklausų. Užklausas praranda: ${overloaded.join(', ')}.`,
    ConnectFromSink: ({ from }) =>
      `Bloke „${componentName[from]}“ užklausos kelias baigiasi: toliau jis nieko neperduoda.`,
    ConnectNotAllowed: ({ from, to, allowed }) =>
      `„${componentName[from]}“ neperduoda užklausų blokui „${componentName[to]}“. Galimi ryšiai: ${kindList(allowed)}.`,
    InvalidCapacity: ({ id }) =>
      `Blokui ${id} reikia pralaidumo, didesnio už nulį.`,
    ShareNotForUsers: ({ id }) =>
      `Apkrovos dalį galima nustatyti tik blokui „Users“, o ${id} – kitas blokas.`,
    InvalidShare: ({ id }) =>
      `${id} apkrovos dalis turi būti skaičius, didesnis už nulį.`,
    InvalidTraffic: ({ knob }) =>
      `Srauto nustatymas ${knob} už ribų: dalys nuo 0 iki 1, rašymas ir atidėtas rašymas kartu ne daugiau kaip 1, skaitikliai nuo 0.`,
    RegionHasNoBlocks: ({ region }) =>
      `Regione „${regionName[region]}“ blokų nėra.`,
    GoalSlowResponse: ({ load, p95, max, hottest }) =>
      `Esant ${n(load)} rps, p95 yra ${n(p95)} ms – daugiau nei riba ${n(max)} ms.${idList(' Labiausiai apkrautas blokas: ', hottest)}`,
    GoalOverUtilized: ({ kind, load, utilization, max, nodes }) =>
      `Esant ${n(load)} rps, blokai „${componentName[kind]}“ apkrauti iki ${percent(utilization)} – daugiau nei riba ${percent(max)}: ${nodes.join(', ')}.`,
    GoalBacklogGrowing: ({ load, backlog, max, nodes }) =>
      `Esant ${n(load)} rps, queues auga ${n(backlog)} rps, leidžiama ${n(max)} rps.${idList(' Nespėja: ', nodes)}`,
    GoalTooExpensive: ({ cost, max }) =>
      `Sistema kainuoja ${perHour(cost)} – daugiau nei biudžetas ${perHour(max)}.`,
    GoalFailureNotSurvived: ({ id, kind, load, errorRate, max }) =>
      `Sugedus ${id} („${componentName[kind]}“) ir esant ${n(load)} rps, prarandama ${percent(errorRate)} užklausų, leidžiama ne daugiau kaip ${percent(max)}.`,
    GoalRegionFailureNotSurvived: ({
      region,
      load,
      errorRate,
      max,
      overloaded,
    }) =>
      `Sugedus regionui „${regionName[region]}“ ir esant ${n(load)} rps, prarandama ${percent(errorRate)} užklausų, leidžiama ne daugiau kaip ${percent(max)}.${idList(' Užklausas praranda: ', overloaded)}`,
    GoalNotCarrying: ({ node, load, carried, min }) =>
      `Esant ${n(load)} rps, per ${node} eina tik ${n(carried)} rps, o reikia bent ${n(min)} rps.`,
  },
} satisfies UiStrings
