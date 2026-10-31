import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Password manager. Vienas slaptažodis – vienos durys',
  summary:
    'Skirtingus slaptažodžius prisimena seifas, jūs – vieną. Perkelkite slaptažodžius nuo lipdukų į slaptažodžių tvarkyklę, pakeiskite pasikartojantį ir pasidalykite prieiga per bendrą seifą.',
  preview: {
    alt: 'Schema: password manager – vienas seifas, atrakinamas vienu pagrindiniu slaptažodžiu, o jame kiekvienoms durims savas raktas vietoj lapelių.',
  },
  labels: {
    marina: { name: 'Marina' },
    oleg: { name: 'Olegas' },
    striped: { name: 'Dryžuotasis' },
    'vault-app': { name: '1Password' },
    'vault-personal': { name: 'Asmeninis' },
    'vault-marketing': { name: 'Rinkodara' },
    'vault:request': {
      name: 'Marina, numesk į čatą soc. tinklo slaptažodį, pls! Reikia įkelti postą.',
    },
    'entry:crm': { name: 'Įmonės CRM' },
    'entry:lunch': { name: 'Pietų pristatymas' },
    'entry:social': { name: 'Įmonės socialinis tinklas' },
  },
  steps: {
    'one-key': {
      title: 'Vienas raktas nuo visų durų',
      body: `Olegas turi vieną slaptažodį viskam: paštas, CRM, pietų pristatymo svetainė, bankas. Patogu – kaip vienodų raktų ryšulėlis, kuriame bet kuris raktas atrakina bet kurias [[doors|duris]].

Tačiau svetimas žmogus su vienu tokiu raktu taip pat atrakins visas duris.`,
    },
    leak: {
      title: 'Nutekėjęs raktas',
      body: `Svetaines nulaužia nuolat, o slaptažodžių bazes paskui parduoda. Nutekėjo slaptažodis iš pietų pristatymo svetainės – jį iškart bando pašte, CRM sistemoje ir banke. Nieko spėlioti nereikia: sukčius tiesiog įveda tą patį jūsų slaptažodį.

Iš čia ir pamokos taisyklė: **vienas slaptažodis – vienos durys**. Kiekviena svetainė turi savo slaptažodį.`,
    },
    vault: {
      title: 'Seifas slaptažodžiams',
      body: `Įsiminti dvidešimt skirtingų slaptažodžių neįmanoma, ir nereikia. Tam yra **password manager** (slaptažodžių tvarkyklė) – programa, veikianti kaip seifas slaptažodžiams. Ji kiekvienai svetainei sugalvoja ilgą atsitiktinį slaptažodį, jį saugo ir pati įrašo prisijungiant.

Jūs prisimenate vieną slaptažodį – nuo paties seifo. Jis vadinamas **pagrindiniu slaptažodžiu** (master password): jo nežino niekas, net IT, ir jis niekur neužrašytas.`,
      more: {
        title: 'Daugiau: koks turi būti pagrindinis slaptažodis',
        body: `**Ilgis svarbesnis už sudėtingumą.** 4–5 atsitiktinių žodžių frazė, pavyzdžiui, „zebras tramvajus kefyras švyturys“, stipresnė už „P@ssw0rd!“, ir ją lengviau įsiminti. Nenaudokite dainos eilutės ar katino vardo.

**Nutekėjimai.** Slaptažodžių tvarkyklė pati įspėja, jei kurios nors svetainės slaptažodis rastas nutekėjusiuose duomenyse arba jei jis kartojasi. Tokius slaptažodžius keičia pirmiausia.

**Jei pamiršote pagrindinį slaptažodį.** Seifo neatidarys niekas, net kūrėjai. Kuriant seifą programa išduoda atkūrimo lapą (Emergency Kit): atsispausdinkite jį ir laikykite namie, ne ant darbo stalo. Darbo paskyroje prieigą gali atkurti įmonės administratorius.`,
      },
    },
    app: {
      title: 'Kaip ji atrodo: 1Password',
      body: `Password manager – ne viena programa, jų yra daug. Viena populiariausių – **1Password**: galbūt būtent ją naudoja jūsų įmonė. Yra ir nemokama KeePass, apie ją – vėliau kurse.

Jums 1Password – tai programėlė kompiuteryje ir telefone bei [[screen|ženkliukas naršyklėje]] (plėtinys). Atidarote prisijungimo puslapį – ženkliukas pasiūlo jūsų prisijungimo vardą ir slaptažodį, ir prisijungiate vienu paspaudimu. Nieko nereikia nei prisiminti, nei rinkti.`,
    },
    'no-autofill': {
      title: 'Klausimas: kodėl seifas tyli',
      body: 'Olegas atidarė nuorodą iš laiško „Patvirtinkite prisijungimą prie CRM“. Prisijungimo puslapis kaip tikras, bet 1Password pirmą kartą nieko nesiūlo. Kas nutiko?',
    },
    lookalike: {
      title: 'Antrininkas: raskite skirtumą',
      body: `Seifo įraše adresas **crm.romashka.example**, o laiškas nuvedė Olegą į **crm-romashka.example**. Skirtumas – vienas taškas, pakeistas brūkšneliu.

Tas taškas svarbus. crm.romashka.example – įmonės svetainės skyrius, tarsi gatvė Romashkos mieste. crm-romashka.example – visai kita svetainė: tokį vardą gali nusipirkti bet kas. Tai kitas miestas panašiu pavadinimu.

Akis tokį pakeitimą praleidžia, ypač skubant. Būna ir gudriau: žodyje „rornashka“ greta stovinčios r ir n atrodo kaip „m“, o į adresą galima įterpti kirilicos „о“ vietoj lotyniškos – ekrane jos atrodo vienodai.

Password manager lygina adresą raidė po raidės, todėl pastebi tai, ko nematote jūs. Seifas tyli? Neveskite slaptažodžio ranka – patikrinkite adresą.`,
      more: {
        title: 'Daugiau: kaip skaityti adresą',
        body: `**Skaitykite iš dešinės į kairę.** Taškai dalija adresą į dalis. Svarbiausios – dvi paskutinės: romashka.example. Tai savininkas, „miestas“. Jis perkamas visas, ir svetimas į jį nepateks.

**Visa, kas kairiau, – savininko skyriai.** crm.romashka.example, hr.romashka.example, mail.romashka.example – vieno miesto gatvės, jas kuria tik pati įmonė.

**Žodis kairėje nieko neįrodo.** Adrese romashka.example.login-check.example savininkas – login-check.example, o „romashka“ – tik žodis pradžioje. O adrese crm-romashka.example brūkšnelis nieko nedalija: tai vienas vardas, kurį nusipirko kažkas kitas.`,
      },
    },
    stickers: {
      title: 'Užduotis: lipdukai ant monitoriaus',
      body: `Marina tvarko savo darbo vietą. Ant monitoriaus trys lipdukai su slaptažodžiais, dviejuose slaptažodis tas pats. O Olegas pokalbyje prašo įmonės socialinio tinklo slaptažodžio.

Perkelkite slaptažodžius nuo lipdukų į seifą, pasikartojantį pakeiskite sugeneruotu, o prieigą prie socialinio tinklo duokite Olegui per bendrą seifą „Rinkodara“.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Olegas sužinojo, kuo pavojingas vienas raktas viskam, o Marina sutvarkė lipdukus.

- **Vienas slaptažodis – vienos durys:** nutekėjo vienos svetainės slaptažodis – jį bando visur.
- **Password manager** prisimena ilgus skirtingus slaptažodžius, jūs – vieną **pagrindinį slaptažodį**.
- Seifas tyli prisijungimo puslapyje – patikrinkite adresą. Prieiga dalijamasi per bendrą seifą, o ne žinute.`,
    },
  },
  annotations: {
    'keys.alt': () =>
      'Olegas su vienodų raktų ryšulėliu stovi prie keturių durų: paštas, CRM, pietų pristatymas, bankas.',
    'keys.narration': () => 'Olegas ir jo raktų ryšulėlis.',
    'keys.oleg': () => 'Vienas slaptažodis viskam – užtat nepamiršiu!',
    'keys.doors': () => 'paštas · CRM · pristatymas · bankas',
    'leak.alt': () =>
      'Dryžuotasis su raktu iš nulaužtos pietų pristatymo svetainės atrakina pašto duris, už jų – CRM duris.',
    'leak.narration': () => 'Po mėnesio. Pietų pristatymo svetainę nulaužė.',
    'leak.striped': () =>
      'Nutekėjęs slaptažodis. Pabandysiu jį pašte… ir CRM sistemoje!',
    'vault.alt': () =>
      'Marina prie atidaryto seifo: viduje ant kabliukų kabo skirtingi raktai, kiekvienoms durims savas. Rankoje ji laiko vieną mažą seifo raktą.',
    'vault.narration': () => 'Marina kiekvienoms durims turi savo raktą.',
    'vault.marina': () =>
      'Aš prisimenu vieną slaptažodį – nuo seifo. Kitus jis prisimena pats.',
    'twin.alt': () =>
      'Olegas žiūri į prisijungimo puslapį, panašų į CRM. Seifas ekrano kampe uždarytas ir rakto neduoda.',
    'twin.narration': () => 'Olegas atidarė nuorodą iš laiško.',
    'twin.oleg': () => 'Keista: seifas tyli ir slaptažodžio neįrašo.',
    'app.alt': () =>
      'Marina prie atidaryto seifo su raktais, šalia monitorius su prisijungimo puslapiu.',
    'app.narration': () => 'Seifas gyvena kompiuteryje.',
    'app.marina': () => 'Atidarau CRM – slaptažodis jau įrašytas.',
    'app.screen': () => '1Password naršyklėje',
    'lookalike.alt': () =>
      'Olegas žiūri į prisijungimo puslapį, panašų į CRM; seifas ekrano kampe uždarytas. Ant kadro – adresų palyginimas: tikras crm.romashka.example ir antrininkai crm-romashka.example bei crm.rornashka.example.',
    'lookalike.narration': () => 'Įrašo adresas ir antrininko adresas.',
    'lookalike.compare': () =>
      'Palyginkite raidė po raidės\ntikras, iš įrašo|crm**.**ro**m**ashka.example\nantrininkas: brūkšnelis vietoj taško|crm**-**romashka.example\nantrininkas: „rn“ vietoj „m“|crm.ro**rn**ashka.example',
    'summary.keys': () => 'Vienas raktas viskam – pavojinga',
    'summary.leak': () => 'Nutekėjimas atrakina visas duris',
    'summary.vault': () => 'Seifas prisimena, jūs – pagrindinį slaptažodį',
    'summary.twin': () => 'Seifas tyli – patikrinkite adresą',
  },
  quizzes: {
    'no-autofill': {
      question:
        'Puslapis atrodo kaip įprastas prisijungimas prie CRM, o 1Password nesiūlo slaptažodžio. Kodėl?',
      options: {
        'wrong-address':
          'Puslapio adresas ne tas, kuris išsaugotas įraše: tai antrininkas.',
        'vault-broken': 'Seifas sugedo – paprasčiau įvesti slaptažodį ranka.',
        'new-design':
          'CRM sistema atnaujino dizainą, ir seifas jos neatpažino.',
      },
      wrong: {
        'vault-broken':
          'Seifas nesugedo: jis palygino puslapio adresą su adresu įraše, ir jie nesutapo. Įvesti slaptažodį ranka – būtent to ir laukia sukčius.',
        'new-design':
          'Seifui dizainas nerūpi: jis žiūri tik į adresą. Tikroje svetainėje su nauju dizainu slaptažodis būtų įrašytas kaip įprasta.',
      },
      explain:
        'Password manager įrašo slaptažodį tik svetainėje, kurios adresas išsaugotas įraše. Antrininko adresas kitoks, net jei skiriasi vienu ženklu, todėl seifas tyli, nors puslapis nukopijuotas iki pikselio. Kuo tiksliai skiriasi adresai – kitame žingsnyje.',
    },
  },
  tasks: {
    stickers: {
      prompt:
        'Pašalinkite slaptažodžius nuo lipdukų, atsikratykite pasikartojimo ir duokite Olegui prieigą prie socialinio tinklo nesiųsdami slaptažodžio.',
      goals: {
        saved: 'Ant monitoriaus neliko lipdukų su slaptažodžiais',
        unique: 'Nė vienas slaptažodis nesikartoja',
        shared: 'Įmonės socialinis tinklas – bendrame seife „Rinkodara“',
      },
      hints: [
        'Pradėkite nuo lipdukų: kiekvienas turi mygtuką „Perkelti į seifą“. Įrašą, kurio slaptažodis kartojasi, seifas pažymės žodžiu „kartojasi“.',
        'Pasikartojimą pašalina mygtukas „Pakeisti sugeneruotu“ atidarytame įraše. Socialinio tinklo slaptažodžio nesiunčia žinute: įrašą perkelia į bendrą seifą, prie kurio Olegas jau turi prieigą.',
        'Perkelkite tris lipdukus, įraše „Įmonės CRM“ paspauskite „Pakeisti sugeneruotu“, tada įraše „Įmonės socialinis tinklas“ – „Bendrinti…“ ir „Perkelti į bendrą seifą „Rinkodara““. Reikiama vieta apvesta punktyru.',
      ],
      solvedNote:
        'Atlikta: lipdukai smulkintuve, CRM turi savo ilgą slaptažodį, o Olegas mato socialinį tinklą bendrame seife. Išeis jis iš skyriaus – prieigą uždarys vienu paspaudimu.',
    },
  },
} satisfies LessonTexts<typeof lesson>
