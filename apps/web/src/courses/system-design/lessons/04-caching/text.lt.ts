import { Option } from 'effect'

import { type SimResult, simulationRules } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`
const p95 = (sim: SimResult) =>
  Option.match(sim.p95, { onNone: () => '—', onSome: ms => `${n(ms)} ms` })
const incoming = (sim: SimResult, id: string) => sim.nodes[id]?.incoming ?? 0
const utilization = (sim: SimResult, id: string) =>
  sim.nodes[id]?.utilization ?? 0
const { writeShare, cacheHitShare, cacheHitMs } = simulationRules
// Запись не кешируется: вся она идёт в базу, остальное в базе — чтения мимо кеша.
const writes = (sim: SimResult) =>
  Math.min(sim.databaseLoad, sim.load * writeShare)
const missedReads = (sim: SimResult) => sim.databaseLoad - writes(sim)

const LOAD = 1600
const quizWrites = LOAD * writeShare
const quizReads = LOAD - quizWrites
const quizMisses = quizReads * (1 - cacheHitShare)

export default {
  title: 'Cache. Greiti atsakymai iš atminties',
  summary: 'Cache-aside, hit rate ir TTL: kaip sumažinti database apkrovą.',
  steps: {
    'five-servers': {
      title: 'Penki „Server“ blokai, viena database',
      body: `Internetinė parduotuvė iš 3 pamokos išaugo. [[users|Users]] per [[lb|load balancer]] patenka į penkis „Server“ blokus, nuo [[app1|app1]] iki [[app5|app5]], ir visi jie dirba su viena [[db|database]]. Dabar ateina 1200 rps.

Kiekvienam server tenka po 240 rps – 60 % jo pajėgumo. Database apkrauta labiau: į ją suplaukia visų „Server“ blokų užklausos, todėl ji gauna visą srautą – 1200 rps iš 1500 galimų. Tai 80 %: labiausiai apkrautas lentos blokas.`,
    },
    'db-overload': {
      title: 'Database užspringsta',
      body: `Prasidėjo šventinis išpardavimas, ir apkrova išaugo iki **1600 rps**. Kiekvienas [[app3|server]] gauna 320 rps, tai 80 % pajėgumo, ir susitvarko. O [[db|database]] gauna visą 1600 rps srautą, bet spėja apdoroti tik 1500. Likusios 100 užklausų per sekundę prarandamos: tai raudoni taškai ant ryšių į database, apie 6 % klaidų. Praėjusios užklausos laukia eilėje, ir p95 šoktelėjo virš pusės sekundės.

Šeštas server nepadėtų. Server blokams būtų lengviau, bet database vis tiek gautų tuos pačius 1600 rps. Siauras kaklelis dabar yra už server blokų.`,
    },
    'reads-and-writes': {
      title: 'Skaitymas ir rašymas',
      body: `Pažiūrėkime, ko server prašo iš database. Dauguma užklausų tik **skaito** (read): atidaryti prekę, parodyti katalogą, patikrinti likutį. Ir tik nedaugelis **rašo** (write): pateikti užsakymą, palikti atsiliepimą. Šiame kurse ${percent(1 - writeShare)} užklausų – skaitymas, o ${percent(writeShare)} – rašymas, tad iš 1600 rps skaitymui tenka 1280.

Be to, skaitymai kartojasi. Pagrindinį puslapį ir šimtą populiariausių prekių atidaro tūkstančiai žmonių, ir kaskart database iš naujo ieško tų pačių eilučių. Jei įsimintume atsakymą į populiarią užklausą, antrą kartą klausti database nereikėtų.

**Cache** (lietuviškai – podėlis) – būtent tokia atmintis: saugykla, laikanti duomenis operatyviojoje atmintyje, pavyzdžiui, Redis arba Memcached. Skaitymas iš cache trunka ${cacheHitMs} ms. Kai cache žino atsakymą, tai **cache hit** (lietuviškai – pataikymas), kai nežino – **cache miss** (nepataikymas), ir užklausa keliauja toliau į database. Hit dalis tarp visų skaitymų vadinama **hit rate**; šiame kurse ji siekia ${percent(cacheHitShare)}.`,
    },
    'place-cache': {
      title: 'Užduotis: cache',
      body: `Pastatykite cache tarp server blokų ir [[db|database]]. Server blokai siunčia skaitymo užklausas į cache: hit jis aptarnauja pats, o miss perduoda database.

Kiekvieno server ryšį su database palikite: rašymas keliauja tik ten. Cache laiko kopijas, o originalus saugo database. Blokas „Cache“ jau yra paletėje.`,
    },
    'stale-data': {
      title: 'Pasenę duomenys',
      body: ({ sim }) =>
        `[[db|Database]] atsikvėpė: dabar ji gauna ${n(sim.databaseLoad)} rps vietoj 1600. Iš jų ${n(writes(sim))} – rašymas. Čia cache nepadeda: kiekvienas rašymas vis tiek keliauja į database. Likę ${n(missedReads(sim))} – skaitymai, kurie baigėsi cache miss. p95 nukrito iki ${p95(sim)}.

Kaip duomenys patenka į cache? Dažniausiai tuo rūpinasi server: pirmiausia klausia cache, o gavęs miss skaito iš database ir įdeda atsakymą į cache. Toks būdas vadinamas **cache-aside**. Lentoje [[cache-1|cache]] pats kreipiasi į database (toks būdas vadinamas read-through), bet database tai nesvarbu.

Už cache tenka mokėti **pasenusiais duomenimis** (stale data). Server įrašė į database naują prekės kainą, o cache vis dar pateikia senąją. Viena apsauga – **TTL** (time to live, lietuviškai – galiojimo laikas): kiekvienas raktas cache viduje gyvuoja, tarkime, 60 sekundžių ir išnyksta, o kitas skaitymas paima naują reikšmę iš database. Kita – **invalidavimas** (invalidation): rašydamas server iš karto ištrina raktą iš cache. TTL paprastas, bet palieka pasenusių duomenų langą; invalidavimas tikslesnis, bet jį lengva pamiršti kurioje nors vietoje, kur rašoma. Dažniausiai jie derinami.`,
    },
    'cache-down': {
      title: 'Kai cache sugenda',
      body: ({ sim }) =>
        `[[cache-1|Cache]] sugedo. ${
          sim.errorRate > 0.01
            ? `Server blokai vėl siunčia skaitymo užklausas tiesiai į [[db|database]]. Ji gauna ${n(sim.databaseLoad)} rps, ir ${percent(sim.errorRate)} užklausų prarandama, kaip ir prieš cache.`
            : `Jūsų lentoje skaitymus perėmė kitas cache, todėl [[db|database]] laikosi: ${n(sim.databaseLoad)} rps. Su vienu cache ji vėl gautų 1600 rps ir klaidas.`
        }

Cache laiko tik kopijas, bet be jo sistema jau nebegali veikti. Pavojingas net perkrovimas: cache grįžta tuščias, arba **šaltas** (cold), ir kurį laiką kiekvienas skaitymas – miss. Todėl cache paleidžiamas keliuose mazguose ir prieš nukreipiant į jį srautą „įšildomas“ (warm-up), o apkrovą, kurią database gautų be cache, visada reikia turėti omenyje.`,
    },
    summary: {
      title: 'Santrauka',
      body: ({ sim }) =>
        `Cache vėl veikia. Jis nuima nuo database pasikartojančius skaitymus: kai hit rate siekia ${percent(cacheHitShare)}, iki database nueina tik ${percent(1 - cacheHitShare)} skaitymų. Database apkrova sumažėjo nuo 1600 iki ${n(sim.databaseLoad)} rps, o cache kainuoja 0,15 $ per valandą.

Į cache dėkite tai, kas dažnai skaitoma ir retai keičiasi. Raktams nustatykite TTL ir ištrinkite juos iš cache, kai duomenys pasikeičia. Atminkite, kad rašymas vis tiek keliauja į database, o be cache database vėl perkrauta.

Dabar labiausiai apkrauti blokai – [[app3|server]], 80 %. Nemaža jų darbo dalis visai ne parduotuvės logika, o paveikslėliai, skriptai ir stiliai, vienodi visiems lankytojams. 5 pamokoje juos perims **CDN** (Content Delivery Network, lietuviškai – turinio pristatymo tinklas).`,
    },
  },
  annotations: {
    dbLoad: sim => `${n(incoming(sim, 'db'))} rps iš ${n(1500)} galimų`,
    dbOverload: sim =>
      `apkrova ${percent(utilization(sim, 'db'))} · klaidos ${percent(sim.errorRate)}`,
    serverCalm: sim => `${n(incoming(sim, 'app3'))} rps iš 400 · susitvarko`,
    readsWrites: sim =>
      `skaitymas ${n(incoming(sim, 'db') * (1 - writeShare))} · rašymas ${n(incoming(sim, 'db') * writeShare)}`,
    cacheHits: sim =>
      `hit ${n(incoming(sim, 'cache-1') * cacheHitShare)} iš ${n(incoming(sim, 'cache-1'))} rps`,
    dbAfter: sim =>
      `rašymas ${n(writes(sim))} + miss ${n(missedReads(sim))} rps`,
    serversNext: sim =>
      `${n(incoming(sim, 'app3'))} rps iš 400 · ${percent(utilization(sim, 'app3'))}`,
  },
  quizzes: {
    'db-after-cache': {
      question: `Cache pats atsako į ${percent(cacheHitShare)} skaitymų. Kiek užklausų per sekundę nueis iki database esant ${n(LOAD)} rps, kai cache bus savo vietoje?`,
      options: {
        unchanged: `${n(LOAD)} rps – tiek pat`,
        'all-reads': `${n(quizReads)} rps`,
        'writes-and-misses': `${n(quizWrites + quizMisses)} rps`,
        misses: `${n(quizMisses)} rps`,
      },
      wrong: {
        unchanged:
          'Cache pasiima skaitymus, į kuriuos žino atsakymą, todėl iki database nueina gerokai mažiau.',
        'all-reads': `${n(quizReads)} – tai visi skaitymai. Bet ${percent(cacheHitShare)} jų cache atiduos pats, į database keliaus tik miss.`,
        misses: `${n(quizMisses)} – tai tik miss. Rašymas į database eina pro cache: dar ${n(quizWrites)} rps.`,
      },
      explain: `Iki database nueis visas rašymas – ${percent(writeShare)} iš ${n(LOAD)}, tai ${n(quizWrites)} rps, – ir cache miss: ${percent(1 - cacheHitShare)} iš ${n(quizReads)} skaitymų, tai ${n(quizMisses)} rps. Iš viso ${n(quizWrites + quizMisses)} rps iš 1500 galimų: database atsikvėps. Patikrinkite tai užduotyje.`,
    },
  },
  tasks: {
    'place-cache': {
      prompt:
        'Nuimkite skaitymą nuo database: pastatykite cache tarp server blokų ir database.',
      goals: {
        'cache-exists': 'Lentoje yra blokas „Cache“',
        'servers-use-cache': 'Server blokai prijungti prie „Cache“',
        'cache-backed-by-db': '„Cache“ prijungtas prie „Database“',
        'db-relieved':
          'Database apkrauta ne daugiau kaip 60 %, kai ateina 1600 rps',
        'holds-load': 'Atlaiko 1600 rps, kai klaidų mažiau nei 1 %',
      },
      hints: [
        'Dauguma užklausų į database – pasikartojantys skaitymai. Atsakymus į juos galima laikyti arčiau, greitoje atmintyje.',
        'Pastatykite bloką „Cache“ tarp server blokų ir database. Prie jo prijunkite kiekvieną server, o patį cache – prie database, kad būtų kur siųsti miss. Server ryšių su database netrinkite: jais keliauja rašymas.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite ten bloką „Cache“ ir nutieskite pažymėtus ryšius: nuo kiekvieno iš penkių „Server“ blokų iki cache ir nuo cache iki database.',
      ],
      solvedNote:
        'Keturis skaitymus iš penkių dabar aptarnauja cache, o database turi atsargą.',
    },
  },
} satisfies LessonTexts<typeof lesson>
