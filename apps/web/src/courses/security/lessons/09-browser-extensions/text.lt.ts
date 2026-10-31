import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Browser extensions. Ką mato plėtinys',
  summary:
    'Plėtinys su prieiga prie visų svetainių mato viską, ką ir jūs. Prieš diegdami skaitykite leidimus, o kas ketvirtį pašalinkite nereikalingus plėtinius.',
  preview: {
    alt: 'Schema: browser extensions naršyklės rėme – vienas siekia visų atvertų puslapių ir yra išimamas, o kiti pasiekia tik vieną svetainę.',
  },
  labels: {
    marina: { name: 'Marina' },
    striped: { name: 'Dryžuotasis' },
    'extensions-app': { name: 'Naršyklės plėtiniai' },
    'group:store': {
      name: 'Diegimas',
      note: 'Olegas atsiuntė nuorodą: „PDF keitiklis, labai patogu!“ Parduotuvėje jų du.',
    },
    'group:installed': {
      name: 'Įdiegti plėtiniai',
      note: 'Kas ketvirtį peržiūrėkite šį sąrašą: ar viskas dar reikalinga ir ar nepasikeitė leidimai.',
    },
    'item:pdf-pro': {
      name: 'PDF Converter Pro',
      note: 'Nežinomas kūrėjas · 2 mln. naudotojų',
    },
    'item:pdf-lite': {
      name: 'PDF Tools Lite',
      note: 'Tas pats keitiklis, kitas kūrėjas · 300 tūkst. naudotojų',
    },
    'item:vault': {
      name: '1Password',
      note: 'Įdiegė IT · slaptažodžių tvarkyklė iš 2 pamokos',
    },
    'item:translate': {
      name: 'Puslapių vertėjas',
      note: 'Išverčia puslapį, kai paspaudžiate ženkliuką',
    },
    'item:coupons': {
      name: 'Kuponai ir nuolaidos 24/7',
      note: 'Įdiegtas dėl vieno pirkinio prieš metus',
    },
    'item:dark': {
      name: 'Dark Theme Max',
      note: 'Prieš mėnesį pasikeitė kūrėjas; po atnaujinimo paprašė naujų leidimų',
    },
    'item:meet': {
      name: 'Romashka Meet',
      note: 'Įmonės vaizdo skambučiai, įdiegė IT',
    },
    'detail:all-sites': {
      name: 'Skaityti ir keisti visus jūsų duomenis visose svetainėse',
    },
    'detail:history': { name: 'Skaityti naršymo istoriją' },
    'detail:clipboard': { name: 'Skaityti tai, ką kopijuojate' },
    'detail:on-click': {
      name: 'Skaityti ir keisti duomenis dabartinėje svetainėje, kai spustelėsite plėtinį',
    },
    'detail:meet': {
      name: 'Skaityti ir keisti duomenis svetainėje meet.romashka.example',
    },
    'action:install': { name: 'Įdiegti' },
    'action:cancel': { name: 'Atšaukti' },
    'action:keep': { name: 'Palikti' },
    'action:remove': { name: 'Pašalinti' },
    'res:pdf-pro:install': {
      name: 'Stop: dabar keitiklis mato kiekvieną puslapį – paštą, CRM, banką – ir gali keisti tai, ką įvedate. Realybėje dabar: pašalinkite jį plėtinių puslapyje ir pasakykite IT.',
    },
    'res:pdf-pro:cancel': {
      name: 'Teisingai: PDF konvertuoti nereikia prieigos prie visų svetainių. Žemiau yra kuklesnis variantas.',
    },
    'res:pdf-lite:install': {
      name: 'Įdiegta. Jis veikia tik tame puslapyje, kuriame patys spustelėjote ženkliuką.',
    },
    'res:vault:remove': {
      name: 'Tai slaptažodžių tvarkyklė iš IT: jai reikia visų svetainių, kad įrašytų slaptažodžius. Plačios teisės – ne nuosprendis, jei plėtinys reikalingas ir iš to, kuo pasitikite. Jį verta palikti.',
    },
    'res:translate:remove': {
      name: 'Vertėjui užtenka puslapio, kuriame spustelėjote. Jį galima palikti.',
    },
    'res:coupons:remove': {
      name: 'Pašalinta. Kuponai to neverti: plėtinys metus matė kiekvieną jūsų puslapį.',
    },
    'res:dark:remove': {
      name: 'Pašalinta. Naujas savininkas ir nauji leidimai – taip plėtiniai ir tampa šnipais.',
    },
    'res:meet:remove': {
      name: 'Tai įmonės vaizdo skambučiai iš IT, ir prieiga jiems – tik prie savo svetainės. Juos verta palikti.',
    },
  },
  steps: {
    helper: {
      title: 'Mažas pagalbininkas naršyklėje',
      body: `**Browser extension** (naršyklės plėtinys) – maža programa, kuri įsiterpia į Chrome ar kitą naršyklę ir suteikia jai naujų gebėjimų: verčia puslapius, ieško kuponų, tikrina rašybą. 1Password ženkliukas iš 2 pamokos, kuris įrašo slaptažodžius, – irgi plėtinys.

Plėtinys turi savo [[helper|raktą]] prie skirtukų. Kuriuos puslapius jis mato, sprendžiate jūs, kai jį diegiate.`,
    },
    permissions: {
      title: 'Leidimai',
      body: `Prieš diegimą naršyklė parodo langą su **leidimais** (permissions) – sąrašu, ką plėtiniui galima daryti. Jį skaito taip pat atidžiai, kaip laiško adresą.

Palyginkite eilutes dešinėje. „Kai spustelėsite“ – plėtinys mato vieną puslapį ir tik jums spustelėjus. „Svetainėje meet.romashka.example“ – viena svetainė. „Visose svetainėse“ – kiekvienas puslapis: paštas, CRM, bankas ir viskas, ką ten įvedate, įskaitant slaptažodžius.

Taisyklė: prieigą prie visų svetainių suteikia tik tam, ko tikrai reikia darbui ir kas įdiegta iš patikimo šaltinio.`,
    },
    sold: {
      title: 'Plėtinį pardavė',
      body: `Net geras plėtinys gali sugesti. Populiarius plėtinius perka: jie jau turi milijonus naudotojų ir plačias teises. Naujas savininkas išleidžia atnaujinimą – ir vakarykštė „tamsi tema“ siunčia jam viską, ką matote.

Atnaujinimai ateina patys, neklausdami. Todėl svarbu ne tik ką įdiegėte, bet ir kas pas jus yra dabar.`,
      more: {
        title: 'Plačiau: kaip susitvarkyti',
        body: `**Kur sąrašas.** Chrome: meniu „⋮“ → „Plėtiniai“ → „Tvarkyti plėtinius“. Kitose naršyklėse – panašus meniu punktas.

**Ką šalinti.** Viską, kuo nesinaudojote mėnesį; nežinomų kūrėjų plėtinius; tuos, kurie be aiškios priežasties prašo visų svetainių; tuos, kurie neseniai paprašė naujų leidimų.

**Darbo naršyklė.** Dažnai IT riboja plėtinių diegimą. Jei reikia naujo – paprašykite IT, o ne ieškokite aplinkkelio.`,
      },
    },
    cleanup: {
      title: 'Klausimas: kuris leidimas pavojingesnis',
      body: 'Marina tvarko plėtinių sąrašą. Trys iš jų turi tokius leidimus. Kuris pavojingiausias?',
    },
    extensions: {
      title: 'Užduotis: Marinos plėtiniai',
      body: `Olegas atsiuntė nuorodą į „labai patogų“ PDF keitiklį. Parduotuvėje jų du, su skirtingais leidimais. Kartu laikas patikrinti, kas jau įdiegta naršyklėje.

Atsisakykite plėtinio, prašančio visų svetainių, įdiekite kuklesnį variantą ir pašalinkite du nereikalingus plėtinius iš penkių. Tai, ką įdiegė IT, palikite.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Marinos naršyklėje liko tik reikalingi pagalbininkai.

- **Browser extension** mato tai, ką leidote diegdami: „visos svetainės“ – tai paštas, CRM ir slaptažodžiai.
- Prieš diegdami skaitykite **leidimus** ir rinkitės variantą „kai spustelėsite“ arba „viena svetainė“.
- Kas ketvirtį šalinkite nereikalingus; nauji leidimai po atnaujinimo – priežastis suklusti.`,
    },
  },
  annotations: {
    'helper.alt': () =>
      'Didžiulis naršyklės langas su skirtukais. Viršuje sėdi mažas robotas-pagalbininkas su raktų ryšuliu, po raktą kiekvienam skirtukui; Marina žiūri į jį iš apačios.',
    'helper.narration': () => 'Pagalbininkas su raktais nuo visų skirtukų.',
    'helper.marina': () =>
      'Tai štai kas man įrašo slaptažodžius ir verčia puslapius!',
    'permissions.alt': () =>
      'Marina prie kompiuterio pro didinamąjį stiklą skaito diegimo langą: trys eilutės su gaublio, puslapio ir rankos ženkliukais. Virš kadro – leidimų palyginimas.',
    'permissions.narration': () => 'Diegimo langą skaito iki mygtuko.',
    'permissions.compare': () =>
      'Ką matys plėtinys\nvienas puslapis, tik spustelėjus|**kai spustelėsite**\nkiekvienas puslapis: paštas, CRM, bankas|**visi duomenys visose svetainėse**',
    'sold.alt': () =>
      'Naršyklės robotą-pagalbininką perduoda naujam savininkui – Dryžuotajam su monetų maišu. Blizgus roboto korpusas praviras, po juo dryžiai.',
    'sold.narration': () => 'Plėtinys pakeitė savininką.',
    'sold.striped': () =>
      'Milijonas naudotojų ir visos svetainės. Puikus pirkinys!',
    'cleanup.alt': () =>
      'Marina prie lentynos su penkiais mažais robotais-plėtiniais nukelia du – su kuponais ir su voleliu – į perdirbimo dėžę.',
    'cleanup.narration': () => 'Kartą per ketvirtį – tvarka.',
    'cleanup.marina': () => 'Šiais metus nesinaudojau. Viso gero!',
    'summary.helper': () => 'Plėtinys – pagalbininkas su raktais',
    'summary.permissions': () => 'Skaitykite leidimus prieš diegdami',
    'summary.sold': () => 'Plėtinius parduoda ir atnaujina',
    'summary.cleanup': () => 'Kas ketvirtį – tvarka',
  },
  quizzes: {
    'which-permission': {
      question: 'Kuris iš šių leidimų pavojingiausias?',
      options: {
        'one-site':
          'Skaityti ir keisti jūsų duomenis svetainėje meet.romashka.example.',
        'all-sites':
          'Skaityti ir keisti visus jūsų duomenis visose svetainėse.',
        notify: 'Rodyti pranešimus.',
      },
      wrong: {
        'one-site':
          'Tai prieiga prie vienos vaizdo skambučių svetainės. Pašto, CRM ir banko plėtinys nemato.',
        notify:
          'Pranešimai gali erzinti, bet neleidžia plėtiniui skaityti puslapių ir to, ką įvedate.',
      },
      explain:
        '„Visi jūsų duomenys visose svetainėse“ – tai kiekvienas atidarytas puslapis ir viskas, ką jame įvedate: laiškai, CRM klientai, slaptažodžiai, kortelių numeriai. Tokią prieigą suteikia tik reikalingam plėtiniui iš to, kuo pasitikite.',
    },
  },
  tasks: {
    extensions: {
      prompt:
        'Atsisakykite plėtinio su visomis svetainėmis, įdiekite kuklesnį variantą ir pašalinkite du nereikalingus plėtinius.',
      goals: {
        declined: 'Keitiklis su prieiga prie visų svetainių neįdiegtas',
        narrow: 'Įdiegtas keitiklis, veikiantis spustelėjus',
        cleaned: 'Nereikalingi plėtiniai pašalinti, IT įdiegti liko',
      },
      hints: [
        'Skaitykite raudonas leidimų eilutes: prieiga prie visų svetainių. Palyginkite du keitiklius – jie daro tą patį.',
        'Sąraše pašalinkite tai, kuo nesinaudoja ir kas pakeitė savininką. 1Password irgi mato visas svetaines, bet jį įdiegė IT, ir be to jis neįrašys slaptažodžių.',
        'PDF Converter Pro – „Atšaukti“, PDF Tools Lite – „Įdiegti“, „Kuponai ir nuolaidos 24/7“ ir Dark Theme Max – „Pašalinti“. Reikiamas mygtukas apvestas punktyru.',
      ],
      solvedNote:
        'Atlikta: keitiklis veikia spustelėjus, kuponai ir savininką pakeitusi tema pašalinti, o 1Password, vertėjas ir vaizdo skambučiai vietoje.',
    },
  },
} satisfies LessonTexts<typeof lesson>
