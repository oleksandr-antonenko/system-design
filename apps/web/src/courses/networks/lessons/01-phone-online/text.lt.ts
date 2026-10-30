import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Router. Kaip telefonas patenka į internetą',
  summary:
    'Namų įrenginiai kalbasi per router, o internetas — tai daug tinklų. Prijunkite telefoną prie namų Wi-Fi.',
  preview: {
    alt: 'Schema: telefonas jungiasi prie namų Wi-Fi, o router kabeliu sujungia namų tinklą su internetu – daugybe tarpusavyje sujungtų tinklų.',
  },
  labels: {
    phone: { name: 'Phone', note: 'jūsų rankoje' },
    laptop: { name: 'Laptop', note: 'ant stalo' },
    router: { name: 'Router', note: 'jūsų namų paštas' },
    internet: { name: 'Internet', note: 'visas pasaulis' },
    shop: { name: 'Parduotuvės svetainė', note: 'kažkur toli' },
  },
  steps: {
    'at-home': {
      title: 'Kas jūsų namuose',
      body: `Tai jūsų butas. Jame yra [[phone|telefonas]], [[laptop|nešiojamasis kompiuteris]] ir dėžutė su antenomis, lentoje pažymėta [[router|„Router“]]. Banguotos linijos — tai Wi-Fi: radijo ryšys be laidų.

Tinklo įrenginiai ir terminai šiame kurse rašomi angliškai, kaip tikrų įrenginių nustatymuose, terminale ir dokumentacijoje, o pirmą kartą kiekvienas paaiškinamas lietuviškai.

Viskas, ką įrenginiai siunčia vienas kitam, — nuotraukos, žinutės, svetainių puslapiai — keliauja vokuose (tinkluose vokas vadinamas packet). Ant kiekvieno voko parašyta, nuo ko jis ir kam.

**Router** (lietuviškai – maršrutizatorius) – jūsų namų pašto skyrius: jis priima vokus iš visų įrenginių ir juos išnešioja. Tiesiogiai įrenginiai vokų neperduoda: net nuotrauka iš nešiojamojo į telefoną keliauja per router.

Paspauskite „Paleisti“ po lenta.`,
    },
    'to-the-site': {
      title: 'Vokas iki svetainės',
      body: `Atsidarykime telefone parduotuvės svetainę. Telefonas įdeda į voką prašymą: „atsiųskite puslapį“. Ant voko tik du laukai: nuo ko ir kam.

Svetainė gyvena ne jūsų namuose, todėl router voko pats neatiduoda, o perduoda jį į [[internet|internetą]]. Iš ten vokas pasiekia [[shop|parduotuvės svetainę]], o puslapis grįžta atsakymo voke tuo pačiu keliu.`,
      more: {
        title: 'Plačiau: kas iš tikrųjų yra vokas',
        body: `Vokai lentoje — supaprastinimas. Tinkluose vokas vadinamas **packet** (lietuviškai – paketas). Packet — nedidelis duomenų gabalėlis, ant kurio parašyta, nuo ko jis ir kam.

Parduotuvės puslapis į vieną packet netelpa: svetainė jį siunčia šimtais dalių, kiekviena dalis — atskiras packet, o telefonas jas sudeda iš eilės. To paties puslapio dalys gali keliauti net skirtingais keliais.

Tikras packet vietoj vardų nešioja skaičius — adresus, apie juos 2 pamoka. O tai, kad viduje packet slepia dar kelis vokus, išnagrinėsime 7 pamokoje „TCP/IP. Vokas voke“.`,
      },
    },
    'many-networks': {
      title: 'Internetas — tai daug tinklų',
      body: `Debesies viduje ne vienas milžiniškas kompiuteris, o tūkstančiai tinklų, panašių į jūsų namų tinklą, tik didesnių: įmonių, kurioms mokate už internetą, tinklai, miestų tinklai, parduotuvės tinklas. Kiekvienas sujungtas su kaimyniniais.

**Internetas** — tai daug tarpusavyje sujungtų tinklų. Vokas perduodamas iš tinklo į tinklą, kol pasiekia gavėją, kaip siuntinys iš skyriaus į skyrių. Paspauskite „Paleisti“.`,
    },
    'way-out': {
      title: 'Klausimas: kur išėjimas iš namų',
      body: 'Telefonas siunčia voką parduotuvės svetainei. Per kurį įrenginį vokas išeina iš namų į internetą? Paspauskite jį lentoje.',
    },
    'join-wifi': {
      title: 'Užduotis: prijunkite telefoną',
      body: `Turite naują telefoną. Namų Wi-Fi jis dar nežino: banguotos linijos iki „Router“ nėra, ir vokai iš telefono niekur neišeina.

Prijunkite jį telefono ekrane, Wi-Fi nustatymuose. Jūsų tinklo pavadinimas (ant lipduko jis pažymėtas SSID) ir slaptažodis parašyti ant „Router“ [[sticker|lipduko]].`,
    },
    summary: {
      title: 'Santrauka',
      body: `Perėjote visą voko kelią: telefonas → router → internetas → parduotuvės svetainė ir atgal.

- Namų įrenginiai kalbasi per **router**: jis — jūsų namų pašto skyrius.
- **Internetas** — tai daug tarpusavyje sujungtų tinklų. Router — durys iš namų į internetą.
- Kad telefonas patektų į internetą, jis prijungiamas prie „Router“ Wi-Fi: savas tinklas ir slaptažodis nuo lipduko.

Toliau, 2 pamoka „IP address. Kiekvienas įrenginys turi savo adresą“. Šiandien ant vokų buvo vardai, bet router vardų neskaito. Sužinosime, kokie adresai rašomi ant tikrų vokų ir kas juos išduoda.`,
    },
  },
  annotations: {},
  quizzes: {
    'way-out': {
      question: 'Per kurį įrenginį vokas išeina iš namų į internetą?',
      wrong: {
        laptop:
          'Nešiojamasis — telefono kaimynas namuose. Jis pats siunčia vokus per router, o svetimi vokai per jį nekeliauja.',
        shop: 'Parduotuvės svetainė — gavėja. Telefonas tiesiogiai jos nepasiekia: pirmiausia vokas turi išeiti iš namų.',
      },
      tags: {
        laptop: 'svetimų vokų nenešioja',
        router: 'išėjimas į internetą',
        shop: 'tai gavėja',
      },
      explain:
        'Router — jūsų namų durys į internetą: visi vokai išeina per jį ir per jį grįžta.',
    },
  },
  tasks: {
    'join-wifi': {
      prompt:
        'Prijunkite naują telefoną prie namų Wi-Fi. Tinklo pavadinimas (SSID) ir slaptažodis — ant „Router“ lipduko.',
      goals: {
        wifi: 'Telefonas prisijungęs prie „Router“ Wi-Fi',
        opens: 'Parduotuvės svetainė atsidaro telefone',
      },
      hints: [
        'Kur paprastai rašomas namų Wi-Fi slaptažodis? Pažiūrėkite į patį router: paspauskite lipduką lentoje.',
        'Ant lipduko yra SSID — tinklo pavadinimas. Raskite sąraše lygiai tokį patį: kaimyno tinklas panašus, bet skaitmenys kiti.',
        'Paspauskite „Router-7C21“, įveskite slaptažodį nuo lipduko ir paspauskite „Prisijungti“. Sąraše šis tinklas apvestas punktyru, o lipdukas lentoje mirksi.',
      ],
      solvedNote:
        'Telefonas namų Wi-Fi tinkle: atsirado banguota linija iki „Router“. Paspauskite „Paleisti“ — vokas pasieks svetainę ir grįš su puslapiu.',
    },
  },
  feedback: {
    NoWifiProfile:
      'Telefonas dar nežino namų tinklo: pasirinkite jį Wi-Fi nustatymuose ir įveskite slaptažodį nuo lipduko.',
    WrongPassword:
      'Slaptažodis netiko. Palyginkite jį su lipduku: svarbus kiekvienas skaitmuo.',
    WrongSsid: ({ ssid }) =>
      ssid === 'Кафе Утро'
        ? 'Tai atviras kavinės tinklas: slaptažodžio nereikia, prisijungti gali bet kuris praeivis. Vokai keliautų per kavinės router, o ne per jūsiškį. Namuose rinkitės savo tinklą nuo lipduko.'
        : 'Ar tikrai tai jūsų tinklas? Palyginkite SSID su lipduku.',
  },
} satisfies LessonTexts<typeof lesson>
