import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Screen lock. Biuras be priežiūros',
  summary:
    'Atidarytas kompiuteris ir rastas USB atmintukas – atviros durys. Išeidami užrakinkite ekraną, susitvarkykite slaptažodžius bei spaudinius, o rastus atmintukus atiduokite IT.',
  preview: {
    alt: 'Iliustracija: tuščia kėdė prie stalo, kompiuteryje įjungtas screen lock su žaliu užraktu, o svetimas atmintukas guli nepaliestas ant krašto.',
  },
  labels: {
    marina: { name: 'Marina' },
    oleg: { name: 'Olegas' },
    striped: { name: 'Dryžuotasis' },
    'desk-app': { name: 'Marinos stalas' },
    'group:desk': {
      name: 'Prieš pietus',
      note: 'Po minutės Marina eina pietauti. Nuspręskite, ką daryti su kiekvienu daiktu ant stalo.',
    },
    'item:laptop': {
      name: 'Nešiojamasis kompiuteris',
      note: 'Ekranas atviras: paštas, CRM ir pokalbiai matomi.',
    },
    'item:sticker': {
      name: 'Lipdukas ant monitoriaus',
      note: 'CRM slaptažodis, parašytas ranka.',
    },
    'item:printout': {
      name: 'Spaudinys spausdintuve',
      note: 'Skyriaus atlyginimų žiniaraštis. Dėkle guli nuo ryto.',
    },
    'item:usb': {
      name: 'Atmintukas su širdele',
      note: 'Rastas rytą automobilių stovėjimo aikštelėje. Kieno – neaišku.',
    },
    'action:lock': { name: 'Užrakinti ekraną' },
    'action:leave': { name: 'Palikti – aš neilgam' },
    'action:vault': { name: 'Slaptažodį – į seifą, lipduką – į smulkintuvą' },
    'action:flip': { name: 'Apversti užrašu žemyn' },
    'action:take': { name: 'Pasiimti ir padėti į stalčių' },
    'action:later': { name: 'Tegul guli, paimsiu vėliau' },
    'action:to-it': { name: 'Atiduoti Irai į IT' },
    'action:plug': { name: 'Įkišti ir pažiūrėti, kieno' },
    'res:laptop:lock': {
      name: 'Ekranas užgeso ir prašo slaptažodžio. Viskas, kas atidaryta, liko vietoje ir jūsų laukia.',
    },
    'res:laptop:leave': {
      name: 'Stop: kol jūsų nėra, bet kas skaito jūsų paštą ir rašo laiškus jūsų vardu. Spauskite „Užrakinti ekraną“.',
    },
    'res:sticker:vault': {
      name: 'Slaptažodis dabar gyvena slaptažodžių tvarkyklėje, o ne ant monitoriaus.',
    },
    'res:sticker:flip': {
      name: 'Apverstą lipduką atverčia per sekundę. Slaptažodžio vieta – seife.',
    },
    'res:printout:take': {
      name: 'Žiniaraštis stalčiuje. Svetimų atlyginimų prie spausdintuvo niekas nebeskaitys.',
    },
    'res:printout:later': {
      name: 'Spausdintuvo dėklą mato visi praeinantys. Svetimi duomenys „vėliau“ nelaukia.',
    },
    'res:usb:to-it': {
      name: 'Ira patikrins atmintuką atskirame kompiuteryje, kuris neprijungtas prie darbo tinklo.',
    },
    'res:usb:plug': {
      name: 'Stop: atmintukas gali pats paleisti programą arba apsimesti klaviatūra ir surinkti komandas. Realybėje dabar: ištraukite jį ir iškart pasakykite Irai.',
    },
  },
  steps: {
    'open-door': {
      title: 'Atidarytas kompiuteris – atviros durys',
      body: `Olegas nuėjo kavos ir paliko [[laptop|kompiuterį]] atidarytą. Po minutės prie jo jau sėdi „kolega“.

Kas atsisėdo prie atidaryto kompiuterio, visoms sistemoms yra jūs. Jis skaito jūsų paštą ir rašo laiškus jūsų vardu, atidaro CRM ir pokalbius. Jokio slaptažodžio jam nereikia: jūs jau prisijungę.

Užtenka minutės. O bendrame biure pro stalą per dieną praeina dešimtys žmonių: kurjeriai, svečiai, valytojai.`,
    },
    'two-minutes': {
      title: 'Klausimas: dvi minutės',
      body: 'Marina dviem minutėms nueina prie spausdintuvo. Ką daryti su kompiuteriu?',
    },
    lock: {
      title: 'Ekrano užrakinimas',
      body: `**Screen lock** (ekrano užrakinimas) – ekranas užgęsta ir prašo jūsų slaptažodžio. Viskas, kas buvo atidaryta, lieka vietoje: grįžote, įvedėte slaptažodį ir tęsiate nuo tos pačios vietos.

Vienas paspaudimas prieš atsistojant:

- **Windows:** Win + L.
- **Mac:** Control + Command + Q.

Apsauga – automatinis užrakinimas po poros neveiklumo minučių. Bet nepasikliaukite vien juo: tos minutės ir yra „kolegos“ laikas.`,
      more: {
        title: 'Plačiau: ne tik ekranas',
        body: `**Švarus stalas.** Lipduką su slaptažodžiu ant monitoriaus ir spaudinį spausdintuvo dėkle perskaito vienu žvilgsniu. Slaptažodžius laikykite slaptažodžių tvarkyklėje, spaudinius su svetimais duomenimis pasiimkite iškart.

**Telefonas.** Telefonas irgi turi užsirakinti kodu ar piršto atspaudu. Ant stalo paliktas atrakintas telefonas – tos pačios atviros durys: jame paštas, pokalbių programos ir 2FA kodai.

**Leidimas.** Nepalikite kortelės ant stalo ir neskolinkite jos „minutėlei“.`,
      },
    },
    usb: {
      title: 'Atmintukas-masalas',
      body: `Olegas aikštelėje rado [[usb|atmintuką]] su širdele. Pirma mintis – įkišti ir pažiūrėti, kieno.

Būtent to sukčius ir laukia. Pamestas atmintukas gali pats paleisti programą, vos jį įkišus, arba apsimesti klaviatūra ir per sekundę surinkti komandas. Jame gali būti failas su viliojančiu pavadinimu – „Atlyginimai 2025“.

Taisyklė paprasta: **rastų atmintukų nekiša**, net norėdami rasti savininką. Juos atiduoda IT.`,
    },
    lunch: {
      title: 'Užduotis: einame pietauti',
      body: `Marina ruošiasi pietauti. Ant stalo – atidarytas kompiuteris, lipdukas su slaptažodžiu ant monitoriaus, spaudinys spausdintuve ir atmintukas, rytą rastas aikštelėje.

Nuspręskite, ką daryti su kiekvienu daiktu. Patarimas iš gyvenimo: kompiuterį užrakina paskutinį, prieš atsistojant.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Marinos stalą dabar galima palikti kad ir valandai.

- Išeidami, net minutei, **užrakinkite ekraną**: Win + L Windows, Control + Command + Q Mac.
- Slaptažodžiai – slaptažodžių tvarkyklėje, ne ant lipdukų; spaudinius su svetimais duomenimis pasiimkite iškart.
- **Rastų atmintukų nekiša**, o atiduoda IT.`,
    },
  },
  annotations: {
    'coffee.alt': () =>
      'Olegas su puodeliu eina prie kavos aparato. Prie jo atidaryto kompiuterio jau sėdi Dryžuotasis pilku megztiniu, iš po kurio matyti dryžiai, ir spausdina.',
    'coffee.narration': () => 'Olegas pasitraukė tik minutei.',
    'coffee.striped': () =>
      'Paštas atidarytas… Parašysiu buhalterijai Olego vardu!',
    'desk.alt': () =>
      'Tuščias darbo stalas: atidarytas kompiuteris su lipduku ant monitoriaus, spausdintuvas su lapu dėkle, atmintukas prie klaviatūros, puodelis ir gėlė.',
    'desk.narration': () => 'Marinos stalas prieš pietus.',
    'lock.alt': () =>
      'Marina su rankine ant peties spaudžia du klavišus kompiuteryje. Tamsiame ekrane – didelis spynos ženklas.',
    'lock.narration': () => 'Du paspaudimai – ir durys uždarytos.',
    'lock.marina': () =>
      'Win + L – ir galiu eiti. Viskas, kas atidaryta, manęs palauks.',
    'usb.alt': () =>
      'Olegas aikštelėje pakelia atmintuką su širdelės lipduku. Iš už automobilio žvelgia Dryžuotasis su meškere, kurios valas nusidriekęs iki atmintuko.',
    'usb.narration': () => 'Rytas, biuro aikštelė.',
    'usb.oleg': () => 'O, atmintukas! Įkišiu – pažiūrėsiu, kieno.',
    'summary.coffee': () => 'Atidarytas kompiuteris – atviros durys',
    'summary.desk': () => 'Išeidami patikrinkite stalą',
    'summary.lock': () => 'Win + L arba Control + Command + Q',
    'summary.usb': () => 'Rastą atmintuką – į IT',
  },
  quizzes: {
    'two-minutes': {
      question:
        'Marina dviem minutėms nueina prie spausdintuvo. Ką daryti su kompiuteriu?',
      options: {
        turn: 'Pasukti kompiuterį ekranu į sieną.',
        ask: 'Paprašyti kaimyno prižiūrėti.',
        lock: 'Užrakinti ekraną: jis užges ir paprašys slaptažodžio.',
      },
      wrong: {
        turn: 'Pasuktą ekraną atsuka per sekundę, ir kompiuteris lieka atviras bet kam, kas prieina.',
        ask: 'Kaimynas gali išsiblaškyti ar pats pasitraukti, o „kolegai“ užtenka minutės. Kompiuteris vis tiek lieka atviras.',
      },
      explain:
        'Net per dvi minutes galima išsiųsti laišką jūsų vardu. Užrakintas ekranas prašo slaptažodžio, o viskas, kas atidaryta, lieka vietoje. Tai vienas klavišų paspaudimas – apie jį kitame žingsnyje.',
    },
  },
  tasks: {
    lunch: {
      prompt:
        'Prieš pietus sutvarkykite stalą: slaptažodį, spaudinį, rastą atmintuką ir kompiuterį.',
      goals: {
        clean: 'Ant stalo nėra slaptažodžio lipduko ir spaudinio spausdintuve',
        usb: 'Rastas atmintukas pas IT, o ne kompiuteryje',
        locked: 'Kompiuterio ekranas užrakintas',
      },
      hints: [
        'Kiekvienas daiktas turi du mygtukus. Rinkitės tai, po ko prie stalo nebus ko perskaityti ir ko įkišti.',
        'Apverstas lipdukas ir „vėliau“ nepadeda. Atmintuko nekiša net norėdami rasti savininką. Kompiuterį užrakina paskutinį.',
        'Lipdukas – „Slaptažodį – į seifą, lipduką – į smulkintuvą“, spaudinys – „Pasiimti ir padėti į stalčių“, atmintukas – „Atiduoti Irai į IT“, kompiuteris – „Užrakinti ekraną“. Reikiamas mygtukas apvestas punktyru.',
      ],
      solvedNote:
        'Atlikta: slaptažodis seife, žiniaraštis stalčiuje, atmintukas pas Irą, o ekranas prašo slaptažodžio. Galima ramiai eiti pietauti.',
    },
  },
} satisfies LessonTexts<typeof lesson>
