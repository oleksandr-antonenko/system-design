import { Option } from 'effect'

import { type SimResult, simulationRules } from '../../domain/simulate'
import { formatNumber } from '../../i18n/format'
import type { LessonTexts } from '../../lesson/dsl'
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

export default {
  title: 'Podėliavimas',
  summary:
    'Cache-aside, pataikymų dalis ir TTL: kaip sumažinti duomenų bazės apkrovą.',
  steps: {
    'five-servers': {
      title: 'Penki serveriai, viena bazė',
      body: `Internetinė parduotuvė iš 3 pamokos išaugo. [[users|Naudotojai]] per [[lb|balansuotuvą]] patenka į penkis serverius, nuo [[app1|app1]] iki [[app5|app5]], ir visi jie dirba su viena [[db|duomenų baze]]. Dabar ateina 1200 rps.

Kiekvienam serveriui tenka po 240 rps – 60 % jo pajėgumo. Bazei sunkiau: į ją suplaukia visų serverių užklausos, todėl ji gauna visą srautą – 1200 rps iš 1500 galimų. Tai 80 %: labiausiai apkrautas lentos blokas.`,
    },
    'db-overload': {
      title: 'Bazė užspringsta',
      body: `Prasidėjo šventinis išpardavimas, ir apkrova išaugo iki **1600 rps**. Serveriai susitvarko: [[app3|kiekvienas iš jų]] gauna 320 rps, tai 80 % pajėgumo. O [[db|bazė]] gauna visą 1600 rps srautą, bet spėja apdoroti tik 1500. Likusios 100 užklausų per sekundę prarandamos: tai raudoni taškai ant ryšių į bazę, apie 6 % klaidų. Praėjusios užklausos laukia eilėje, ir p95 šoktelėjo virš pusės sekundės.

Šeštas serveris nepadėtų. Serveriams būtų lengviau, bet bazė vis tiek gautų tuos pačius 1600 rps. Siauras kaklelis dabar ne serveriuose, o už jų.`,
    },
    'reads-and-writes': {
      title: 'Skaitymas ir rašymas',
      body: `Pažiūrėkime, ko serveriai prašo iš bazės. Dauguma užklausų tik **skaito**: atidaryti prekę, parodyti katalogą, patikrinti likutį. Ir tik nedaugelis **rašo**: pateikti užsakymą, palikti atsiliepimą. Šiame kurse ${percent(1 - writeShare)} užklausų – skaitymas, o ${percent(writeShare)} – rašymas, tad iš 1600 rps skaitymui tenka 1280.

Be to, skaitymai kartojasi. Pagrindinį puslapį ir šimtą populiariausių prekių atidaro tūkstančiai žmonių, ir kaskart bazė iš naujo ieško tų pačių eilučių. Jei įsimintume atsakymą į populiarią užklausą, antrą kartą klausti bazės nereikėtų.

Tokia atmintis vadinama **podėliu** (cache): tai saugykla, laikanti duomenis operatyviojoje atmintyje, pavyzdžiui, Redis arba Memcached. Skaitymas iš podėlio trunka ${cacheHitMs} ms. Skaitymų dalis, į kuriuos podėlis atsako pats, vadinama **pataikymų dalimi** (hit rate); šiame kurse ji siekia ${percent(cacheHitShare)}. Kiti skaitymai – **nepataikymai** (miss), jie keliauja toliau į bazę.`,
    },
    'place-cache': {
      title: 'Užduotis: podėlis',
      body: `Pastatykite podėlį tarp serverių ir [[db|bazės]]. Serveriai siunčia skaitymo užklausas į podėlį: pataikymus jis aptarnauja pats, o nepataikymus perduoda bazei.

Kiekvieno serverio ryšį su baze palikite: rašymas keliauja tik ten. Podėlyje laikomos kopijos, o originalai saugomi bazėje. Podėlis jau yra paletėje.`,
    },
    'stale-data': {
      title: 'Pasenę duomenys',
      body: ({ sim }) =>
        `[[db|Bazė]] atsikvėpė: dabar ji gauna ${n(sim.databaseLoad)} rps vietoj 1600. Iš jų ${n(writes(sim))} – rašymas. Čia podėlis nepadeda: kiekvienas rašymas vis tiek keliauja į bazę. Likę ${n(missedReads(sim))} – skaitymai, kurių nebuvo podėlyje. p95 nukrito iki ${p95(sim)}.

Kaip duomenys patenka į podėlį? Dažniausiai tuo rūpinasi serveris: pirmiausia klausia podėlio, o nepataikęs skaito iš bazės ir įdeda atsakymą į podėlį. Toks būdas vadinamas **cache-aside**. Lentoje [[cache-1|podėlis]] pats kreipiasi į bazę (read-through), bet bazei tai nesvarbu.

Už podėlį tenka mokėti **pasenusiais duomenimis**. Prekės kaina bazėje pasikeitė, o podėlis vis dar pateikia senąją. Viena apsauga – **TTL** (time to live, galiojimo laikas): kiekvienas raktas podėlyje gyvuoja, tarkime, 60 sekundžių ir išnyksta, o kitas skaitymas paima naują reikšmę iš bazės. Kita – **invalidavimas**: rašydamas serveris iš karto ištrina raktą iš podėlio. TTL paprastas, bet palieka pasenusių duomenų langą; invalidavimas tikslesnis, bet jį lengva pamiršti kurioje nors vietoje, kur rašoma. Dažniausiai jie derinami.`,
    },
    'cache-down': {
      title: 'Kai podėlis sugenda',
      body: ({ sim }) =>
        `[[cache-1|Podėlis]] sugedo. ${
          sim.errorRate > 0.01
            ? `Serveriai vėl siunčia skaitymo užklausas tiesiai į [[db|bazę]]. Ji gauna ${n(sim.databaseLoad)} rps, ir ${percent(sim.errorRate)} užklausų prarandama, kaip ir prieš podėlį.`
            : `Jūsų lentoje skaitymus perėmė kitas podėlis, todėl [[db|bazė]] laikosi: ${n(sim.databaseLoad)} rps. Su vienu podėliu ji vėl gautų 1600 rps ir klaidas.`
        }

Podėlyje laikomos tik kopijos, bet be jo sistema jau nebegali veikti. Pavojingas net perkrovimas: podėlis grįžta tuščias, arba **šaltas**, ir kurį laiką kiekvienas skaitymas – nepataikymas. Todėl podėlis paleidžiamas keliuose mazguose ir „įšildomas“ prieš nukreipiant į jį srautą, o apkrovą, kurią bazė gautų be podėlio, visada reikia turėti omenyje.`,
    },
    summary: {
      title: 'Santrauka',
      body: ({ sim }) =>
        `Podėlis vėl veikia. Jis nuima nuo bazės pasikartojančius skaitymus: kai pataikymų dalis siekia ${percent(cacheHitShare)}, bazę pasiekia tik ${percent(1 - cacheHitShare)} skaitymų. Bazės apkrova sumažėjo nuo 1600 iki ${n(sim.databaseLoad)} rps, o podėlis kainuoja 0,15 $ per valandą.

Podėlyje laikykite tai, kas dažnai skaitoma ir retai keičiasi. Raktams nustatykite TTL ir ištrinkite juos iš podėlio, kai duomenys pasikeičia. Atminkite, kad rašymas vis tiek keliauja į bazę, o be podėlio bazė vėl perkrauta.

Dabar labiausiai apkrauti blokai – [[app3|serveriai]], 80 %. Nemaža jų darbo dalis visai ne parduotuvės logika, o paveikslėliai, skriptai ir stiliai, vienodi visiems lankytojams. 5 pamokoje juos perims **CDN**.`,
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
      `pataikymų ${n(incoming(sim, 'cache-1') * cacheHitShare)} iš ${n(incoming(sim, 'cache-1'))} rps`,
    dbAfter: sim =>
      `rašymas ${n(writes(sim))} + nepataikymai ${n(missedReads(sim))} rps`,
    serversNext: sim =>
      `${n(incoming(sim, 'app3'))} rps iš 400 · ${percent(utilization(sim, 'app3'))}`,
  },
  tasks: {
    'place-cache': {
      prompt:
        'Nuimkite skaitymą nuo bazės: pastatykite podėlį tarp serverių ir bazės.',
      goals: {
        'cache-exists': 'Lentoje yra podėlis',
        'servers-use-cache': 'Serveriai prijungti prie podėlio',
        'cache-backed-by-db': 'Podėlis prijungtas prie bazės',
        'db-relieved':
          'Bazė apkrauta ne daugiau kaip 60 %, kai ateina 1600 rps',
        'holds-load': 'Atlaiko 1600 rps, kai klaidų mažiau nei 1 %',
      },
      hints: [
        'Dauguma užklausų į bazę – pasikartojantys skaitymai. Atsakymus į juos galima laikyti arčiau, greitoje atmintyje.',
        'Pastatykite podėlį tarp serverių ir bazės. Prie jo prijunkite kiekvieną serverį, o patį podėlį – prie bazės nepataikymams. Serverių ryšių su baze netrinkite: jais keliauja rašymas.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite podėlį ten ir nutieskite pažymėtus ryšius: nuo kiekvieno iš penkių serverių iki podėlio ir nuo podėlio iki bazės.',
      ],
      solvedNote:
        'Keturis skaitymus iš penkių dabar aptarnauja podėlis, o bazė turi atsargą.',
    },
  },
} satisfies LessonTexts<typeof lesson>
