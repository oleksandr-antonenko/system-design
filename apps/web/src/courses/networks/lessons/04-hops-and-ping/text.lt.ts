import type { LessonTexts } from '../../../../lesson/dsl'
import { echoMs, type default as lesson } from './lesson'

const ONLY_PING =
  'Šioje pamokoje terminale viena komanda – ping. Po jos surinkite adresą arba vardą, pavyzdžiui: ping 192.168.1.1'

export default {
  title: 'Ping ir hops. Voko kelias per routers grandinę',
  summary:
    'Kelias iki svetainės – routers grandinė, o ping patikrina ryšį. Raskite atkarpą, kurioje dingo ryšys.',
  preview: {
    alt: 'Schema: packet keliauja nuo kompiuterio per routers grandinę, ping gauna atsakymą iš kiekvieno hop, o atsakymai nutrūksta ten, kur dingo ryšys.',
  },
  labels: {
    phone: { name: 'Phone', note: 'jūsų rankoje' },
    laptop: { name: 'Laptop', note: 'ant stalo' },
    printer: { name: 'Printer', note: 'prijungtas kabeliu prie „Router“' },
    router: { name: 'Router', note: 'jūsų namų paštas' },
    isp: {
      name: 'ISP router',
      note: 'į internetą',
    },
    core: {
      name: 'Core router',
      note: 'sankryža',
    },
    hosting: {
      name: 'Hosting router',
      note: 'svetainės tinklas',
    },
    dns: { name: 'DNS server', note: 'tiekėjo informacijos tarnyba' },
    shop: { name: 'Parduotuvės svetainė', note: 'kažkur toli' },
  },
  steps: {
    chain: {
      title: 'Paštas po pašto',
      body: `1 pamokoje internetas buvo debesis. Atverkime jį. Viduje – routers: tokie pat paštai kaip jūsų, tik didesni. Pirmasis – [[isp|ISP router]] (tiekėjo, įmonės, kuriai mokate už internetą, router). Toliau [[core|core router]] (tiekėjo mazgas) ir [[hosting|hosting router]] (tinklo, kuriame gyvena parduotuvės svetainė, router).

Viso kelio iki svetainės nežino nė vienas iš jų. Kiekvienas žino tik, kuriam kaimynui perduoti voką, kad šis atsidurtų arčiau adresato. Vienas toks perdavimas, nuo įrenginio iki kaimyno, vadinamas **hop** (lietuviškai – šuolis: voko perėjimas nuo vieno įrenginio prie kito). Spauskite „Žingsnis“ po lenta: kiekvienas paspaudimas – kitas voko hop.`,
    },
    ping: {
      title: 'Ping: „Alio, girdite?“',
      body: `Kaip patikrinti, ar vokas pasiekia adresatą? Tam yra **ping** (lietuviškai – ryšio patikrinimas). Jis siunčia trumpą voką „Ar tu čia?“ ir laukia atsakymo „Čia!“. Kaip prasto ryšio metu telefonu: „Alio, girdite mane?“ – „Girdžiu!“

Ping paleidžiamas terminale – lange, kuriame komandos renkamos tekstu. Išvesties pavyzdys – šalia lentos. Kiekviena eilutė reiškia „atsakymas grįžo“, o time – kiek vokas keliavo ten ir atgal, ms (milisekundėmis). Jei atsakymo nėra, ping parašo Request timeout: vokas kažkur pasimetė.

Paspauskite „Paleisti“: nešiojamasis kompiuteris paklaus svetainės „Ar tu čia?“.`,
      more: {
        title: 'Išsamiau: ką reiškia time ir kodėl svetainė gali tylėti',
        body: `time – kiek vokas keliavo ten ir atgal. Iki jūsų router namie – kelios milisekundės, iki svetainės kitame mieste – dešimtys, už vandenyno – šimtai. Jei time auga ir šokinėja, ryšys perkrautas.

Būna, kad svetainė atsidaro, bet į ping neatsako. Tai ne gedimas: kai kurios svetainės tyčia tyli į ping. Todėl tyla atsakant į ping – dar ne nuosprendis: patikrinkite ir pačią svetainę naršyklėje.

Tikras ping macOS ir Linux pats nesustoja: jis siunčia vokus, kol nepaspausite Ctrl+C. Čia jis išsiunčia tris ir sustoja, kaip ping Windows (ten – keturis).

Visus paštus pakeliui iš karto parodo komanda traceroute. Ją aptarsime 8 pamokoje.`,
      },
    },
    'next-hop': {
      title: 'Klausimas: kur toliau',
      body: 'Vokas iš nešiojamojo kompiuterio į parduotuvės svetainę pasiekė [[isp|„ISP router“]] ir sustojo. Kam ISP router perduos jį toliau? Nutempkite voką ant kito įrenginio arba paspauskite jį.',
    },
    'find-break': {
      title: 'Užduotis: kur dingo ryšys',
      body: `Vakar parduotuvės svetainė atsidarydavo nešiojamajame kompiuteryje, o šiandien ne. Wi-Fi yra. Raskite, kurioje atkarpoje pradingsta vokas, ir sutaisykite ryšį.

Po lenta atsidarė nešiojamojo kompiuterio terminalas. Jame kol kas viena komanda – ping. Patikrinkite paeiliui: ar atsako jūsų [[router|router]] (jo IP address – 192.168.1.1) ir ar atsako svetainė shop.example. Kur atsakymai baigiasi, ten ir trūkis.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Paspauskite „Paleisti“ arba „Žingsnis“: ping iki svetainės ir atgal, „Žingsnis“ sustabdo voką prie kito įrenginio.

- Kelias iki svetainės – routers grandinė. Kiekvienas perduoda voką kaimynui, kuris arčiau adresato. Vienas toks perdavimas – **hop**.
- **Ping** siunčia voką „Ar tu čia?“ ir laukia atsakymo. Atsakymas atėjo – ryšys iki adresato yra.
- Tikrinkite nuo artimiausios atkarpos: pirma router, paskui svetainę. Kur atsakymai baigiasi, ten ir trūkis.

Toliau, 5 pamoka „Wi-Fi. Kodėl signalas silpnas“. Virtuvėje telefonas praranda tinklą – išsiaiškinsime, kuo čia dėtos sienos ir dvi juostos.`,
    },
  },
  annotations: {
    echoTime: ({ doc }) => `ten ir atgal · ${echoMs(doc)} ms`,
  },
  quizzes: {
    'next-hop': {
      question:
        'Vokas stovi prie „ISP router“. Kam ISP router perduos jį toliau?',
      wrong: {
        router:
          'Vokas ką tik atėjo iš ten. Atgal jis neina: hop visada priartina jį prie adresato.',
        hosting:
          'Hosting router arčiau svetainės, bet nuo „ISP router“ iki jo nėra tiesioginio kabelio. Vokas keliauja tik pas kaimyną: kitas hop – visada kaimynas.',
        dns: 'Informacijos tarnyba atsako į klausimus apie vardus. Šis vokas adresuotas parduotuvės svetainei, į informacijos tarnybą jo neveš.',
      },
      tags: {
        router: 'atgal neina',
        core: 'kitas hop',
        hosting: 'ne tiekėjo kaimynas',
        dns: 'ne pakeliui',
      },
      explain:
        'ISP router perduoda voką savo kaimynui – core router, per kurį eina kelias iki svetainės. Router žino tik kitą žingsnį, o visas kelias susideda iš tokių žingsnių.',
    },
  },
  tasks: {
    'find-break': {
      prompt: 'Raskite, kur dingo ryšys, ir jį sutaisykite.',
      goals: {
        'site-opens':
          'Parduotuvės svetainė atsidaro nešiojamajame kompiuteryje',
        'ping-site': 'Ping iki shop.example praeina',
      },
      hints: [
        'Tikrinkite nuo artimiausios atkarpos. Surinkite ping 192.168.1.1: ar atsako jūsų router?',
        'Router atsako, o svetainė ne. Vadinasi, namie viskas gerai, o trūkis – tarp router ir interneto. Pažiūrėkite lentoje, kas jungia router ir ISP router.',
        'Tiekėjo kabelis iškrito iš router. Įkiškite jį: paspauskite ištrauktą kabelį. Paskui vėl surinkite ping shop.example.',
      ],
      solvedNote:
        'Router atsakė, o svetainė ne – vadinasi, trūkis buvo iškart už router. Tiekėjo kabelis vietoje, ping iki svetainės vėl praeina.',
    },
  },
  feedback: {
    GoalNotPerformed: () =>
      'Kabelis vietoje. Patikrinkite ryšį: dar kartą surinkite ping shop.example.',
    UnknownCommand: () => ONLY_PING,
    CommandUsage: () => ONLY_PING,
    CommandLocked: ({ command }) =>
      command === 'traceroute'
        ? 'Šioje pamokoje terminale viena komanda – ping. traceroute atsiras 8 pamokoje.'
        : ONLY_PING,
  },
  askAi: {
    lead: 'Prieš klausdami DI, patikrinkite ryšį komanda ping ir pridėkite išvestį:',
    template:
      'Svetainė shop.example neatsidaro, Wi-Fi yra. ping 192.168.1.1 (router) atsako, time=6 ms. ping shop.example: Request timeout, 100% packet loss. Kur ieškoti trūkio?',
    note: 'Dvi komandos ping išvestys iš karto parodo DI: namie viskas gerai, ryšys dingsta už router.',
  },
} satisfies LessonTexts<typeof lesson>
