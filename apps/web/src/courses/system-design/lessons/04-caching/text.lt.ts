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
const dropped = (sim: SimResult, id: string) => sim.nodes[id]?.dropped ?? 0
const utilization = (sim: SimResult, id: string) =>
  sim.nodes[id]?.utilization ?? 0
const { writeShare, cacheHitShare, cacheHitMs } = simulationRules
// Запись не кешируется: вся она идёт в базу, остальное в базе — чтения мимо кеша.
const writes = (sim: SimResult) =>
  Math.min(sim.databaseLoad, sim.load * writeShare)
const missedReads = (sim: SimResult) => sim.databaseLoad - writes(sim)
// Чтение в кеш: в cache-aside по связям сервер → кеш идёт ещё и заполнение.
const cacheReads = (sim: SimResult) => sim.load * (1 - writeShare)

const LOAD = 1600
const quizWrites = LOAD * writeShare
const quizReads = LOAD - quizWrites
const quizMisses = quizReads * (1 - cacheHitShare)

export default {
  title: 'Cache. Greiti atsakymai iš atminties',
  summary:
    'Cache-aside ir read-through, hit rate ir TTL: kaip sumažinti database apkrovą.',
  preview: {
    alt: 'Schema: cache šalia server atsako į daugumą skaitymų iš atminties, o į database keliauja tik užklausos po cache miss, todėl ji beveik laisva.',
  },
  steps: {
    'five-servers': {
      title: 'Penki „Server“ blokai, viena database',
      body: `Internetinė parduotuvė iš 3 pamokos išaugo. [[users|Users]] per [[lb|load balancer]] patenka į penkis „Server“ blokus, nuo [[app1|app1]] iki [[app5|app5]], ir visi jie dirba su viena [[db|database]]. Dabar ateina 1200 rps.

Kiekvienam server tenka po 240 rps – 60 % jo pajėgumo. Database apkrauta labiau: į ją suplaukia visų „Server“ blokų užklausos, todėl ji gauna visą srautą – 1200 rps iš 1500 galimų. Tai 80 %: labiausiai apkrautas lentos blokas. Užrašai ant ryšių sako, kas jais keliauja: kiekvienas server siunčia į database ir skaitymą, ir rašymą.`,
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
    'two-patterns': {
      title: 'Kas skaito database per miss',
      body: `Cache laiko kopijas, o originalus saugo [[db|database]]. Per miss kažkas turi paimti reikšmę iš database ir įdėti ją į cache. Paplitę du atsakymai, ir lentoje jie piešiami skirtingai.

**Cache-aside** (lietuviškai – „podėlis šalia“): viską daro pats [[app3|server]]. Jis klausia cache; per miss skaito database, atsako naudotojui ir įdeda reikšmę į cache, kad kitas skaitymas būtų hit. Cache apie database nieko nežino. Tai labiausiai paplitęs būdas: Redis arba Memcached šalia programos, o programos kodas sprendžia, ką laikyti cache.

**Read-through** (lietuviškai – „skaitymas per podėlį“): server klausia tik cache. Per miss cache pats skaito database, išsaugo kopiją ir atsako. Taip veikia podėlio bibliotekos ir podėlio tarpinės tarnybos (proxy) prieš database: programos kodas paprastesnis, bet cache turi žinoti kelią iki database.

Kas per miss eina į database:
- cache-aside – server. Ryšiai: server → cache neša skaitymą ir pildymą, server → database – rašymą ir miss;
- read-through – cache. Ryšiai: server → cache neša skaitymą, cache → database – miss, server → database – tik rašymą.

Abiem būdais rašymas į database keliauja per server: cache greitina tik skaitymą.`,
    },
    'cache-aside': {
      title: 'Užduotis: cache-aside',
      body: `Pradėkime nuo cache-aside. Pastatykite cache šalia server blokų ir prijunkite prie jo kiekvieną server: skaitymas pirmiausia keliauja ten. Kiekvieno server ryšį su [[db|database]] palikite: juo keliauja rašymas ir miss.

Pats cache prie database nejungiamas: lenta net neleis nutiesti tokio ryšio, nes taikant cache-aside database skaito server. Blokas „Cache“ jau yra paletėje, o žyma ant bloko rodo jo režimą.`,
    },
    'aside-result': {
      title: 'Cache-aside lentoje',
      body: ({ sim }) =>
        `[[db|Database]] atsikvėpė: dabar ji gauna ${n(sim.databaseLoad)} rps vietoj 1600. Iš jų ${n(writes(sim))} – rašymas, čia cache nepadeda. Likę ${n(missedReads(sim))} – miss, kuriuos server blokai patys perskaitė iš database. p95 nukrito iki ${p95(sim)}.

Pažiūrėkite į užrašus. Kiekvienas ryšys server → [[cache-1|cache]] neša skaitymą (${n(cacheReads(sim))} rps visiems server blokams) ir po kiekvieno miss – pildymą: reikšmę, kurią server ką tik perskaitė iš database. Kiekvienas ryšys server → database neša rašymą ir miss. Keturi skaitymai iš penkių – hit, iki database jie nenueina.`,
    },
    'read-through': {
      title: 'Užduotis: read-through',
      body: `Dabar perjunkime tą pačią lentą į read-through: nuo šiol server blokai klausia tik [[cache-1|cache]], o per miss database turi skaityti pats cache. Bet ryšio su database jis neturi, ir miss neturi kur keliauti: prarandama ${n(quizMisses)} rps, ${percent(quizMisses / LOAD)} klaidų.

Duokite cache savo kelią iki [[db|database]]. Server blokų ryšiai su database lieka: jais ir toliau keliauja rašymas, o miss persikelia į naują ryšį.`,
    },
    compare: {
      title: 'Apkrova ta pati, vaidmenys skirtingi',
      body: ({ sim }) =>
        `Database vėl gauna ${n(sim.databaseLoad)} rps – lygiai tiek pat, kiek taikant cache-aside: rašymas ir miss. Database abu būdai vienodi. Skiriasi tai, kas žino kelią iki jos.

Taikant cache-aside, server žino ir cache, ir database, o cache – tiesiog greita saugykla šalia. Taikant read-through, server žino tik cache, o kelias iki database priklauso cache.`,
    },
    'stale-data': {
      title: 'Pasenę duomenys',
      body: `Už cache tenka mokėti **pasenusiais duomenimis** (stale data). Server įrašė į database naują prekės kainą, o [[cache-1|cache]] vis dar pateikia senąją – taikant bet kurį iš dviejų būdų.

Viena apsauga – **TTL** (time to live, lietuviškai – galiojimo laikas): kiekvienas raktas cache viduje gyvuoja, tarkime, 60 sekundžių ir išnyksta, o kitas skaitymas tampa miss ir paima naują reikšmę iš database. Kita – **invalidavimas** (invalidation): rašydamas server iš karto ištrina raktą iš cache. TTL paprastas, bet palieka pasenusių duomenų langą; invalidavimas tikslesnis, bet jį lengva pamiršti kurioje nors vietoje, kur rašoma. Dažniausiai jie derinami.`,
    },
    'cache-down': {
      title: 'Kai cache sugenda',
      body: ({ sim }) =>
        `[[cache-1|Cache]] sugedo. ${
          sim.errorRate > 0.01
            ? `Lentoje server blokai siunčia skaitymo užklausas tiesiai į [[db|database]]. Ji gauna ${n(sim.databaseLoad)} rps, ir ${percent(sim.errorRate)} užklausų prarandama, kaip ir prieš cache.`
            : `Jūsų lentoje skaitymus perėmė kitas cache, todėl [[db|database]] laikosi: ${n(sim.databaseLoad)} rps. Su vienu cache ji vėl gautų 1600 rps ir klaidas.`
        }

Taikant cache-aside, kreiptis į database natūralu: server kiekvienas skaitymas tiesiog tampa miss. Taikant read-through, tai atskiras kodas, atsarginis kelias, kurį komanda turi parašyti ir patikrinti, kitaip skaitymai griūna. Bet kuriuo atveju cache laiko tik kopijas, bet be jo sistema jau nebegali veikti. Pavojingas net perkrovimas: cache grįžta tuščias, arba **šaltas** (cold), ir kurį laiką kiekvienas skaitymas – miss. Todėl cache paleidžiamas keliuose mazguose ir prieš nukreipiant į jį srautą „įšildomas“ (warm-up), o apkrovą, kurią database gautų be cache, visada reikia turėti omenyje.`,
    },
    summary: {
      title: 'Santrauka',
      body: ({ sim }) =>
        `Cache vėl veikia. Jis nuima nuo database pasikartojančius skaitymus: kai hit rate siekia ${percent(cacheHitShare)}, iki database nueina tik ${percent(1 - cacheHitShare)} skaitymų. Database apkrova sumažėjo nuo 1600 iki ${n(sim.databaseLoad)} rps, o cache kainuoja 0,15 $ per valandą.

- Cache-aside: per miss database skaito server ir pildo cache. Labiausiai paplitęs būdas, ir cache gedimą jis išgyvena pats.
- Read-through: per miss database skaito cache. Programos kodas paprastesnis, bet cache reikia savo ryšio su database.

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
      `hit ${n(cacheReads(sim) * cacheHitShare)} iš ${n(cacheReads(sim))} skaitymų`,
    dbAfter: sim =>
      `rašymas ${n(writes(sim))} + miss ${n(missedReads(sim))} rps`,
    missesLost: sim =>
      dropped(sim, 'cache-1') >= 1
        ? `miss prarandami: ${n(dropped(sim, 'cache-1'))} rps`
        : 'miss pasiekia database',
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
      explain: `Iki database nueis visas rašymas – ${percent(writeShare)} iš ${n(LOAD)}, tai ${n(quizWrites)} rps, – ir cache miss: ${percent(1 - cacheHitShare)} iš ${n(quizReads)} skaitymų, tai ${n(quizMisses)} rps. Iš viso ${n(quizWrites + quizMisses)} rps iš 1500 galimų: database atsikvėps. Patikrinkite tai užduotyse.`,
    },
    'cache-down-pattern': {
      question:
        'Cache sugedo. Kuriuo būdu programa ir toliau atsakys į skaitymus iš database be papildomo kodo?',
      options: {
        'cache-aside': 'Cache-aside',
        'read-through': 'Read-through',
        both: 'Abiem: database juk vietoje',
        neither: 'Nė vienu: skaitymai griūna, kol cache negrįš',
      },
      wrong: {
        'read-through':
          'Taikant read-through, server žino tik cache: kelias iki database priklauso cache. Be atskiro atsarginio kelio skaitymai griūna.',
        both: 'Database vietoje, bet taikant read-through server neturi kelio iki jos skaitymui: tas kelias priklauso cache.',
        neither:
          'Taikant cache-aside, server ir taip skaito database per kiekvieną miss. Kai cache sugenda, kiekvienas skaitymas tiesiog tampa miss.',
      },
      explain:
        'Taikant cache-aside, server ir taip skaito database per kiekvieną miss, todėl sugedęs cache tiesiog paverčia kiekvieną skaitymą miss: lėčiau, ir database gauna visą apkrovą, bet skaitymai aptarnaujami. Taikant read-through, server kalbasi tik su cache, todėl komandai reikia parašyti atsarginį kelią iki database, kitaip skaitymai griūna. Šioje lentoje server blokai kreipiasi į database patys, lyg toks kelias jau būtų parašytas.',
    },
  },
  tasks: {
    'cache-aside': {
      prompt:
        'Nuimkite skaitymą nuo database pagal cache-aside: server blokai klausia cache, o per miss skaito database patys.',
      goals: {
        'cache-exists': 'Lentoje yra blokas „Cache“',
        'servers-use-cache': 'Server blokai prijungti prie „Cache“',
        'no-cache-db':
          '„Cache“ neturi ryšio su „Database“: per miss ją skaito server blokai',
        'db-relieved':
          'Database apkrauta ne daugiau kaip 45 %, kai ateina 1600 rps',
        'holds-load': 'Atlaiko 1600 rps, kai klaidų mažiau nei 1 %',
      },
      hints: [
        'Dauguma užklausų į database – pasikartojantys skaitymai. Atsakymus į juos galima laikyti arčiau, greitoje atmintyje, ir klausti jos pirmiausia.',
        'Pastatykite bloką „Cache“ ir prijunkite prie jo kiekvieną iš penkių „Server“ blokų. Server ryšių su database netrinkite: jais keliauja rašymas ir miss. Pats cache lieka be ryšio su database.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite ten bloką „Cache“ ir nutieskite pažymėtus ryšius: nuo kiekvieno iš penkių „Server“ blokų iki cache.',
      ],
      solvedNote:
        'Keturis skaitymus iš penkių dabar aptarnauja cache; likusius server blokai skaito iš database ir pildo cache.',
    },
    'read-through': {
      prompt:
        'Taikant read-through, per miss database skaito pats cache: duokite jam kelią iki database.',
      goals: {
        'cache-reads-db': '„Cache“ prijungtas prie „Database“',
        'db-relieved':
          'Database apkrauta ne daugiau kaip 45 %, kai ateina 1600 rps',
        'holds-load': 'Atlaiko 1600 rps, kai klaidų mažiau nei 1 %',
      },
      hints: [
        'Miss dabar – cache rūpestis, o siųsti jų jam nėra kur.',
        'Nutieskite ryšį nuo cache iki database. Server blokų ryšiai su database lieka: jais keliauja rašymas.',
        'Lentoje atsirado punktyrinė linija: nutieskite ryšį nuo cache iki database.',
      ],
      solvedNote:
        'Miss dabar keliauja nuo cache į database, o server blokai siunčia jai tik rašymą.',
    },
  },
} satisfies LessonTexts<typeof lesson>
