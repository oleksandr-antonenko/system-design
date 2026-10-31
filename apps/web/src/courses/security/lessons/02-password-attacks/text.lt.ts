import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Password attacks. Kaip atspėjami slaptažodžiai',
  summary:
    'Slaptažodžius spėja programa: pagal nutekėjusių slaptažodžių sąrašus, įprastus šablonus ir duomenis iš socialinių tinklų. Peržiūrėkite Olego slaptažodžius: kurie kris iškart, o kurie atsilaikys.',
  preview: {
    alt: 'Iliustracija: password attacks – trumpas slaptažodis lapelyje prie monitoriaus, ant stalo žalia kortelė su ilga fraze: puodelis, slidės, gėlė.',
  },
  labels: {
    marina: { name: 'Marina' },
    oleg: { name: 'Olegas' },
    striped: { name: 'Dryžuotasis' },
    'check-app': { name: 'Slaptažodžių patikra' },
    'group:oleg': {
      name: 'Olego slaptažodžiai',
      note: 'Olegas paprašė Marinos patikrinti jo slaptažodžius. Kiekvienam nuspręskite, kaip greitai jį atspės programa.',
    },
    'item:qwerty': {
      name: 'Qwerty123!',
      note: 'Kuponų svetainė. „Yra didžioji raidė, skaičiai ir ženklas – svetainė sakė, kad slaptažodis patikimas.“',
    },
    'item:romashka': {
      name: 'Romashka2024!',
      note: 'Įmonės „Romashka“ CRM. Įmonės pavadinimas, metai ir „!“ gale.',
    },
    'item:barsik': {
      name: 'Barsik2015',
      note: 'Internetinė bankininkystė. Barsikas – Olego katinas: jo nuotraukos socialiniuose tinkluose nuo 2015 metų, ir kasmet įrašas „Su gimtadieniu, Barsikai!“.',
    },
    'item:leaked': {
      name: 'Gr@nd!Tour#88',
      note: 'Pietų pristatymo svetainė. Atrodo sudėtingas, bet Olegas jį naudoja daugelyje svetainių, o pristatymo svetainę pernai nulaužė.',
    },
    'item:phrase': {
      name: 'kava-slidės-palangė',
      note: 'Darbo paštas. Trys atsitiktiniai žodžiai, niekur kitur nenaudojami.',
    },
    'item:generated': {
      name: 'v7#Lq9TmZ!x2pR4w',
      note: 'Darbo pokalbių programa. Slaptažodį sugalvojo ir saugo slaptažodžių tvarkyklė, tik šiai svetainei.',
    },
    'action:fast': { name: 'Kris iškart' },
    'action:personal': { name: 'Atspės iš socialinių tinklų' },
    'action:holds': { name: 'Atsilaikys' },
    'res:qwerty:fast': {
      name: 'Teisingai: tai klaviatūros raidės iš eilės, skaičiai iš eilės ir „!“. Toks slaptažodis yra bet kurio sąrašo pradžioje.',
    },
    'res:qwerty:personal': {
      name: 'Nieko asmeniško čia nėra, ir socialiniuose tinkluose jo ieškoti nereikia: „qwerty“ – klaviatūros raidės iš eilės, toks slaptažodis yra bet kuriame sąraše.',
    },
    'res:qwerty:holds': {
      name: 'Svetainė giria slaptažodį už ženklus, o programai jie netrukdo: „Qwerty123!“ yra bet kurio sąrašo pradžioje.',
    },
    'res:romashka:fast': {
      name: 'Teisingai: žodis, metai ir „!“ – dažniausias šablonas. Įmonės pavadinimą programa į sąrašą įtraukia pirmą.',
    },
    'res:romashka:personal': {
      name: 'Beveik: įmonės pavadinimą tikrai žino visi. Bet šabloną „žodis + metai + !“ programa bando ir be socialinių tinklų – per pirmąsias minutes.',
    },
    'res:romashka:holds': {
      name: 'Didžioji raidė, skaičiai ir ženklas neišgelbsti: „žodis + metai + !“ – šablonas, kurį programa bando tarp pirmųjų.',
    },
    'res:barsik:fast': {
      name: 'Bendruosiuose sąrašuose šio slaptažodžio gali ir nebūti. Jį atspės kitaip: katino vardas ir metai yra Olego socialiniuose tinkluose.',
    },
    'res:barsik:personal': {
      name: 'Teisingai: katino vardas ir metai – iš viešų Olego nuotraukų. Programai juos pasufleruos jo puslapis socialiniame tinkle.',
    },
    'res:barsik:holds': {
      name: 'Neatsilaikys: katino vardą ir metus Olegas pats parodė socialiniuose tinkluose, o programa tokius žodžius įtraukia į sąrašą.',
    },
    'res:leaked:fast': {
      name: 'Teisingai: slaptažodis jau yra nutekėjusioje bazėje. Kad ir koks sudėtingas atrodytų, jį bando pirmą – ir visose kitose Olego svetainėse.',
    },
    'res:leaked:personal': {
      name: 'Socialiniai tinklai čia niekuo dėti: slaptažodis nutekėjo iš pristatymo svetainės. Jis jau bazėje, ir jį bando pirmą.',
    },
    'res:leaked:holds': {
      name: 'Ženklai neišgelbsti jau nutekėjusio slaptažodžio: jis guli bazėje toks, koks yra, ir jį bando visose Olego svetainėse.',
    },
    'res:phrase:fast': {
      name: 'Ne: trijų atsitiktinių žodžių nėra jokiame sąraše, o dėl ilgio spėjimas užtrunka labai ilgai. Toks slaptažodis atsilaikys.',
    },
    'res:phrase:personal': {
      name: 'Apie kavą, slides ir palangę Olego socialiniuose tinkluose nieko nėra: žodžiai atsitiktiniai, ne apie jį. Toks slaptažodis atsilaikys.',
    },
    'res:phrase:holds': {
      name: 'Teisingai: ilga atsitiktinių žodžių frazė ir tik vienai svetainei. Jos nėra sąrašuose, o įsiminti ją lengva.',
    },
    'res:generated:fast': {
      name: 'Ne: atsitiktinių slaptažodžių tvarkyklės ženklų nėra jokiame sąraše, ir jie naudojami tik šioje svetainėje. Toks slaptažodis atsilaikys.',
    },
    'res:generated:personal': {
      name: 'Šiame slaptažodyje nėra nieko apie Olegą: jį atsitiktinai sugalvojo programa. Toks slaptažodis atsilaikys.',
    },
    'res:generated:holds': {
      name: 'Teisingai: ilgas, atsitiktinis ir tik šiai svetainei. Prisiminti jo nereikia – tai slaptažodžių tvarkyklės darbas.',
    },
  },
  steps: {
    'by-machine': {
      title: 'Slaptažodžių niekas nespėlioja rankomis',
      body: `Filmuose įsilaužėlis sėdi prie ekrano ir spėlioja: „Gal šuns vardas?“ Gyvenime slaptažodžių rankomis niekas nespėlioja. Juos renka [[machine|programa]]: bando vieną po kito, nepavargdama ir be poilsio dienų. Dryžuotajam belieka gerti kavą.

Iš eilės bandyti visus raidžių derinius ilgai. Todėl programa pradeda nuo [[keys|sąrašo]] – nuo slaptažodžių, kuriuos žmonės renkasi dažniausiai: 123456, qwerty, password. Toks spėjimas vadinamas **dictionary attack** (lietuviškai – žodyno ataka).`,
    },
    patterns: {
      title: 'Įpročiai, kuriuos žino visi',
      body: `Svetainė reikalauja didžiosios raidės, skaičiaus ir ženklo – ir beveik visi daro tą patį: žodis iš didžiosios raidės, skaičiai gale, „!“ pabaigai. Keičia „o“ į „0“ ir „a“ į „@“. Prideda metus.

Programa žino šiuos įpročius. Iš vieno žodžio ji pati padaro daugybę variantų: su didžiąja raide, su metais, su „!“, su nuliu vietoj „o“. Todėl „P@ssw0rd!“ tik atrodo gudrus: tokį variantą ji bando tarp pirmųjų.

Ženklai patys savaime slaptažodžio neišgelbsti. Išgelbsti ilgis ir atsitiktinumas – apie juos toliau.`,
      more: {
        title:
          'Daugiau: kodėl atsisakoma taisyklės „didžioji raidė, skaičius, ženklas“',
        body: `JAV standartų institutas NIST savo slaptažodžių gairėse (SP 800-63B, 4 redakcija, 2025 m. liepa) draudžia svetainėms reikalauti skirtingų ženklų mišinio ir versti keisti slaptažodį pagal grafiką. Tokios taisyklės slaptažodžius daro ne stipresnius, o labiau nuspėjamus: žmonės prideda „1!“ ir keičia „2024“ į „2025“.

Vietoj to NIST reikalauja, kad svetainės priimtų ilgus slaptažodžius ir tikrintų kiekvieną naują slaptažodį pagal populiarių, žodyno ir nutekėjusių slaptažodžių sąrašą. Slaptažodį keisti reikia tada, kai jis nutekėjo, o ne kas ketvirtį.`,
      },
    },
    leaks: {
      title: 'Pavogtų slaptažodžių bazės',
      body: `Svetaines nulaužia nuolat. Pavogtas bazes su paštais ir slaptažodžiais parduoda ir paskelbia internete, o paskui sujungia į milžiniškus [[drawer|rinkinius]]. Tokius nutekėjimus renkanti paslauga Have I Been Pwned skaičiuoja daugiau nei 17 milijardų paskyrų (2026 m. spalio duomenimis).

Spėjimo programai tai geriausias žodynas: tikri tikrų žmonių slaptažodžiai. Slaptažodis, kuris atrodo sudėtingas, bet kartą nutekėjo, jau silpnas: jis guli sąraše toks, koks yra.

O jei nutekėjime yra jūsų paštas kartu su slaptažodžiu, spėlioti iš viso nereikia. Programa bando šią porą pašte, banke, CRM sistemoje. Tai **credential stuffing** (lietuviškai – pavogtų prisijungimo duomenų bandymas kitose svetainėse).`,
    },
    stuffing: {
      title: 'Klausimas: kas pavojuje',
      body: 'Pietų pristatymo svetainę nulaužė, slaptažodžių bazę paskelbė internete. Olegas ten naudojo tą patį slaptažodį kaip darbo pašte. CRM sistemoje slaptažodis kitas. Kas dabar pavojuje?',
    },
    personal: {
      title: 'Ką apie jus žino internetas',
      body: `Kai taikinys yra konkretus žmogus, programa į sąrašą įtraukia tai, ką apie jį lengva sužinoti: vardą ir pavardę, gimimo datą, vaikų ir katino vardus, mėgstamą komandą, įmonės pavadinimą.

Beveik visa tai patys skelbiame [[feed|socialiniuose tinkluose]]: tortas su žvakutėmis, katinas ant sofos, „Su gimtadieniu, Barsikai!“. Todėl marina1987, Barsik2015 ir Romashka2024! krenta greitai, net jei jų nėra jokiame nutekėjime.

Gimtadieniai, artimųjų ir augintinių vardai, automobilio numeris slaptažodžiui netinka. Paslaptimi jie nustojo būti, kai pateko į naujienų srautą.`,
    },
    phrase: {
      title: 'Kas atsilaiko: ilga frazė',
      body: `Slaptažodis atsilaiko, kai jo nėra jokiame sąraše ir jį ilgai spėti. Padeda ilgis ir atsitiktinumas, o ne ženklai.

Jungtinės Karalystės kibernetinio saugumo centras NCSC pataria **tris atsitiktinius žodžius**: „kava-slidės-palangė“ – 19 ženklų, tokios frazės nėra jokiame žodyne, o įsiminti ją lengva. Žodžiai turi būti atsitiktiniai: ne dainos eilutė ir ne „myliu-savo-mamą“.

Ir kiekvienai svetainei – savas slaptažodis. Net stipri frazė, nutekėjusi iš vienos svetainės, atrakins visas kitas, kuriose ji kartojasi.`,
      more: {
        title: 'Daugiau: kokio ilgio',
        body: `Pirmaujančių organizacijų patarimai skaičiais skiriasi, bet visi sako: kuo ilgesnis, tuo geriau.

- **Google:** ne trumpesnis nei 12 ženklų ir skirtingas slaptažodis kiekvienai svarbiai paskyrai.
- **NIST** (gairės SP 800-63B, 2025): svetainės turi reikalauti bent 15 ženklų, jei prisijungiama tik slaptažodžiu, ir leisti iki 64 ženklų.
- **CISA** (JAV kibernetinio saugumo agentūra): bent 16 ženklų, kiekvienai paskyrai savas, o saugoti – slaptažodžių tvarkyklėje.

Trys ar keturi atsitiktiniai žodžiai lengvai pasiekia tokį ilgį.`,
      },
    },
    check: {
      title: 'Ką padaryti šiandien',
      body: `Dvidešimties skirtingų ilgų slaptažodžių neįsimins niekas. Juos prisimena **password manager** (slaptažodžių tvarkyklė) – apie ją kita pamoka.

- **Patikrinkite savo paštą** svetainėje haveibeenpwned.com: paslauga parodys, kuriuose nutekėjimuose jis buvo. Jei buvo – pakeiskite slaptažodį toje svetainėje ir visur, kur jis kartojosi.
- **Paštas, bankas ir darbo paskyros** savo ilgus slaptažodžius gauna pirmos: per paštą atkuriama visa kita.
- **Įjunkite 2FA** – antrą spyną: tada vieno pavogto slaptažodžio nepakanka. Išsamiau – 5 pamokoje.
- Svetainė siūlo **passkey** – prisijungimą be slaptažodžio, piršto atspaudu ar telefono atrakinimo kodu? Sutikite: spėti nėra ko.`,
      more: {
        title: 'Daugiau: kaip patikrinti slaptažodį jo neparodant',
        body: `**Paštą** svetainėje haveibeenpwned.com įvesti galima: paslauga ieško jo nutekėjusiose bazėse ir parodo, kurios svetainės jį prarado.

**Slaptažodį** Have I Been Pwned tikrina gudriai: jūsų naršyklė ar slaptažodžių tvarkyklė paverčia jį ilgu užšifruotu atspaudu (hash) ir išsiunčia tik pirmus 5 ženklus. Paslauga grąžina visus panašius atspaudus iš nutekėjimų, o sutapimo ieško jau jūsų įrenginys. Pats slaptažodis niekur neiškeliauja. Taip veikia nutekėjimų patikros daugelyje slaptažodžių tvarkyklių.

**Passkey** (prieigos raktas) – slaptažodžio pakaitalas, kurį propaguoja FIDO Alliance, Google ir Microsoft. Raktas saugomas jūsų telefone ar kompiuteryje, jo negalima atspėti ir negalima įvesti netikroje svetainėje. NCSC pataria rinktis passkey visur, kur jis siūlomas.`,
      },
    },
    audit: {
      title: 'Užduotis: Olego slaptažodžiai',
      body: `Olegas peržiūrėjo pamoką ir sunerimo. Jis išsirašė savo slaptažodžius ir paprašė Marinos juos patikrinti.

Kiekvienam slaptažodžiui nuspręskite, kaip jį atspės: **kris iškart** (yra sąrašuose, šablonuose ar nutekėjime), **atspės iš socialinių tinklų** (sudarytas iš asmeninių duomenų) ar **atsilaikys**.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Olegas žino, kuriuos slaptažodžius keisti pirmus.

- Slaptažodžius spėja **programa**: pirmiausia populiarius, nutekėjusius ir šabloninius, paskui – jūsų duomenis iš socialinių tinklų.
- Nutekėjęs slaptažodis silpnas, kad ir koks sudėtingas atrodytų, ir atrakina visas svetaines, kuriose kartojasi (**credential stuffing**).
- Atsilaiko **ilga atsitiktinių žodžių frazė**, kiekvienai svetainei sava. Prisiminti jas visas padės slaptažodžių tvarkyklė – tai kita pamoka.`,
    },
  },
  annotations: {
    'machine.alt': () =>
      'Dryžuotasis išsidrėbęs kėdėje su kava. Šalia triukšminga mašina: krūva vienodų raktų byra į piltuvą, o mechaninė ranka vieną po kito kiša juos į durų su vokeliu spyną.',
    'machine.narration': () => 'Dryžuotasis nespėlioja – už jį dirba mašina.',
    'machine.striped': () =>
      'Spėlioti pačiam? Kam. Tegul mašina perrenka sąrašą.',
    'patterns.alt': () =>
      'Ta pati spėjimo mašina, kišanti raktus į spyną. Virš raktų krūvos – lupa su slaptažodžių šablonais: Password1! ir P@ssw0rd.',
    'patterns.narration': () => 'Raktų krūvoje – įprasti šablonai.',
    'patterns.zoom': () =>
      'Šablonai, kuriuos mašina bando pirmus\nPassword**1!** · P**@**ssw**0**rd\ndidžioji raidė ir „1!“, @ ir 0 vietoj raidžių',
    'archive.alt': () =>
      'Begalinis archyvas: lentynos su stalčiais, pilnais raktų ir etikečių. Dryžuotasis ant kopėčių ištraukia stalčių ir iškelia auksinį raktą, o apačioje sudaužyta pietų pristatymo svetainės dėžė.',
    'archive.narration': () => 'Pavogtų raktų archyvas.',
    'archive.striped': () =>
      'Milijardai tikrų slaptažodžių. Pradėsiu nuo šitų – žmonės mėgsta kartotis.',
    'stuffing.alt': () =>
      'Tas pats archyvas: Dryžuotasis ant kopėčių su auksiniu raktu iš stalčiaus, apačioje – sudaužyta pietų pristatymo svetainės dėžė.',
    'stuffing.narration': () => 'Pietų pristatymo svetainę nulaužė.',
    'profile.alt': () =>
      'Dryžuotasis laiko milžinišką telefoną su atverstu Olego naujienų srautu: tortas su žvakutėmis, rudas katinas ant sofos, Olegas su puodeliu ir katinu – ir rašosi į bloknotą. Tolumoje Olegas kelia naują katino nuotrauką.',
    'profile.narration': () => 'Olego srautas atviras visiems.',
    'profile.striped': () => 'Katinas Barsikas, nuo 2015 metų… Užsirašau.',
    'phrase.alt': () =>
      'Marina laiko ilgą raktą iš trijų pakabukų: kavos puodelio, slidžių ir lango su gėle. Spėjimo mašina šalia užstrigo ir rūksta, Dryžuotasis kasosi galvą.',
    'phrase.narration': () => 'Mašina tokio rakto nežino.',
    'phrase.compare': () =>
      'Kaip atspės tris slaptažodžius\natsilaikys: trys atsitiktiniai žodžiai|kava-slidės-palangė\niškart: žodis + metai + „!“|Romashka**2024!**\niš socialinių tinklų: vardas + gimimo metai|marina**1987**',
    'check.alt': () =>
      'Marina prie nešiojamojo kompiuterio: ekrane vokas po lupa ir žalia varnelė. Šalia telefonas su skydu ir seifo ženkliukas. Per petį žiūri Olegas su puodeliu.',
    'check.narration': () => 'Penkios minutės, kurias verta skirti šiandien.',
    'check.marina': () =>
      'Mano paštas buvo pristatymo svetainės nutekėjime. Ten slaptažodį jau pakeičiau.',
    'summary.machine': () => 'Spėja programa, o ne žmogus',
    'summary.archive': () => 'Nutekėjęs slaptažodis jau sąraše',
    'summary.profile': () => 'Gimtadieniai ir katinai – ne paslaptis',
    'summary.phrase': () => 'Ilga frazė, kiekvienai svetainei sava',
    'summary.check': () => 'Patikrinkite paštą, įjunkite 2FA',
  },
  quizzes: {
    stuffing: {
      question:
        'Pietų pristatymo svetainę nulaužė. Olegas ten naudojo tą patį slaptažodį kaip darbo pašte, o CRM sistemoje – kitą. Kas pavojuje?',
      options: {
        'delivery-only': 'Tik pristatymo svetainė: nulaužė ją, o ne paštą.',
        'mail-too':
          'Pristatymo svetainė ir darbo paštas: porą „paštas + slaptažodis“ išbandys ir ten.',
        nothing: 'Niekas: Olego slaptažodis sudėtingas, su skaičiais ir „!“.',
      },
      wrong: {
        'delivery-only':
          'Pašto niekas nelaužia – į jį tiesiog prisijungs: pora „paštas + slaptažodis“ iš nutekėjimo tinka ir jam. Būtent taip veikia credential stuffing.',
        nothing:
          'Sudėtingumas čia nesvarbus: slaptažodžio nespėja, jis jau guli nutekėjusioje bazėje toks, koks yra. Programa tiesiog bando jį kitose svetainėse.',
      },
      explain:
        'Porą „paštas + slaptažodis“ iš nutekėjimo programa bando pašte, banke, socialiniuose tinkluose – visur. Tai credential stuffing. Olego darbo paštas pavojuje, nes slaptažodis tas pats. CRM sistemą gelbsti tik tai, kad slaptažodis ten kitas.',
    },
  },
  tasks: {
    audit: {
      prompt:
        'Peržiūrėkite šešis Olego slaptažodžius: kas kris iškart, ką atspės iš socialinių tinklų, o kas atsilaikys.',
      goals: {
        lists: 'Rasti slaptažodžiai iš sąrašų, šablonų ar nutekėjimų',
        personal: 'Rastas slaptažodis iš asmeninių duomenų',
        strong: 'Patikimi slaptažodžiai pažymėti kaip atsilaikantys',
      },
      hints: [
        'Apie kiekvieną slaptažodį paklauskite savęs: ar jis yra populiarių sąraše ar nutekėjime? Ar jis sudarytas pagal šabloną „žodis + metai + !“? Ar jis apie Olegą? Jei visur „ne“ – atsilaikys.',
        'Ženklai slaptažodžio nepadaro stipraus. Iškart krenta: klaviatūros raidės iš eilės, „žodis + metai + !“ ir bet koks nutekėjęs slaptažodis. Iš socialinių tinklų atspėja katino vardą su metais. Atsilaiko trys atsitiktiniai žodžiai ir slaptažodžių tvarkyklės slaptažodis.',
        'Qwerty123!, Romashka2024! ir Gr@nd!Tour#88 – „Kris iškart“, Barsik2015 – „Atspės iš socialinių tinklų“, kava-slidės-palangė ir v7#Lq9TmZ!x2pR4w – „Atsilaikys“. Reikiamas mygtukas apvestas punktyru.',
      ],
      solvedNote:
        'Atlikta: tris slaptažodžius Olegas keičia šiandien, banko – kitą. Paštas ir pokalbių programa atsilaiko. O kad nereikėtų įsiminti dvidešimties naujų slaptažodžių, reikia slaptažodžių tvarkyklės – apie ją kita pamoka.',
    },
  },
} satisfies LessonTexts<typeof lesson>
