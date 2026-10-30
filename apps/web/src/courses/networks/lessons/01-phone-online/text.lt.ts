import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Kaip telefonas patenka į internetą',
  summary:
    'Įrenginiai namuose kalbasi per maršrutizatorių, o internetas — tai daug tinklų. Prijunkite telefoną prie namų Wi-Fi.',
  labels: {
    phone: { name: 'Telefonas', note: 'jūsų rankoje' },
    laptop: { name: 'Nešiojamasis', note: 'ant stalo' },
    router: { name: 'Wi-Fi maršrutizatorius', note: 'jūsų namų paštas' },
    internet: { name: 'Internetas', note: 'visas pasaulis' },
    shop: { name: 'Parduotuvės svetainė', note: 'kažkur toli' },
  },
  steps: {
    'at-home': {
      title: 'Kas jūsų namuose',
      body: `Tai jūsų butas. Jame yra [[phone|telefonas]], [[laptop|nešiojamasis kompiuteris]] ir dėžutė su antenomis — [[router|Wi-Fi maršrutizatorius]]. Banguotos linijos — tai Wi-Fi: radijo ryšys be laidų.

Viskas, ką įrenginiai siunčia vienas kitam, — nuotraukos, žinutės, svetainių puslapiai — keliauja vokuose. Ant kiekvieno voko parašyta, nuo ko jis ir kam.

Tiesiogiai įrenginiai vokų neperduoda: net nuotrauka iš nešiojamojo į telefoną keliauja per maršrutizatorių. **Maršrutizatorius** — jūsų namų pašto skyrius: jis priima vokus iš visų įrenginių ir juos išnešioja.

Paspauskite „Paleisti“ po lenta.`,
    },
    'to-the-site': {
      title: 'Vokas iki svetainės',
      body: `Atsidarykime telefone parduotuvės svetainę. Telefonas įdeda į voką prašymą: „atsiųskite puslapį“. Ant voko tik du laukai: nuo ko ir kam.

Svetainė gyvena ne jūsų namuose, todėl maršrutizatorius voko pats neatiduoda, o perduoda jį į [[internet|internetą]]. Iš ten vokas pasiekia [[shop|parduotuvės svetainę]], o puslapis grįžta atsakymo voke tuo pačiu keliu.`,
      more: {
        title: 'Plačiau: kas iš tikrųjų yra vokas',
        body: `Vokai lentoje — supaprastinimas. Tinkluose jie vadinami **paketais**. Paketas — nedidelis duomenų gabalėlis, ant kurio parašyta, nuo ko jis ir kam.

Parduotuvės puslapis į vieną paketą netelpa: svetainė jį siunčia šimtais paketų, o telefonas juos sudeda iš eilės. To paties puslapio paketai gali keliauti net skirtingais keliais.

Ant tikro paketo vietoj vardų parašyti skaičiai — adresai, apie juos 2 pamoka. O tai, kad paketo viduje paslėpta dar keli vokai, išnagrinėsime 7 pamokoje „Po gaubtu“.`,
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
      body: `Turite naują telefoną. Namų Wi-Fi jis dar nežino: banguotos linijos iki maršrutizatoriaus nėra, ir vokai iš telefono niekur neišeina.

Prijunkite jį telefono ekrane, Wi-Fi nustatymuose. Jūsų tinklo pavadinimas ir slaptažodis parašyti ant maršrutizatoriaus [[sticker|lipduko]].`,
    },
    summary: {
      title: 'Santrauka',
      body: `Perėjote visą voko kelią: telefonas → maršrutizatorius → internetas → parduotuvės svetainė ir atgal.

- Įrenginiai namuose kalbasi per **maršrutizatorių** — jūsų namų pašto skyrių.
- **Internetas** — tai daug tarpusavyje sujungtų tinklų. Maršrutizatorius — durys iš namų į internetą.
- Kad telefonas patektų į internetą, jis prijungiamas prie maršrutizatoriaus Wi-Fi: savas tinklas ir slaptažodis nuo lipduko.

Toliau, 2 pamoka: kiekvienas turi savo adresą. Šiandien ant vokų buvo vardai, bet maršrutizatorius vardų neskaito. Sužinosime, kokie adresai rašomi ant tikrų vokų ir kas juos išduoda.`,
    },
  },
  annotations: {},
  quizzes: {
    'way-out': {
      question: 'Per kurį įrenginį vokas išeina iš namų į internetą?',
      wrong: {
        laptop:
          'Nešiojamasis — telefono kaimynas namuose. Jis pats siunčia vokus per maršrutizatorių, o svetimi vokai per jį nekeliauja.',
        shop: 'Parduotuvės svetainė — gavėja. Telefonas tiesiogiai jos nepasiekia: pirmiausia vokas turi išeiti iš namų.',
      },
      tags: {
        laptop: 'svetimų vokų nenešioja',
        router: 'išėjimas į internetą',
        shop: 'tai gavėja',
      },
      explain:
        'Maršrutizatorius — jūsų namų durys į internetą: visi vokai išeina per jį ir per jį grįžta.',
    },
  },
  tasks: {
    'join-wifi': {
      prompt:
        'Prijunkite naują telefoną prie namų Wi-Fi. Tinklo pavadinimas ir slaptažodis — ant maršrutizatoriaus lipduko.',
      goals: {
        wifi: 'Telefonas jūsų maršrutizatoriaus Wi-Fi tinkle',
        opens: 'Parduotuvės svetainė atsidaro telefone',
      },
      hints: [
        'Kur paprastai rašomas namų Wi-Fi slaptažodis? Pažiūrėkite į patį maršrutizatorių: paspauskite lipduką lentoje.',
        'Ant lipduko yra tinklo pavadinimas. Raskite sąraše lygiai tokį patį: kaimyno tinklas panašus, bet skaitmenys kiti.',
        'Paspauskite „Router-7C21“, įveskite slaptažodį nuo lipduko ir paspauskite „Prisijungti“. Sąraše šis tinklas apvestas punktyru, o lipdukas lentoje mirksi.',
      ],
      solvedNote:
        'Telefonas namų Wi-Fi tinkle: atsirado banguota linija iki maršrutizatoriaus. Paspauskite „Paleisti“ — vokas pasieks svetainę ir grįš su puslapiu.',
    },
  },
  feedback: {
    NoWifiProfile:
      'Telefonas dar nežino namų tinklo: pasirinkite jį Wi-Fi nustatymuose ir įveskite slaptažodį nuo lipduko.',
    WrongPassword:
      'Slaptažodis netiko. Palyginkite jį su lipduku: svarbus kiekvienas skaitmuo.',
    WrongSsid: ({ ssid }) =>
      ssid === 'Кафе Утро'
        ? 'Tai atviras kavinės tinklas: slaptažodžio nereikia, prisijungti gali bet kuris praeivis. Vokai keliautų per kavinės maršrutizatorių, o ne per jūsų. Namuose rinkitės savo tinklą nuo lipduko.'
        : 'Ar tikrai tai jūsų tinklas? Palyginkite pavadinimą su lipduku.',
  },
} satisfies LessonTexts<typeof lesson>
