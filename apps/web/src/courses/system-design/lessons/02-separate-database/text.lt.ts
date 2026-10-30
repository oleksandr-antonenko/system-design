import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`

export default {
  title: 'Separate database. Duomenys atskiroje mašinoje',
  summary:
    'Kodėl stateless server lengviau plėsti ir kodėl duomenims reikia atskiros database.',
  preview: {
    alt: 'Schema: stateless server nelaiko savų duomenų ir viena jungtimi siunčia skaitymus bei įrašus į atskirą database savoje mašinoje.',
  },
  steps: {
    'all-in-one': {
      title: 'Vienas server viskam',
      body: `Internetinę parduotuvę iš ankstesnės pamokos aptarnauja vienas [[app1|server]]. [[users|Users]] prisijungia prie paskyros, pildo krepšelį ir pateikia užsakymus. Dabar ateina 300 rps, o server gali apdoroti 400.

Visus parduotuvės duomenis server laiko pas save: paskyros ir užsakymai – failuose jo diske, krepšeliai ir sesijos – atmintyje. Tai paprasta ir greita, kol server vienas ir veikia.`,
    },
    'server-fails': {
      title: 'Server sugedo',
      body: `Naktį sugedo [[app1|app1]] diskas. Visos užklausos baigiasi klaida: raudoni taškai – tai kiekvienas parduotuvės naudotojas, o prietaisas „Klaidos“ rodo 100 %.

Duomenys dingo kartu su server. Kol jį taiso, užsakymų nemato niekas, o jei disko nepavyks atkurti, jie prarasti visam laikui. Net įprastas paleidimas iš naujo diegiant atnaujinimą ištrina krepšelius ir sesijas iš atminties.`,
    },
    'second-server': {
      title: 'Antras server nepadės',
      body: `Server sutaisytas, ir šįkart duomenys išliko. Kad nepriklausytume nuo vienos mašinos, norisi pastatyti antrą server, [[app2|app2]]. Tačiau jis tuščias: visi užsakymai ir paskyros saugomi [[app1|app1]] diske.

Tarkime, dalis naudotojų bus nukreipta į app2. Ona pateikė užsakymą per app1, o kita jos užklausa pateko į app2. Ten Ona – nepažįstamoji: krepšelis tuščias, reikia vėl prisijungti, užsakymo istorijoje nėra. Kopijuoti kiekvieną įrašą iš vieno server į kitą sudėtinga, ir kopijos greitai ima skirtis.

Duomenys, kuriuos server prisimena tarp užklausų, vadinami **būsena** (state). Server, kuris laiko būseną, vadinamas **stateful** (lietuviškai – su būsena). Tokio server negalima tiesiog pakeisti kitu ar pastatyti šalia antro tokio paties.`,
    },
    'move-data': {
      title: 'Užduotis: atskira database',
      body: `Išeitis – iškelti būseną iš server į atskirą saugyklą. **Database** (lietuviškai – duomenų bazė) – tokia saugykla, vienintelė vieta, kur gyvena duomenys. Apdorodamas kiekvieną užklausą, server skaito iš database ir rašo į ją, o pas save nieko nelaiko. Toks server vadinamas **stateless** (lietuviškai – be būsenos).

Blokas „Database“ jau atsirado paletėje kairėje nuo lentos.`,
    },
    'replace-server': {
      title: 'Server galima pakeisti',
      body: `Vėl gedimas: [[app1|app1]] neveikia. Tačiau šįkart jis nenusinešė nė vieno užsakymo, nes duomenis saugo [[db2|database]]. Prijungėme [[app2|app2]] prie tos pačios database ir nukreipėme į jį [[users|users]]. Ona prisijungia ir mato savo užsakymą.

Stateless server tarpusavyje pakeičiami: bet kuris iš jų gali apdoroti bet kurią užklausą, nes viską, ko reikia, ima iš database. Juos galima paleisti iš naujo, atnaujinti ir pridėti neprarandant duomenų. Kaip užklausas vienu metu paskirstyti keliems blokams „Server“, aptarsime 3 pamokoje.`,
    },
    summary: {
      title: 'Santrauka',
      body: ({ sim }) =>
        `Būseną saugo [[db2|database]], o server blokai jos nelaiko. Todėl server galima pakeisti arba pridėti dar vieną, ir duomenys nenukentės. [[app1|app1]] sutaisytas ir dabar yra paruoštas atsarginis server: nieko į jį kopijuoti nereikia.

Šis sprendimas turi kainą: kiekviena kiekvieno server užklausa keliauja į database. Prietaisas „Database apkrova“ rodo ${n(sim.databaseLoad)} rps – lygiai tiek, kiek apdoroja [[app2|app2]]. Viena database atlaiko apie **1500 rps**, ir kai server bus daug, ji taps kitu siauru kakleliu (bottleneck). 4 pamokoje ją palengvins **cache** (lietuviškai – podėlis, greita atmintis dažnai skaitomiems duomenims), o 6 pamokoje – **read replicas** (lietuviškai – skaitymo replikos, database kopijos, atsakančios į skaitymo užklausas).`,
    },
  },
  annotations: {
    app1Data: sim =>
      `${n(sim.nodes['app1']?.incoming ?? 0)} rps · duomenys viduje`,
    outage: sim => `klaidos ${percent(sim.errorRate)} · duomenys nepasiekiami`,
    app1Orders: sim =>
      `${n(sim.nodes['app1']?.incoming ?? 0)} rps · visi užsakymai čia`,
    app2Empty: sim =>
      `${n(sim.nodes['app2']?.incoming ?? 0)} rps · nė vieno užsakymo`,
    app2Serves: sim =>
      `${n(sim.nodes['app2']?.incoming ?? 0)} rps · užsakymai vietoje`,
    spare: sim => `${n(sim.nodes['app1']?.incoming ?? 0)} rps · atsarginis`,
    databaseLoad: sim => `${n(sim.databaseLoad)} rps iš ${n(1500)} galimų`,
  },
  tasks: {
    'move-data': {
      prompt:
        'Padarykite taip, kad parduotuvės duomenis saugotų ne server, o atskira database.',
      goals: {
        'db-exists': 'Lentoje yra blokas „Database“',
        'server-uses-db': 'Server prijungtas prie „Database“',
        'holds-load': 'Atlaiko 300 rps, kai klaidų mažiau nei 1 %',
      },
      hints: [
        'Duomenims reikia savų namų už server ribų, į kuriuos server kreiptųsi per kiekvieną užklausą.',
        'Pastatykite bloką „Database“ dešinėje nuo app1 ir nutieskite ryšį nuo server į database. Vos tik database atsiras lentoje, server be ryšio su ja negalės atsakyti nė į vieną užklausą.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite ten bloką „Database“ ir nutieskite pažymėtą ryšį nuo app1 į database.',
      ],
      solvedNote:
        'Server skaito ir rašo duomenis į database, o pats nieko nelaiko.',
    },
  },
} satisfies LessonTexts<typeof lesson>
