import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Incident. Jei jau paspaudėte',
  summary:
    'Baisu ne suklysti, o nutylėti. Pirmosios 15 minučių: pranešti IT, pakeisti slaptažodį, atsijungti visuose įrenginiuose ir išsaugoti laišką IT.',
  preview: {
    alt: 'Schema: incident – po nesėkmingo paspaudimo signalas keliauja į IT, slaptažodis keičiamas, sesijos uždaromos, o laiškas išsaugomas tyrimui.',
  },
  labels: {
    oleg: { name: 'Olegas' },
    marina: { name: 'Marina' },
    ira: { name: 'Ira' },
    striped: { name: 'Dryžuotasis' },
    'chat:ira': { name: 'Ira · IT', note: 'IT administratorė' },
    'chat:ira:body': {
      name: 'Kolegos, primenu: keisti laiškai, skambučiai ir žinutės – iškart man. Geriau kartą per daug.',
    },
    'reply:ira:report': {
      name: 'Ira, paspaudžiau mygtuką laiške „Jūsų slaptažodis baigia galioti“ ir įvedžiau ten pašto slaptažodį. Ką daryti?',
      note: 'Ačiū, kad iškart parašei! Darome taip: 1) pakeisk pašto slaptažodį slaptažodžių tvarkyklėje; 2) pašte apačioje paspausk „Daugiau“ ir atsijunk visuose kituose įrenginiuose; 3) persiųsk man tą laišką ir jo netrink. Visa kita – mano rūpestis.',
    },
    'chat:marina': { name: 'Marina', note: 'biuro vadybininkė' },
    'chat:marina:body': {
      name: 'Olegai, tau irgi atėjo „Jūsų slaptažodis baigia galioti“? Nespausk, tai masalas!',
    },
    'vault-app': { name: '1Password' },
    'vault-personal': { name: 'Asmeninis' },
    'vault-marketing': { name: 'Rinkodara' },
    'entry:mail': { name: 'Darbo paštas' },
    'entry:crm': { name: 'Įmonės CRM' },
    'entry:social': { name: 'Įmonės socialinis tinklas' },
    'mail:it': {
      name: 'IT skyrius',
      note: 'Jūsų slaptažodis baigia galioti šiandien',
    },
    'mail:it:body': {
      name: `Sveiki!

Jūsų slaptažodžio galiojimas baigiasi šiandien 18:00. Kad išsaugotumėte prieigą prie pašto, patvirtinkite dabartinį slaptažodį.

Pagarbiai, IT skyrius`,
    },
    'mail:it:link': { name: 'Išsaugoti dabartinį slaptažodį' },
    'mail:ira': {
      name: 'Ira · IT',
      note: 'Šeštadienį paštas neveiks nuo 10 iki 12',
    },
    'mail:ira:body': {
      name: `Kolegos, šeštadienį atnaujiname pašto serverį. Nuo 10:00 iki 12:00 paštas bus nepasiekiamas.

Nieko daryti nereikia. Klausimai – darbo pokalbyje.

Ira`,
    },
    'session:laptop': {
      name: 'Olego nešiojamasis kompiuteris · naršyklė',
      note: 'Vilnius · dabar',
    },
    'session:phone': { name: 'Olego telefonas', note: 'Vilnius · 08:55' },
    'session:stranger': {
      name: 'Windows · naršyklė',
      note: 'Nežinomas miestas · 09:14',
    },
  },
  steps: {
    blush: {
      title: 'Oi',
      body: `Ryte Olegas paspaudė mygtuką laiške „Jūsų slaptažodis baigia galioti“ ir įvedė slaptažodį prie kartoninių durų. Dabar jis suprato, kad tai buvo masalas iš pamokos apie sukčiavimą.

Suklysti gali kiekvienas – net atidus ir patyręs. Toks įvykis – tai **incidentas** (incident): kažkas nutiko, ir svetimas galėjo gauti prieigą. Žala atsiranda ne dėl klaidos, o kai apie ją tylima.`,
    },
    'tell-it': {
      title: 'Iškart pasakyti IT',
      body: `Pirmiausia – pranešti IT. Iškart, net jei nejauku ir net jei „lyg ir nieko neatsitiko“.

Ira nebara: ji džiaugiasi, kad sužinojo pirma. Ji turi kelias minutes, kol sukčius nepasinaudojo slaptažodžiu, ir kiekviena minutė brangi.`,
    },
    'close-door': {
      title: 'Pirmosios 15 minučių',
      body: `Toliau Ira ir Olegas uždaro duris, kol Dryžuotasis neįėjo:

- **pranešti IT** – jau padaryta;
- **pakeisti slaptažodį** slaptažodžių tvarkyklėje – senas raktas nebetinka;
- **atsijungti visuose įrenginiuose** – tą, kuris jau prisijungė su senu slaptažodžiu, išmeta;
- **laiško netrinti**, o persiųsti IT: pagal jį ras, kam dar jis atėjo, ir užblokuos adresą.`,
      more: {
        title: 'Daugiau: kas dar laikoma incidentu',
        body: `**Ne tik slaptažodis.** Incidentas – tai ir atidarytas priedas iš įtartino laiško, ir pamestas telefonas ar nešiojamasis kompiuteris, ir failas, išsiųstas ne tam gavėjui, ir keista programa, kuri pati kažką daro.

**Ko paklaus IT.** Kada tai nutiko, ką tiksliai įvedėte ar atidarėte, iš kokio įrenginio ir koks buvo laiškas ar žinutė. Nieko netrinkite: visa tai padeda.

**Kodėl nebaudžia.** Įmonė, kurioje už klaidą bara, apie incidentus sužino paskutinė – kai jau per vėlu. Todėl gera IT tarnyba dėkoja už kiekvieną pranešimą, net už klaidingą pavojaus signalą.

**Jei paskyra turi 2FA**, vieno slaptažodžio sukčiui neužtenka – dar viena priežastis ją įjungti visur.`,
      },
    },
    'bait-after': {
      title: 'Klausimas: ką daryti su laišku',
      body: 'Laiškas masalas vis dar guli Olego gautuosiuose. Ką su juo daryti dabar?',
    },
    'first-15': {
      title: 'Užduotis: pirmosios 15 minučių',
      body: `Dešinėje – Olego ekranai iš ankstesnių pamokų: pokalbių programėlė, slaptažodžių tvarkyklė ir paštas.

Parašykite Irai, kas nutiko, ir atlikite jos sąrašą: pakeiskite pašto slaptažodį, atsijunkite visuose kituose įrenginiuose ir persiųskite masalą IT jo netrindami.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Olegas suklydo, bet nenutylėjo – ir Dryžuotasis liko už durų.

- **Incidentas** – ne priežastis slėptis: baisu ne suklysti, o nutylėti.
- Pirmosios 15 minučių: pranešti IT, pakeisti slaptažodį, atsijungti visuose įrenginiuose.
- Masalo netrina, o persiunčia IT: pagal jį randa kitus.`,
    },
  },
  annotations: {
    'blush.alt': () =>
      'Olegas prie stalo išrausta iki ausų ir užsidengia veidą delnu; ekrane – tos pačios kartoninės prisijungimo durys.',
    'blush.narration': () => 'Olegas suprato, kas nutiko.',
    'blush.oleg': () => 'Juk tai buvo masalas… Gal niekas nepastebės?',
    'toIra.alt': () =>
      'Olegas su puodeliu prieina prie Iros stalo; Ira su ausinėmis atsisuka į jį ir šypsosi.',
    'toIra.narration': () => 'Po minutės. Iros stalas.',
    'toIra.oleg': () => 'Ira, rodos, įvedžiau slaptažodį puslapyje iš laiško…',
    'toIra.ira': () =>
      'Gerai, kad iškart atėjai! Tuoj viską uždarysime, laiko turime.',
    'door.alt': () =>
      'Ira užtrenkia duris su nauja spyna Dryžuotajam prieš pat nosį; Dryžuotojo rankoje senas raktas, kuris nebetinka.',
    'door.narration': () => 'Po penkiolikos minučių.',
    'door.striped': () => 'Ei! Senas raktas nebetinka!',
    'bin.alt': () =>
      'Olegas laiko laišką masalą virš šiukšliadėžės ir dvejoja; šalia – dėklas su IT piktograma.',
    'bin.narration': () => 'O ką daryti su pačiu laišku?',
    'summary.blush': () => 'Suklysti gali kiekvienas',
    'summary.toIra': () => 'Iškart pasakyti IT',
    'summary.door': () => 'Naujas slaptažodis ir atsijungimas visur',
    'summary.bin': () => 'Masalą – IT, ne į šiukšliadėžę',
  },
  quizzes: {
    'bait-after': {
      question: 'Ką daryti su laišku masalu, kai jame jau ką nors paspaudėte?',
      options: {
        delete: 'Ištrinti, kad netyčia nepaspaustumėte dar kartą.',
        forward: 'Persiųsti IT ir netrinti.',
        reply: 'Atsakyti siuntėjui, kad jį perpratote.',
      },
      wrong: {
        delete:
          'Ištrintas laiškas IT nepadės: pagal jį randa, kam dar jis atėjo, ir užblokuoja siuntėjo adresą. Pirmiausia persiųskite, o kada ištrinti, pasakys IT.',
        reply:
          'Atsakymas tik patvirtins sukčiui, kad adresas gyvas ir jūs skaitote laiškus. Su sukčiumi nesusirašinėjama.',
      },
      explain:
        'Laiškas – įkaltis. Pagal jį IT sužinos adresą ir nuorodą, ras tokius pat laiškus pas kolegas ir užblokuos siuntėją. Todėl jį persiunčia IT ir netrina, kol IT nepasakys.',
    },
  },
  tasks: {
    'first-15': {
      prompt:
        'Netylėkite: praneškite IT ir uždarykite duris, kol sukčius neįėjo.',
      goals: {
        told: 'Ira žino, kas nutiko',
        password: 'Pašto slaptažodis pakeistas',
        sessions: 'Atsijungta visuose kituose įrenginiuose',
        evidence: 'Masalas persiųstas IT',
      },
      hints: [
        'Pradėkite nuo pokalbių programėlės: parašykite Irai, kas nutiko. Ji atsakys, ką daryti toliau.',
        'Slaptažodį keičia slaptažodžių tvarkyklėje: įrašas „Darbo paštas“ → „Pakeisti sugeneruotu“. Svetimos sesijos – pašto apačioje, paspaudus „Daugiau“. Masalo netrinkite.',
        'Pokalbiai: atsakymas Irai. Seifas: „Darbo paštas“ → „Pakeisti sugeneruotu“. Paštas: „Daugiau“ apačioje → „Atsijungti visuose kituose įrenginiuose“, tada laiškas „Jūsų slaptažodis baigia galioti šiandien“ → „Persiųsti IT“. Reikiama vieta apvesta punktyru.',
      ],
      solvedNote:
        'Atlikta: Ira žino, pašto slaptažodis naujas, svetima sesija uždaryta, o laiškas pas IT. Dryžuotasis liko su senu raktu, kuris niekur netinka.',
    },
  },
} satisfies LessonTexts<typeof lesson>
