import { formatNumber } from '../../i18n/format'
import type { LessonTexts } from '../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`

export default {
  title: 'Atskira duomenų bazė',
  summary:
    'Kodėl serverius be būsenos lengviau plėsti ir kur laikyti duomenis.',
  steps: {
    'all-in-one': {
      title: 'Viskas viename serveryje',
      body: `Internetinė parduotuvė iš ankstesnės pamokos veikia viename [[app1|serveryje]]. [[users|Naudotojai]] prisijungia prie paskyros, pildo krepšelį ir pateikia užsakymus. Dabar ateina 300 rps, o serveris gali apdoroti 400.

Visi parduotuvės duomenys laikomi pačiame serveryje: paskyros ir užsakymai – failuose jo diske, krepšeliai ir sesijos – atmintyje. Tai paprasta ir greita, kol serveris vienas ir veikia.`,
    },
    'server-fails': {
      title: 'Serveris sugedo',
      body: `Naktį sugedo [[app1|serverio]] diskas. Visos užklausos baigiasi klaida: raudoni taškai – tai kiekvienas parduotuvės naudotojas, o prietaisas „Klaidos“ rodo 100 %.

Kartu su serveriu dingo ir duomenys. Kol jį taiso, užsakymų nemato niekas, o jei disko nepavyks atkurti, jie prarasti visam laikui. Net įprastas paleidimas iš naujo diegiant atnaujinimą ištrina krepšelius ir sesijas iš atminties.`,
    },
    'second-server': {
      title: 'Antras serveris nepadės',
      body: `Serveris sutaisytas, ir šįkart duomenys išliko. Kad nepriklausytume nuo vienos mašinos, norisi pastatyti antrą serverį, [[app2|app2]]. Tačiau jis tuščias: visi užsakymai ir paskyros saugomi [[app1|app1]] diske.

Tarkime, dalis naudotojų bus nukreipta į app2. Ona pateikė užsakymą per app1, o kita jos užklausa pateko į app2. Šiam serveriui Ona – nepažįstamoji: krepšelis tuščias, reikia vėl prisijungti, užsakymo istorijoje nėra. Kopijuoti kiekvieną įrašą tarp serverių sudėtinga, ir kopijos greitai ima skirtis.

Duomenys, kuriuos serveris prisimena tarp užklausų, vadinami **būsena**. Serverio su būsena (stateful) negalima tiesiog pakeisti kitu ar pastatyti šalia antro tokio paties.`,
    },
    'move-data': {
      title: 'Užduotis: atskira bazė',
      body: `Išeitis – iškelti būseną iš serverio į atskirą saugyklą, **duomenų bazę**. Ji tampa vienintele vieta, kur gyvena duomenys. Apdorodamas kiekvieną užklausą, serveris skaito iš bazės ir rašo į ją, o pas save nieko nelaiko. Toks serveris vadinamas **serveriu be būsenos** (stateless).

Duomenų bazė jau atsirado paletėje kairėje nuo lentos.`,
    },
    'replace-server': {
      title: 'Serverį galima pakeisti',
      body: `Vėl gedimas: [[app1|app1]] neveikia. Tačiau šįkart jis nenusinešė nė vieno užsakymo, nes duomenys saugomi [[db2|bazėje]]. Prijungėme [[app2|app2]] prie tos pačios bazės ir nukreipėme į jį [[users|naudotojus]]. Ona prisijungia ir mato savo užsakymą.

Serveriai be būsenos yra pakeičiami: bet kuris iš jų gali apdoroti bet kurią užklausą, nes viską, ko reikia, ima iš bazės. Juos galima paleisti iš naujo, atnaujinti ir pridėti neprarandant duomenų. Kaip paskirstyti užklausas keliems serveriams vienu metu, aptarsime 3 pamokoje.`,
    },
    summary: {
      title: 'Santrauka',
      body: ({ sim }) =>
        `Būsena gyvena [[db2|bazėje]], o serveriai jos nelaiko. Todėl serverį galima pakeisti arba pridėti dar vieną, ir duomenys nenukentės. [[app1|app1]] sutaisytas ir dabar yra paruoštas atsarginis serveris: nieko į jį kopijuoti nereikia.

Šis sprendimas turi kainą: kiekviena kiekvieno serverio užklausa keliauja į bazę. Prietaisas „Užklausos į bazę“ rodo ${n(sim.databaseLoad)} rps – lygiai tiek, kiek apdoroja [[app2|app2]]. Viena bazė atlaiko apie **1500 rps**, ir kai serverių bus daug, ji taps kitu siauru kakleliu. 4 pamokoje ją palengvins **podėlis** (cache), o 6 pamokoje – **replikos**.`,
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
        'Padarykite taip, kad parduotuvės duomenys būtų laikomi ne serveryje, o atskiroje duomenų bazėje.',
      goals: {
        'db-exists': 'Lentoje yra duomenų bazė',
        'server-uses-db': 'Serveris prijungtas prie bazės',
        'holds-load': 'Atlaiko 300 rps, kai klaidų mažiau nei 1 %',
      },
      hints: [
        'Duomenims reikia savų namų už serverio ribų, į kuriuos serveris kreiptųsi per kiekvieną užklausą.',
        'Pastatykite duomenų bazę dešinėje nuo app1 ir nutieskite ryšį nuo serverio į bazę. Vos tik bazė atsiras lentoje, serveris be ryšio su ja negalės atsakyti nė į vieną užklausą.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite bazę ten ir nutieskite pažymėtą ryšį nuo app1 į bazę.',
      ],
      solvedNote:
        'Serveris skaito ir rašo duomenis į bazę, o pats nieko nelaiko.',
    },
  },
} satisfies LessonTexts<typeof lesson>
