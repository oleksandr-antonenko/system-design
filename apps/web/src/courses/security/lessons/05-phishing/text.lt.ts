import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Phishing. Laiškas masalas',
  summary:
    'Vardas laiške – kostiumas, tiesą sako adresas. Raskite masalus pašte nieko juose nespausdami.',
  preview: {
    alt: 'Schema: phishing – laiškų krūvoje vienas masalas atrodo įprastai, bet tikrasis jo atgalinis kelias veda į padirbtą svetainę, ir tai matyti neatidarius.',
  },
  labels: {
    marina: { name: 'Marina' },
    oleg: { name: 'Olegas' },
    striped: { name: 'Dryžuotasis' },
    victor: { name: 'Viktoras' },
    'victor-mask': { name: '„Viktoras“' },
    'bait-letter': { name: 'Laiškas' },
    'letter:act': {
      name: 'Buhalterija · Romashka',
      note: 'Spalio suderinimo aktas – pasirašykite iki 18:00',
    },
    'letter:act:body': {
      name: `Marina, laba diena!

Priede – spalio mėnesio suderinimo aktas su „Lastochka“. Prašom pasirašyti šiandien: rytoj uždarome mėnesį.`,
    },
    'letter:act:button': { name: 'Atidaryti aktą „Dokumentuose“' },
    'letter:act:sign': {
      name: 'Olga Petrenko, vyriausioji buhalterė\nUAB „Romashka“ · vidinis 214',
    },
    'mail:ceo': {
      name: 'Viktoras Andrejevičius',
      note: 'Sąskaita už stendą Vilniuje – apmokėti šiandien',
    },
    'mail:ceo:body': {
      name: `Marina, laba diena.

Parodos Vilniuje organizatoriai atsiuntė naujus rekvizitus, senoji sąskaita negalioja. Prašom apmokėti šiandien iki 17:00, kitaip stendą atiduos kitiems.

Aš derybose, neskambinkite – tiesiog padarykite. Sąskaita priede.

V.`,
    },
    'mail:ceo:link': { name: 'Saskaita_stendas_Vilnius.pdf' },
    'mail:ceo:why': {
      name: 'Domenas romashka-group.example – ne jūsų. Ir visas asmeninio sukčiavimo rinkinys: nauji rekvizitai, skubu, „neskambinkite“. Tokį prašymą tikrina paskambinus numeriu iš žinyno.',
    },
    'mail:hr': {
      name: 'HR · Romashka',
      note: 'Apklausa: kur važiuojame vasarą?',
    },
    'mail:hr:body': {
      name: 'Kolegos, renkamės vasaros išvykos vietą: ežeras, kalnai ar jūra. Balsuokite iki penktadienio.',
    },
    'mail:hr:link': { name: 'Atidaryti apklausą' },
    'mail:hr:why': {
      name: 'Adresas @romashka.example, nuoroda į hr.romashka.example – dešinėje jūsų domenas. Nieko neprašo ir neskubina.',
    },
    'mail:oleg': { name: 'Olegas Kovalčukas', note: 'Nuotraukos iš vakarėlio' },
    'mail:oleg:body': {
      name: 'Marina, labas! Įkėliau nuotraukas į bendrą aplanką. Tu ten su akiniais širdelėmis :)',
    },
    'mail:oleg:link': { name: 'Aplankas „Vakarėlis“' },
    'mail:oleg:why': {
      name: 'Savas adresas, nuoroda veda į darbo saugyklą drive.romashka.example.',
    },
    'mail:parcel': {
      name: 'Pristatymo tarnyba',
      note: 'Siunta sulaikyta: sumokėkite 1,99 €',
    },
    'mail:parcel:body': {
      name: 'Jūsų siunta laukia sandėlyje. Sumokėkite 1,99 € už pristatymą per 24 valandas, kitaip ji bus grąžinta siuntėjui.',
    },
    'mail:parcel:link': { name: 'Sumokėti 1,99 €' },
    'mail:parcel:why': {
      name: 'Masinis masalas: siuntos nelaukiate, mokėjimas per nuorodą, terminas „24 valandos“. Iš ten įvestos kortelės nuskaičiuos ne 1,99 €.',
    },
    'mail:ira': {
      name: 'Ira · IT',
      note: 'Šeštadienį paštas neveiks nuo 10 iki 12',
    },
    'mail:ira:body': {
      name: `Kolegos, šeštadienį atnaujiname pašto serverį. Nuo 10:00 iki 12:00 paštas bus nepasiekiamas.

Nieko daryti nereikia. Klausimai – darbo pokalbyje.

Ira`,
    },
    'mail:ira:why': {
      name: 'Savas adresas, nei nuorodų, nei prašymų. Tikras IT perspėja, o ne prašo slaptažodžio.',
    },
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
    'mail:it:why': {
      name: 'rornashka vietoj romashka: šalia esančios „r“ ir „n“ panašios į „m“. Ir IT niekada neprašo patvirtinti slaptažodžio per nuorodą.',
    },
  },
  steps: {
    prize: {
      title: 'Patikrinimas: jums pasisekė?',
      body: `Pradėkime nuo patikrinimo. Pietų pertrauka, naršote naujienas, ir naršyklėje atsidaro langas su prizu.

Pasielkite su juo taip, kaip pasielgtumėte gyvenime. Bandymas vienas.`,
    },
    bait: {
      title: 'Laiškas su kabliuku',
      body: `Ryte Olegas gauna laišką: „Jūsų slaptažodis baigia galioti šiandien. Patvirtinkite jį, kitaip prieiga prie pašto bus uždaryta“. Logotipas, mygtukas, parašas „IT skyrius“. Olegas skuba ir spaudžia.

Kabliukas beveik visada vienas iš dviejų: baisu ką nors prarasti arba gaila praleisti dovaną. Langas su iPhone Duo pamokos pradžioje – antrasis kabliukas.`,
    },
    'fake-door': {
      title: 'Kartoninės durys',
      body: `Mygtukas veda į puslapį, panašų į prisijungimą prie darbo pašto, bet tai dekoracija: ten įvestas slaptažodis atitenka sukčiui.

Tokį laišką masalą vadina **sukčiavimu** (angl. phishing, nuo žodžio „žvejyba“): užmeta tūkstančius laiškų ir laukia, kas užkibs.`,
    },
    costume: {
      title: 'Vardas – tai kostiumas',
      body: `„IT skyrius“, „Bankas“, „Viktoras Andrejevičius“ eilutėje „Nuo“ – kostiumas. Šį vardą rašo pats siuntėjas, ir užsivilkti jį gali bet kas. Tiesą sako **adresas**: tai, kas po @.

Paspauskite siuntėjo vardą, ir paštas parodys adresą. Kolegų laiškų adresas baigiasi lygiai @romashka.example. Olegui atėjusiame laiške – [[addr|@rornashka.example]]: vietoj „m“ stovi „r“ ir „n“, skubant neatskirsi.

Tas pats su nuorodomis: prieš spausdami užveskite žymeklį ant mygtuko ir perskaitykite adresą lango apačioje.`,
      more: {
        title: 'Daugiau: kaip skaityti nuorodos adresą',
        body: `**Domeną skaito iš dešinės.** Adrese romashka.example.login-check.example savininkas – login-check.example, o „romashka“ – tik žodis pradžioje. O hr.romashka.example – jūsų: dešinėje stovi romashka.example.

**„Atsakyti“ gali nueiti ne ten.** Sukčius į atsakymą įrašo savo adresą, ir jis skiriasi nuo adreso eilutėje „Nuo“. Patikrinkite ir jį.

**QR kodas laiške** – ta pati nuoroda, tik jos nematyti, kol nenuskenuosite. QR kodų iš laiškų „apie slaptažodį“ ir „apie mokėjimą“ neskenuokite.

**Radote masalą?** Paspauskite „Pranešti apie sukčiavimą“ arba persiųskite laišką IT. Netrinkite tyliai: jis atėjo ne tik jums.`,
      },
    },
    research: {
      title: 'Laiškas asmeniškai jums',
      body: `Masinį masalą siunčia tūkstančiams. **Asmeninį sukčiavimą** rašo asmeniškai jums.

Sukčius iš anksto skaito įmonės svetainę, socialinius tinklus ir naujienas: žino direktoriaus vardą, kas apmoka sąskaitas ir į kokią parodą važiuojate.`,
    },
    mask: {
      title: 'Direktoriaus kaukė',
      body: `Toks laiškas kreipiasi į jus vardu, mini tikrą projektą ir ateina „nuo direktoriaus“ penktadienio vakarą: skubiai, slaptai, „neskambinkite, aš susitikime“.

Adresas gali skirtis vienu žodžiu, o kartais laiškas ateina iš tikros, bet nulaužtos partnerio pašto dėžutės.`,
    },
    call: {
      title: 'Patikrinimas kitu kanalu',
      body: `Todėl prašymus dėl pinigų, slaptažodžių ir prieigų tikrina kitu kanalu: skambučiu numeriu iš žinyno, o ne iš laiško, arba darbo pokalbyje.

Marina taip ir padarė – ir kaukė nukrito.`,
    },
    clue: {
      title: 'Klausimas: raskite įkaltį',
      body: 'Marinai rašo „buhalterija“. Viskas atrodo kaip įprasta: logotipas, tema su terminu, vyriausiosios buhalterės parašas. Viena laiško vieta tikrai išduoda klastotę. Paspauskite ją laiške.',
    },
    inbox: {
      title: 'Užduotis: sutvarkykite paštą',
      body: `Tai Marinos pirmadienio paštas: šeši laiškai. Trys iš jų – masalai, trys – tikri.

Atidarykite kiekvieną laišką ir pažymėkite: „Sukčiavimas“ arba „Tikras“. Kad pamatytumėte siuntėjo adresą, paspauskite jo vardą; kad pamatytumėte nuorodos adresą – užveskite ant jos žymeklį. Masaluose nieko nespauskite.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Olegas užkibo ant masalo, o Marina jį perprato – ir su „buhalterija“, ir su „direktoriumi“.

- **Sukčiavimas** (phishing) – laiškas masalas: skubina, gąsdina ir veda į netikrą puslapį.
- Siuntėjo vardas – kostiumas. Žiūrėkite adresą po @ ir nuorodos adresą prieš spausdami.
- **Asmeninis sukčiavimas** žino jūsų vardą ir projektus. Prašymus dėl pinigų, slaptažodžių ir prieigų tikrinkite kitu kanalu.`,
    },
  },
  annotations: {
    'bait.alt': () =>
      'Dryžuotasis sėdi ant milžiniško monitoriaus kaip ant prieplaukos ir nuleidžia į biurą valą. Ant kabliuko – blizgantis vokas su raudonu šauktuku ir žadintuvu. Olegas su puodeliu tiesiasi prie voko, Marina šalia kilsteli antakį.',
    'bait.narration': () => 'Pirmadienis, 9:12. Naujas laiškas.',
    'bait.letter': () =>
      '„Jūsų slaptažodis baigia galioti šiandien! Patvirtinkite jį, kitaip prieiga prie pašto bus uždaryta“.',
    'bait.oleg': () => 'Tuoj, spaudžiu!',
    'bait.marina': () => 'Palauk…',
    'fakedoor.alt': () =>
      'Kartoninė dekoracija, nupiešta kaip pašto prisijungimo durys, paremta pagaliais. Olegas kiša pro plyšį auksinį raktą – savo slaptažodį. Už kartono Dryžuotasis gaudo raktą graibštu.',
    'fakedoor.narration': () => 'Po minutės.',
    'fakedoor.oleg': () => 'Keista, puslapis tiesiog atsinaujino.',
    'fakedoor.striped': () => 'Raktas gautas. Ačiū!',
    'costume.alt': () =>
      'Dryžuotasis pigiu „IT pagalbos“ kostiumu: ausinės, polo marškinėliai su krumpliaračiu, ženklelis. Iš po rankovių kyšo dryžiai, matyti kaukės kraštas. Marina per didelį didinamąjį stiklą apžiūri parašą ant jo voko – stikle dryžiai.',
    'costume.narration': () => 'Vardas – tai kostiumas.',
    'costume.striped': () => 'Sveiki, čia IT skyrius!',
    'costume.zoom': () =>
      'Nuo: IT skyrius\nit-support@ro**rn**ashka.example\nne „m“, o „r“ ir „n“',
    'research.alt': () =>
      'Naktis. Dryžuotasis prie kamštinės lentos su Marinos ir direktoriaus Viktoro nuotraukomis, įmonės svetainės puslapiu, vakarėlio nuotrauka ir kelionės skrajute; viskas sujungta raudonais siūlais. Jis rašo į užrašų knygelę.',
    'research.narration': () => 'Vakaras. Dryžuotasis ruošiasi.',
    'research.striped': () =>
      'Direktorius – Viktoras. Sąskaitas apmoka Marina. Penktadienį jie turi parodą Vilniuje…',
    'mask.alt': () =>
      'Marina prie darbo stalo žiūri į laišką. Monitoriuje Dryžuotasis laiko kartoninę kaukę su Viktoro veidu ir baksnoja į laikrodį, rodydamas į sąskaitą su pinigų maišu. Puodelyje kampe tikrasis Viktoras ilsisi paplūdimyje.',
    'mask.narration': () => 'Penktadienis, 16:40.',
    'mask.victor': () =>
      'Marina, skubiai apmokėkite stendą iki 17:00, rekvizitai nauji. Aš susitikime – neskambinkite.',
    'mask.marina': () => 'Jis visada skambina pats. Ir kodėl „neskambinkite“?',
    'call.alt': () =>
      'Kairėje Marina skambina darbo telefonu. Dešinėje tikrasis Viktoras paplūdimyje atsiliepia ir nustebęs kelia ranką. Apačioje ant grindų guli kartoninė kaukė, Dryžuotasis ant pirštų galiukų sėlina lauk.',
    'call.narration': () => 'Marina skambina Viktorui numeriu iš žinyno.',
    'call.marina': () => 'Viktorai Andrejevičiau, ar prašėte apmokėti stendą?',
    'call.victor': () => 'Kokį stendą? Aš atostogose! Persiųskite laišką Irai.',
    'summary.bait': () => 'Masalas skubina ir gąsdina',
    'summary.costume': () => 'Vardas – kostiumas, tiesa – adrese',
    'summary.mask': () => 'Asmeninis laiškas žino apie jus viską',
    'summary.call': () => 'Patikrinkite paskambinę savo numeriu',
  },
  quizzes: {
    prize: {
      question: 'Ką darysite su šiuo langu?',
      options: { skip: '„Praleisti“', login: '„Prisijungti“' },
      tags: {
        skip: 'Tai buvo sukčiavimas · šaunu, neužkibote',
        login: 'Tai buvo sukčiavimas · užkibote, bet slaptažodžio nesaugojome',
      },
      wrong: {
        login:
          'Užkibote: puslapis tik apsimetė prisijungimu prie paskyros. Jūsų slaptažodžio niekur nesaugojome ir nesiuntėme: laukai iškart ištrinti. Bet tikrame gyvenime po tokio dalyko skubiai keiskite slaptažodį.',
      },
      explain: `Tai ir buvo sukčiavimas: ryški dovana, laikmatis ir pažįstamas prisijungimo langas. Ten įvestas slaptažodis būtų atitekęs sukčiui.

Kas išdavė klastotę: adreso juostoje **gooogle-prizes.example** – svetima svetainė, o pavadinime trys „o“; prizas už nieką; laikmatis, kad nespėtumėte pagalvoti. Spyna adreso juostoje nieko neįrodo: ją turi ir sukčių svetainės.`,
    },
    clue: {
      question: 'Kas šiame laiške tikrai išduoda klastotę?',
      options: {
        name: 'siuntėjo vardas',
        addr: 'siuntėjo adresas',
        subj: 'tema su terminu',
        btn: 'mygtukas',
        sign: 'parašas',
      },
      tags: {
        name: 'Vardą ir logotipą nukopijuoti – minutės darbas: tai kostiumas.',
        addr: 'romashka-docs.example – svetimas domenas, jį galėjo nusipirkti bet kas.',
        subj: 'Terminas pats savaime nieko neįrodo: tikra buhalterija irgi skubina.',
        btn: 'Mygtuką tikrina užvedę žymeklį, bet atrodo jis vienodai bet kuriame laiške.',
        sign: 'Vyriausiosios buhalterės vardą ir telefoną lengva nusirašyti iš įmonės svetainės.',
      },
      wrong: {
        name: 'Vardą ir logotipą nukopijuoti – minutės darbas: tai kostiumas.',
        subj: 'Terminas pats savaime nieko neįrodo: tikra buhalterija irgi skubina.',
        btn: 'Mygtuką tikrina užvedę žymeklį, bet atrodo jis vienodai bet kuriame laiške.',
        sign: 'Vyriausiosios buhalterės vardą ir telefoną lengva nusirašyti iš įmonės svetainės.',
      },
      explain:
        'Viską, kas matyti laiške, siuntėjas nupiešia pats: vardą, logotipą, temą, mygtuką, parašą. Suklastoti negalima tik domeno – adreso dalies po @. Čia tai **romashka-docs.example**, o ne romashka.example.',
    },
  },
  tasks: {
    inbox: {
      prompt: 'Sutvarkykite šešis laiškus: raskite tris masalus.',
      goals: {
        phish: 'Visi masalai pažymėti „Sukčiavimas“',
        real: 'Visi tikri laiškai pažymėti „Tikras“',
      },
      hints: [
        'Pradėkite nuo adreso: paspauskite siuntėjo vardą. Kolegų laiškų adresas baigiasi lygiai @romashka.example – tikrinkite raidė po raidės.',
        'Užveskite žymeklį ant mygtuko ar nuorodos: lango apačioje atsiras jos adresas. hr.romashka.example ir drive.romashka.example – jūsų, domeną skaito iš dešinės. Įtartina viskas, kas skubina ir prašo slaptažodžio, pinigų ar „neskambinti“.',
        'Masalai: „Jūsų slaptažodis baigia galioti šiandien“, „Siunta sulaikyta“ ir „Sąskaita už stendą Vilniuje“. Kiti trys – tikri. Reikiamas laiškas ir mygtukas apvesti punktyru.',
      ],
      solvedNote:
        'Atlikta: trys masalai pagauti, tikri laiškai savo vietoje. Gyvenime kiekvieną masalą dar persiunčia IT – laiškas atėjo ne tik jums.',
    },
  },
} satisfies LessonTexts<typeof lesson>
