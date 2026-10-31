import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'KeePass. Savas seifo failas',
  summary:
    'Slaptažodžių seifas, kurį laikote patys vienu failu. Atkurti jo nėra kam, todėl reikia patikimos pagrindinės frazės ir naujos kopijos kitoje vietoje.',
  preview: {
    alt: 'Schema: KeePass seifas – vienas failas jūsų įrenginyje, jį atidaro viena pagrindinė frazė, o nauja atsarginė kopija laikoma atskirame diske.',
  },
  labels: {
    marina: { name: 'Marina' },
    oleg: { name: 'Olegas' },
    ira: { name: 'Ira' },
    'keepass-app': { name: 'KeePass' },
    'phrase:birthday': {
      name: 'Marina1990',
      note: 'Vardą ir gimimo metus žino kiekvienas, matęs jūsų profilį socialiniame tinkle. Tokius slaptažodžius bando pirmiausia.',
    },
    'phrase:old': {
      name: 'Romashka2024',
      note: 'Šis slaptažodis jau kabojo ant lipduko ir buvo pristatymo svetainėje, kurią įsilaužė. Jis yra nutekėjime.',
    },
    'phrase:words': { name: 'zebras tramvajus kefyras švyturys' },
    'place:laptop': { name: 'Nešiojamasis → Dokumentai' },
    'place:desktop': {
      name: 'Nešiojamasis → Darbalaukis',
      note: 'Kitas aplankas, bet tas pats kompiuteris.',
    },
    'place:usb': {
      name: 'USB atmintukas spintoje',
      note: 'Atskiras įrenginys, laikomas užrakintas.',
    },
    'place:cloud': {
      name: 'Asmeninis debesies aplankas',
      note: 'Failas užšifruotas, debesis saugo tik jo kopiją.',
    },
    'kp:bank': { name: 'Asmeninis bankas', note: 'bank.example · marina.k' },
    'kp:router': { name: 'Namų Wi-Fi', note: 'maršrutizatorius · admin' },
  },
  steps: {
    'own-file': {
      title: 'Seifas, kuris yra pas jus',
      body: `2 pamokoje slaptažodžius saugojo 1Password: seifo programa, kuri atsimena ilgus skirtingus slaptažodžius, o jūs atsimenate vieną pagrindinį slaptažodį. Jos seifas gyvena debesyje, kūrėjo serveriuose.

**KeePass** – irgi seifo programa slaptažodžiams, nemokama. Skirtumas – kur yra seifas: KeePass visas seifas yra vienas užšifruotas failas jūsų kompiuteryje. Šis failas vadinamas **bazės failu** (database file).

Debesies nėra, niekas pašalinis prie failo neprijungtas. Bet ir apdrausti jūsų nėra kam.`,
    },
    nobody: {
      title: 'Klausimas: kas atidarys seifą',
      body: 'Olegas pradėjo naudoti KeePass, o po mėnesio pamiršo pagrindinį slaptažodį. Bazės failas vietoje, jo kompiuteryje. Kas padės jį atidaryti?',
    },
    phrase: {
      title: 'Pagrindinė frazė iš keturių žodžių',
      body: `Jei pagrindinio slaptažodžio atkurti negalima, jis turi būti toks, kurį jūs atsimintumėte, o kiti neatspėtų. Geriausia – **pagrindinė frazė**: keturi penki atsitiktiniai žodžiai iš eilės.

Palyginkite dešinėje. Vardą su gimimo metais ir seną darbo slaptažodį atspėja per kelias minutes: juos žino socialiniai tinklai ir nutekėjimai. Keturi atsitiktiniai žodžiai ilgesni ir vis tiek lengvai įsimenami – užtenka įsivaizduoti paveikslėlį.

Užrašykite frazę ant popieriaus ir laikykite namie, ne ant darbo stalo. Tai ne lipdukas ant monitoriaus, o atsarginis raktas saugioje vietoje.`,
      more: {
        title: 'Plačiau: KeePass ar 1Password',
        body: `**1Password** patogesnis darbe: seifas debesyje, bendri seifai skyriui, įmonės administratorius gali grąžinti darbuotojui prieigą. Jei įmonė jį turi – darbo slaptažodžius laikykite ten.

**KeePass** tinka asmeniniams slaptažodžiams ir ten, kur debesimi nepasitiki. Jo versijų yra bet kuriai sistemai, pavyzdžiui, KeePassXC kompiuteriui ir KeePassDX Android telefonui. Jos atidaro tą patį bazės failą.

**Sinchronizavimas.** Failą galima įdėti į debesies aplanką – jis užšifruotas, ir be pagrindinės frazės debesis mato tik baitų krūvą. Taip bazė yra ir telefone, ir kompiuteryje. Bet debesies aplankas – ne atsarginė kopija: jei failas sugadinamas, sugadintas pasklinda visur.

**Frazė iš pamokos** – tik pavyzdys. Neimkite jos sau: sugalvokite savo.`,
      },
    },
    backup: {
      title: 'Atsarginė kopija kitoje vietoje',
      body: `Sugenda kompiuteris, jį pavagia ar failas netyčia ištrinamas – kartu su failu dingsta visi slaptažodžiai. Todėl bazės failas turi turėti **atsarginę kopiją** (backup): dar vieną failo egzempliorių kitame įrenginyje.

Kopija gretimame to paties kompiuterio aplanke neišgelbės: sugedus kompiuteriui, dings abi. Reikia atskiro įrenginio: [[usb|USB atmintuko]] [[cupboard|spintoje]] ar savo debesies aplanko.

Ir kopiją atnaujina: įtraukėte į bazę naujų slaptažodžių – išsaugokite kopiją dar kartą, kitaip jų joje nebus.`,
    },
    'own-vault': {
      title: 'Užduotis: savas seifas',
      body: `Marina nori asmeninius slaptažodžius laikyti atskirai nuo darbo. Dabar banko ir namų Wi-Fi slaptažodžiai užrašyti ant lapelio po klaviatūra.

Sukurkite KeePass bazę su patikima pagrindine fraze, perkelkite į ją slaptažodžius nuo lapelio ir išsaugokite naują kopiją kitame įrenginyje.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Marinos seifas dabar pas ją, ir jis turi atsarginį egzempliorių.

- **KeePass** – slaptažodžių seifas, kurį laikote patys vienu **bazės failu**. Debesies nėra, ir atkurti prieigos nėra kam.
- Pagrindinį slaptažodį darykite **fraze iš keturių penkių atsitiktinių žodžių**, o jos užrašą laikykite namie.
- **Atsarginė kopija** – kitame įrenginyje, ir po pakeitimų ją atnaujina.`,
    },
  },
  annotations: {
    'box.alt': () =>
      'Marina prie stalo iš nešiojamojo kompiuterio iškelia mažą metalinį seifą su kodine spyna, lyg laikytų rankose failą.',
    'box.narration': () => 'Marinos seifas – failas jos kompiuteryje.',
    'box.marina': () =>
      'Visas seifas – vienas failas. Ir jis pas mane, ne debesyje.',
    'forgot.alt': () =>
      'Olegas susiėmęs už galvos prieš mažą seifą ant stalo; šalia Ira skėsteli rankomis. Virš seifo – tuščias punktyrinis debesies kontūras.',
    'forgot.narration': () => 'Po mėnesio.',
    'forgot.oleg': () => 'Koks gi ten buvo slaptažodis?..',
    'phrase.alt': () =>
      'Marina segtukais tvirtina prie lentos keturias paveikslėlių korteles: zebrą, tramvajų, kefyro butelį, švyturį. Virš kadro – pagrindinių frazių palyginimas.',
    'phrase.narration': () => 'Frazė-paveikslėlis įsimena pati.',
    'phrase.compare': () =>
      'Kurią frazę atspės\npatikima: 4 atsitiktiniai žodžiai|zebras tramvajus kefyras švyturys\nvardas ir gimimo metai|**Marina1990**\nsenas slaptažodis iš nutekėjimo|**Romashka2024**',
    'copies.alt': () =>
      'Marina laiko USB atmintuką; šalia atvira spinta, kurios lentynoje stovi toks pat mažas seifas. Punktyras jungia jį su seifu kompiuterio ekrane.',
    'copies.narration': () => 'Antras egzempliorius – spintoje.',
    'copies.marina': () =>
      'Sugedus kompiuteriui, atidarysiu kopiją iš atmintuko ta pačia fraze.',
    'summary.box': () => 'Seifas – vienas failas pas jus',
    'summary.forgot': () => 'Pamiršote frazę – neatidarys niekas',
    'summary.phrase': () => 'Frazė iš atsitiktinių žodžių',
    'summary.copies': () => 'Nauja kopija kitame įrenginyje',
  },
  quizzes: {
    nobody: {
      question:
        'Olegas pamiršo KeePass pagrindinį slaptažodį. Kas atidarys jo seifą?',
      options: {
        ira: 'Ira iš IT atstatys slaptažodį.',
        support: 'KeePass kūrėjai atkurs prieigą.',
        nobody: 'Niekas: be pagrindinio slaptažodžio failo neatidaryti.',
      },
      wrong: {
        ira: 'Ira neturi rakto nuo Olego failo: KeePass slaptažodžius laiko tik pačiame faile, o jis užšifruotas Olego pagrindiniu slaptažodžiu.',
        support:
          'KeePass neturi nei serverio, nei paskyrų: kūrėjams nėra ką atkurti. Failas užšifruotas, ir jo raktas – tik pagrindinis slaptažodis.',
      },
      explain:
        'Bazės failas užšifruotas pagrindiniu slaptažodžiu, ir jo kopijos neturi niekas. Todėl slaptažodžio atstatyti negali niekas: nei IT, nei kūrėjai. Tai KeePass stiprybė ir pavojus. Iš čia dvi pamokos taisyklės: frazė, kurią tikrai prisiminsite, ir atsarginis failo egzempliorius.',
    },
  },
  tasks: {
    'own-vault': {
      prompt:
        'Sukurkite bazę su patikima pagrindine fraze, perkelkite slaptažodžius nuo lapelio ir išsaugokite naują kopiją kitame įrenginyje.',
      goals: {
        phrase: 'Bazė sukurta su patikima pagrindine fraze',
        entries: 'Slaptažodžiai nuo lapelio – bazėje',
        backup: 'Nauja kopija yra kitame įrenginyje',
      },
      hints: [
        'Pradėkite nuo mygtuko „Sukurti naują bazę“. Iš trijų frazių patikima ta, kurios nerasite nei socialiniuose tinkluose, nei nutekėjimuose.',
        'Kai bazė atidaryta, įtraukite abu įrašus nuo lapelio ir tik tada išsaugokite kopiją: anksčiau padarytoje kopijoje naujų slaptažodžių nebus. Darbalaukis – tas pats kompiuteris.',
        'Sukurkite bazę, pasirinkite „zebras tramvajus kefyras švyturys“, prie abiejų įrašų spauskite „Įtraukti į bazę“, tada „Išsaugoti kopiją…“ ir „USB atmintukas spintoje“. Reikiama vieta apvesta punktyru.',
      ],
      solvedNote:
        'Atlikta: lapelis smulkintuve, seifas atsidaro fraze, kurią Marina atsimena, o nauja kopija laukia atmintuke spintoje.',
    },
  },
} satisfies LessonTexts<typeof lesson>
