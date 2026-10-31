import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: '2FA. Antroji spyna',
  summary:
    'Pavogto slaptažodžio neužtenka, jei antrasis raktas jūsų kišenėje. Įjunkite 2FA nuskaitę QR kodą, išsaugokite atsarginius kodus ir atmeskite svetimą prisijungimo užklausą.',
  preview: {
    alt: 'Schema: 2FA – slaptažodis atrakina pirmą spyną, antrą tik kodas iš jūsų telefono, todėl svetimas prisijungimas su teisingu slaptažodžiu sustabdomas.',
  },
  labels: {
    marina: { name: 'Marina' },
    striped: { name: 'Dryžuotasis' },
    'site-crm': { name: 'Romashka CRM' },
    request: { name: 'Windows · naršyklė', note: 'Nežinomas miestas · 02:47' },
  },
  steps: {
    'second-lock': {
      title: 'Antroji spyna',
      body: `Slaptažodžius vagia visaip: nutekėjimai, masalai, žvilgčiojimas per petį. Todėl į svarbias duris įstato antrą spyną.

**Dviejų veiksnių apsauga** (2FA, two-factor authentication): prisijungiant be slaptažodžio reikia ir **vienkartinio kodo** – šešių skaitmenų iš programėlės jūsų telefone. Kodas keičiasi kas 30 sekundžių ir tinka tik vieną kartą.`,
    },
    stolen: {
      title: 'Raktas yra, o durų neatrakinsi',
      body: `Dryžuotasis gavo Marinos CRM slaptažodį, bet [[door|durys]] neatsidarė: antroji spyna laukia kodo, o telefonas – Marinos kišenėje.

Su 2FA pavogto slaptažodžio neužtenka. Todėl ją įjungia visur, kur tik galima: pašte, CRM sistemoje, banke, įmonės socialiniuose tinkluose.`,
    },
    'code-call': {
      title: 'Klausimas: skambutis „iš IT“',
      body: 'Kai slaptažodis nepadėjo, sukčius skambina. Prisistato IT ar banko darbuotoju ir prašo „padiktuoti kodą, kad patikrintume“. Kaip pasielgti?',
    },
    night: {
      title: 'Užklausa vidury nakties',
      body: `Būna ir taip: telefonas klausia „Ar tai jūs jungiatės?“, o jūs niekur nesijungėte. Vadinasi, jūsų slaptažodis jau kažkieno rankose.

Paspauskite „Ne“ – durys neatsidarys – ir praneškite IT: slaptažodį reikia pakeisti. Nespauskite „Taip“, kad tik užklausos liautųsi: būtent to sukčius ir tikisi.`,
      more: {
        title: 'Daugiau: SMS, raktai ir passkeys',
        body: `**SMS – silpnesnė apsauga nei programėlė.** Telefono numerį galima perkelti į svetimą SIM kortelę, o SMS žinutes skaito kenkėjiškos programos. Jei svetainė siūlo autentifikavimo programėlę, rinkitės ją.

**Saugumo raktas ir passkey.** Dar patikimiau – fizinis raktas (mažas USB įrenginys) arba passkey telefone ir nešiojamajame kompiuteryje. Jie patys tikrina svetainės adresą, todėl netikroje svetainėje nesuveiks.

**Slaptažodis ir kodas vienoje vietoje.** Slaptažodžių tvarkyklė moka saugoti ir 2FA kodus, tai patogu. Bet svarbiausioms paskyroms – paštui, bankui, slaptažodžių tvarkyklei – antrąjį raktą laikykite atskirai: programėlėje telefone.`,
      },
    },
    enable: {
      title: 'Užduotis: įjunkite 2FA',
      body: `Marina įjungia 2FA „Romashka“ CRM sistemoje. Dešinėje – CRM saugumo puslapis ir jos telefonas su autentifikavimo programėle.

Įjunkite 2FA nuskaitę QR kodą, išsaugokite atsarginius kodus slaptažodžių tvarkyklėje ir sureaguokite į prisijungimo užklausą, kuri ateis į telefoną.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Dryžuotasis slaptažodį turėjo, bet prisijungti jam taip ir nepavyko.

- **2FA** – antroji spyna: be slaptažodžio reikia ir **vienkartinio kodo** iš jūsų telefono.
- Kodo nesakykite niekam: nei „IT“, nei „bankui“. Kas prašo kodo, tas ir jungiasi.
- „Ar tai jūs jungiatės?“, o jūs nesijungėte – „Ne“ ir pranešimas IT.`,
    },
  },
  annotations: {
    'locks.alt': () =>
      'Durys su dviem spynomis: įprasta, rakinama raktu, ir antroji, kurią atrakina kodas iš Marinos telefono.',
    'locks.narration': () => 'Durys į CRM. Dabar jose dvi spynos.',
    'locks.marina': () =>
      'Raktas – mano slaptažodis. O antrąją spyną atrakins tik kodas iš mano telefono.',
    'stolen.alt': () =>
      'Naktis. Dryžuotasis įkišo pavogtą raktą į pirmąją spyną, bet antroji spyna su ekranėliu kodui nepasiduoda.',
    'stolen.narration': () => 'Naktį. Dryžuotasis turi nutekėjusį slaptažodį.',
    'stolen.striped': () => 'Raktas tiko… o čia dar kokia spyna?',
    'call.alt': () =>
      'Dryžuotasis su ausinėmis ir marškinėliais „IT“ skambina Marinai. Ji laiko ragelį ir žiūri į telefoną su kodu.',
    'call.narration': () => 'Ryte Marinai skambina „iš IT“.',
    'call.striped': () =>
      'Sveiki, čia IT. Tikriname jūsų apsaugą – padiktuokite kodą iš SMS.',
    'call.marina': () => 'Juk kodas reikalingas norint prisijungti…',
    'night.alt': () =>
      'Naktis, miegamasis. Ant spintelės šviečia Marinos telefonas: viena po kitos iššoka užklausos „Ar tai jūs jungiatės?“. Marina mieguista tiesiasi paspausti „Ne“.',
    'night.narration': () => 'Antra valanda nakties. Marinos telefonas skamba.',
    'night.marina': () => '„Ar tai jūs jungiatės?“ Ne, aš miegu!',
    'summary.locks': () => 'Antroji spyna – kodas iš telefono',
    'summary.stolen': () => 'Pavogto slaptažodžio neužtenka',
    'summary.call': () => 'Kodo nesakykite niekam',
    'summary.night': () => 'Jungiatės ne jūs – „Ne“ ir IT',
  },
  quizzes: {
    'code-call': {
      question: 'Skambina iš IT ir prašo padiktuoti kodą iš SMS. Ką darysite?',
      options: {
        dictate: 'Padiktuosiu: juk tai mūsų IT, jiems geriau žinoti.',
        'call-back':
          'Kodo nesakysiu, padėsiu ragelį ir perskambinsiu į IT numeriu iš žinyno.',
        half: 'Padiktuosiu tik pirmus tris skaitmenis, kad patikrinčiau, kas skambina.',
      },
      wrong: {
        dictate:
          'Kodas – antrasis jūsų durų raktas: jį padiktuoti – tas pats, kas pačiam atrakinti duris. Tikram IT jūsų kodo niekada nereikia: jie turi savo įrankius.',
        half: 'Pusė kodo – irgi užuomina, o skambinančiojo taip nepatikrinsi: jis lengvai pasakys, kad viskas sutampa. Patikrinimas – skambutis numeriu, kurį žinote jūs patys.',
      },
      explain:
        'Kodas iš SMS ar programėlės reikalingas tik jums – prisijungiant. Kas prašo jį padiktuoti, tas ir bando prisijungti. Padėkite ragelį ir patys perskambinkite į IT numeriu iš žinyno.',
    },
  },
  tasks: {
    enable: {
      prompt:
        'Įjunkite 2FA CRM sistemoje, išsaugokite atsarginius kodus ir neįleiskite svetimo.',
      goals: {
        on: '2FA CRM sistemoje įjungta',
        codes: 'Atsarginiai kodai – slaptažodžių tvarkyklėje',
        stranger: 'Svetimas prisijungimas atmestas, IT žino',
      },
      hints: [
        'Pradėkite svetainėje: „Įjungti 2FA“ parodys QR kodą. Tada telefone paspauskite „Nuskaityti QR kodą“.',
        'Programėlė parodys šešis skaitmenis – įveskite juos svetainėje. Atsarginių kodų prireiks, jei pamesite telefoną: jie laikomi slaptažodžių tvarkyklėje. Užklausa „Ar tai jūs jungiatės?“ vidury nakties – ne jūsų.',
        '„Įjungti 2FA“ → telefone „Nuskaityti QR kodą“ → svetainėje kodas 381 640 ir „Patvirtinti“ → „Išsaugoti slaptažodžių tvarkyklėje“ → telefone „Ne, tai ne aš“ → „Pranešti IT“. Reikiama vieta apvesta punktyru.',
      ],
      solvedNote:
        'Atlikta: CRM turi dvi spynas, atsarginiai kodai seife, o Dryžuotasis liko už durų. IT jau keičia slaptažodį kartu su Marina.',
    },
  },
} satisfies LessonTexts<typeof lesson>
