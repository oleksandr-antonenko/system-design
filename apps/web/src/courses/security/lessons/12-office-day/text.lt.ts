import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Practice. Diena biure',
  summary:
    'Viskas kartu: šešios trumpos vienos darbo dienos situacijos kurso ekranuose – Wi-Fi, kavinė, laiškas, žinutė „iš IT“, plėtinys ir prieiga DI.',
  preview: {
    alt: 'Iliustracija: practice – įprasta diena biure iš darbuotojo nugaros, žalios varnelės prie užrakinto kompiuterio, maršrutizatoriaus ir voko.',
  },
  labels: {
    marina: { name: 'Marina' },
    oleg: { name: 'Olegas' },
    ira: { name: 'Ira' },
    victor: { name: 'Viktoras' },
    guest: { name: 'Klientė' },
    striped: { name: 'Dryžuotasis' },
    'vpn-profile': { name: 'Romashka' },
    offer: {
      name: 'Komercinis pasiūlymas',
      note: 'Laba diena! Siunčiu pasiūlymą, kaip rytą sutarėme. Marina',
    },
    'offer:file': { name: 'Pasiulymas_Kregzde.pdf' },
    'net:Rozmarin-Guest': {
      name: 'Kavinės „Rozmarin“ Wi-Fi',
      note: 'Nemokamas internetas svečiams. Spausdami „Sutinku“, sutinkate su taisyklėmis.',
    },
    'net:Rozmarin-Free-WiFi': {
      name: 'Free WiFi · prisijungimas',
      note: 'Kad gautumėte nemokamą internetą, prisijunkite darbo paštu.',
    },
    'net:Galaxy S24': {
      name: 'Telefono interneto dalijimasis',
      note: 'Tai kažkieno telefono dalijamas internetas. Slaptažodį žino tik jo savininkas.',
    },
    'mail:pay': {
      name: 'Buhalterija',
      note: 'Patvirtinkite atlyginimo duomenis iki 16:00',
    },
    'mail:pay:body': {
      name: `Gerbiami darbuotojai!

Atlyginimus pervedame į naują banką. Patvirtinkite duomenis šiandien iki 16:00, kitaip lapkričio išmoka vėluos.

Buhalterija`,
    },
    'mail:pay:link': { name: 'Patvirtinti duomenis' },
    'mail:pay:why': {
      name: 'Domenas romashka-pay.example – ne jūsų, nors ir panašus. Skubiai, atlyginimas, prisijungimo mygtukas – klasikinis masalas. Tikra buhalterija rašo iš @romashka.example.',
    },
    'mail:olga': {
      name: 'Olga Petrenko',
      note: 'Taksi kvitai iki penktadienio',
    },
    'mail:olga:body': {
      name: 'Marina, labas! Atnešk, prašau, taksi kvitus iš parodos iki penktadienio – uždarome ataskaitą. Olga, buhalterija',
    },
    'mail:olga:why': {
      name: 'Adresas @romashka.example, nei nuorodų, nei skubių prašymų: tiesiog priminimas.',
    },
    'mail:hr': { name: 'HR · Romashka', note: 'Kitų metų atostogų grafikas' },
    'mail:hr:body': {
      name: 'Kolegos, įrašykite pageidaujamas atostogų datas į formą iki mėnesio pabaigos.',
    },
    'mail:hr:link': { name: 'Atostogų forma' },
    'mail:hr:why': {
      name: 'Savas adresas, nuoroda į hr.romashka.example – dešinėje jūsų domenas.',
    },
    'chat:fake-ira': {
      name: 'Ira IT',
      note: '+370 611 20 450 · naujas numeris',
    },
    'chat:fake-ira:body': {
      name: `Marina, labas! Čia Ira, rašau iš asmeninio, darbo telefonas išsikrovė.

Pas mus saugumo atnaujinimas, reikia skubiai įdiegti nuotolinės prieigos programą, kad viską sutvarkyčiau. Nuorodą atsiųsiu iškart, užtruks minutę.`,
    },
    'chat:fake-ira:call': {
      name: '„Marina, aš susirinkime, nėra kada kalbėti! Tiesiog įdiek, kol neprasidėjo.“ Balsas ragelyje nepažįstamas, ir skambutis iškart nutrūksta.',
    },
    'chat:fake-ira:forwarded': {
      name: 'Ačiū! Tai ne aš: numerį blokuoju ir įspėsiu visus bendrame pokalbyje.',
    },
    'reply:fake-ira:install': {
      name: 'Gerai, siųsk nuorodą, įdiegsiu.',
      note: 'Puiku! Štai nuoroda: remote-help.example/setup',
    },
    'reply:fake-ira:check': {
      name: 'Ira, perskambinsiu tau darbo numeriu iš katalogo ir tada įdiegsiu.',
      note: 'Nereikia skambinti, aš susirinkime! Tai skubu!',
    },
    'chat:oleg': { name: 'Olegas', note: 'pardavimų skyrius' },
    'chat:oleg:body': { name: 'Marina, eini pietauti?' },
    'contact:ira': { name: 'Ira', note: 'IT administratorė' },
    'call:ira': {
      name: '„Marina? Ne, aš nieko nerašiau, numeris tas pats. Nieko nediek, persiųsk man šį susirašinėjimą.“',
    },
    'extensions-app': { name: 'Naršyklės plėtiniai' },
    'group:store': {
      name: 'Diegimas',
      note: 'Olegas pataria: „Įsidiek, su juo lentelės skraido!“',
    },
    'group:installed': {
      name: 'Įdiegti plėtiniai',
      note: 'Kartu peržiūrėkite, kas jau įdiegta.',
    },
    'item:sheets': {
      name: 'Super Sheets Helper',
      note: 'Nežinomas kūrėjas · 900 tūkst. naudotojų',
    },
    'item:coupons': {
      name: 'Kuponai ir nuolaidos 24/7',
      note: 'Įdiegtas dėl vieno pirkinio prieš metus',
    },
    'detail:all-sites': {
      name: 'Skaityti ir keisti visus jūsų duomenis visose svetainėse',
    },
    'detail:clipboard': { name: 'Skaityti tai, ką kopijuojate' },
    'action:install': { name: 'Įdiegti' },
    'action:cancel': { name: 'Atšaukti' },
    'action:keep': { name: 'Palikti' },
    'action:remove': { name: 'Pašalinti' },
    'res:sheets:install': {
      name: 'Stop: lentelių pagalbininkas dabar mato paštą, CRM ir viską, ką kopijuojate. Realybėje dabar: pašalinkite jį ir pasakykite IT.',
    },
    'res:sheets:cancel': {
      name: 'Teisingai: lentelėms nereikia prieigos prie visų svetainių ir iškarpinės.',
    },
    'res:coupons:remove': {
      name: 'Pašalinta. Metus plėtinys matė kiekvieną puslapį dėl vienos nuolaidos.',
    },
    assistant: { name: 'DI asistentas' },
    crm: { name: 'Romashka CRM' },
    'assistant:intro': {
      name: 'Labas! Surinksiu klientų, kuriems laikas priminti apie sutartį, sąrašą. Man reikia prieigos prie CRM: atsiųskite administratoriaus prisijungimo vardą ir slaptažodį – taip greičiausia.',
    },
    'assistant:say-password': {
      name: 'Prisijungimo vardas: admin\nSlaptažodis: ••••••••••••',
    },
    'assistant:say-token': { name: 'Štai raktas: crm_tok_••••••••••••7c21' },
    'assistant:say-reference': {
      name: 'Raktas saugomas 1Password seife: op://Work/crm-agent/token. Paleisk per op run.',
    },
    'assistant:password': {
      name: 'Matau administratoriaus slaptažodį. Nesiųskite slaptažodžių į pokalbį: jie lieka istorijoje. Geriau sukurkite CRM sistemoje atskirą raktą tik skaitymui, o šią žinutę ištrinkite.',
    },
    'assistant:token': {
      name: 'Raktą gavau, dirbu. Patarimas ateičiai: raktas – irgi paslaptis, saugiau duoti nuorodą į įrašą 1Password seife.',
    },
    'assistant:reference': {
      name: 'Paleidžiu per op run: raktas bus įrašytas į aplinkos kintamąjį ir į pokalbį nepateks.',
    },
    'assistant:done': {
      name: 'Atlikta: radau 17 klientų, kurių sutartys baigiasi gruodį, ir surinkau juos į lentelę. Prieigos man nebereikia – raktą galima atšaukti.',
    },
    'section:sales': { name: 'Pardavimai' },
    'section:clients': { name: 'Klientai' },
    'section:invoices': { name: 'Sąskaitos' },
    'section:staff': { name: 'Darbuotojai' },
  },
  steps: {
    morning: {
      title: 'Įprasta darbo diena',
      body: `Tai praktinė pamoka. Naujų žodžių nebus: laukia viena Marinos darbo diena ir šešios trumpos situacijos, kiekviena – iš ankstesnių kurso pamokų.

Spręskite jas pažįstamuose ekranuose: telefone, pašte, pokalbių programoje, naršyklėje ir DI pokalbyje. Jei kas nors pasimiršo, užuominos primins.`,
    },
    guest: {
      title: '9:30. Svečias prašo Wi-Fi',
      body: 'Rytą į susitikimą atvyksta klientė ir prašo interneto: telefonas beveik negaudo. Ką jai duoti?',
    },
    lunch: {
      title: '13:00. Pietūs kavinėje',
      body: `Marina pietauja kavinėje, o klientas laukia pasiūlymo iki antros. Ant staliuko – [[sign|lentelė]] su kavinės tinklo pavadinimu, ją galima paspausti. Prie gretimo staliuko – „barista“ su telefonu.

Prisijunkite prie kavinės tinklo iš lentelės, įjunkite VPN ir tik tada išsiųskite laišką. Prisiminkite 1 pamoką: dvynio signalas stipresnis, ir jis prašo darbo pašto.`,
    },
    accounting: {
      title: '14:10. Laiškas iš „buhalterijos“',
      body: `Po pietų pašte trys nauji laiškai, vienas iš jų – apie atlyginimą ir „iki 16:00“.

Pažymėkite masalą ir tikrus laiškus, masale nieko nespausdami. Kaip 5 pamokoje: žiūrėkite adresą po @ ir nuorodos adresą.`,
    },
    'it-call': {
      title: '15:00. „Ira“ iš naujo numerio',
      body: `Pokalbių programoje rašo „Ira iš IT“ iš nepažįstamo numerio ir prašo skubiai įdiegti nuotolinės prieigos programą.

Kaip 6 pamokoje: atsakykite mandagia pauze, patikrinkite numeriu iš katalogo ir persiųskite susirašinėjimą tikrai Irai.`,
    },
    extension: {
      title: '16:00. Naujas plėtinys',
      body: `Olegas pataria plėtinį lentelėms. Prieš diegimą naršyklė parodo jo leidimus.

Kaip 9 pamokoje: atsisakykite plėtinio, prašančio visų svetainių, ir kartu pašalinkite nereikalingą iš jau įdiegtų.`,
    },
    assistant: {
      title: '17:00. Asistentui reikia prieigos',
      body: `DI asistentas renka klientų, kuriems laikas pratęsti sutartį, sąrašą ir prašo CRM administratoriaus slaptažodžio.

Kaip 10 pamokoje: jokių slaptažodžių pokalbyje. Sukurkite raktą tik skaityti skyrių „Klientai“ 7 dienoms, išsaugokite jį 1Password, duokite asistentui nuorodą į įrašą, o baigus darbą atšaukite.`,
    },
    summary: {
      title: 'Kurso santrauka',
      body: `Vakaras. Marina užrakina ekraną, Ira parodo nykštį, o Dryžuotasis išeina tuščiomis.

- **Tinklas ir slaptažodžiai:** svečiams – svečių tinklas, kavinėje – VPN; skirtingus slaptažodžius atsimena seifas, svarbiems prisijungimams – 2FA.
- **Žmonės ir laiškai:** vardas – kostiumas, tiesą sako adresas; keistą prašymą tikrina kitu kanalu.
- **Programos, naršyklė, DI:** tik reikalingi failai ir plėtiniai; asistentui – savas ribotas raktas.
- **Jei jau paspaudėte** – iškart pasakykite IT. Baisu ne suklysti, o nutylėti.

Kursas baigtas. Ačiū, kad likote iki galo!`,
    },
  },
  annotations: {
    'morning.alt': () =>
      'Rytas šviesiame biure: Marina įeina su rankine ir kava, Olegas mojuoja nuo stalo su puodeliu, Ira taiso ausines, Viktoras praeina su aplanku.',
    'morning.narration': () => 'Pirmadienio rytas.',
    'morning.marina': () => 'Na, įprasta diena. Pažiūrėsim, ką ji atneš.',
    'guest.alt': () =>
      'Prie registratūros klientė persikiniu švarku rodo telefoną; Marina tiesiasi prie kortelės ant stovelio su Wi-Fi ženklu. Už jos – mėtinis kupolas virš biuro ir atskiras persikinis virš svečių kėdžių.',
    'guest.narration': () => 'Registratūra, 9:30.',
    'guest.guest': () => 'Ar galiu jūsų Wi-Fi? Telefonas visai negaudo.',
    'cafe.alt': () =>
      'Marina kavinėje prie staliuko su salotomis ir telefonu, ant staliuko lentelė su Wi-Fi ženklu. Prie gretimo staliuko Dryžuotasis baristos prijuoste žvilgčioja į ją su telefonu rankoje.',
    'cafe.narration': () => 'Kavinė „Rozmarin“, 13:00.',
    'cafe.sign': () =>
      'Kavinės „Rozmarin“ Wi-Fi\nbe slaptažodžio\nKavinė niekada neprašo jūsų pašto prisijungimo vardo ir slaptažodžio.',
    'summary.morning': () => 'Įprasta diena prasideda',
    'summary.guest': () => 'Svečiams – svečių tinklas',
    'summary.cafe': () => 'Kavinėje – tinklas iš lentelės ir VPN',
    'summary.evening': () => 'Ekranas užrakintas, diena praėjo ramiai',
  },
  quizzes: {
    'guest-wifi': {
      question: 'Klientė susitikime prašo Wi-Fi. Ką jai duoti?',
      options: {
        office: 'Biuro tinklo slaptažodį: ji gi neilgam.',
        phone: 'Dalintis internetu iš savo darbo kompiuterio.',
        guest: 'Svečių tinklo kortelę.',
      },
      wrong: {
        office:
          'Biuro tinklo slaptažodis – raktas į bendrą kambarį su spausdintuvu, aplankais ir kameromis. Ir jis veikia, kol jo nepakeičia, net iš automobilių aikštelės.',
        phone:
          'Dalijimasis iš darbo kompiuterio įleidžia svetimą įrenginį į jūsų mašiną, o per ją – į darbo tinklą. Svečiams yra atskiras tinklas.',
      },
      explain:
        'Svečių tinklas duoda internetą ir nieko daugiau: biuro spausdintuvai, aplankai ir kompiuteriai lieka už stiklo. Todėl kortelę su jo pavadinimu galima duoti bet kuriam svečiui.',
    },
  },
  tasks: {
    lunch: {
      prompt:
        'Prisijunkite prie kavinės tinklo iš lentelės, įjunkite VPN ir išsiųskite pasiūlymą klientui.',
      goals: {
        'cafe-network': 'Telefonas kavinės tinkle iš lentelės',
        vpn: 'VPN įjungtas',
        sent: 'Pasiūlymas išsiųstas per VPN',
      },
      hints: [
        'Tinklo pavadinimas – ant lentelės ant staliuko. Dvynio pavadinimas panašus, o signalas stipresnis.',
        'Tikras kavinės tinklas prašo tik sutikti su taisyklėmis. VPN įjungia prieš atidarant paštą.',
        'Pasirinkite „Rozmarin-Guest“, spauskite „Sutinku“, įjunkite VPN, tada atidarykite „Paštą“ ir išsiųskite laišką. Reikiama vieta apvesta punktyru.',
      ],
      solvedNote:
        'Atlikta: pasiūlymas iškeliavo uždaru VPN vamzdžiu, o „barista“ prie gretimo staliuko nieko nematė.',
    },
    accounting: {
      prompt: 'Pažymėkite masalą ir tikrus laiškus, masale nieko nespausdami.',
      goals: {
        phish: 'Masalas pažymėtas „Sukčiavimas“',
        real: 'Tikri laiškai pažymėti „Tikras“',
      },
      hints: [
        'Paspauskite siuntėjo vardą, kad pamatytumėte adresą, ir užveskite ant nuorodos, kad pamatytumėte, kur ji veda.',
        'Dešinėje adreso dalyje turi būti romashka.example. romashka-pay.example – kitas savininkas.',
        '„Buhalterijos“ laiškas apie atlyginimą – „Sukčiavimas“, Olgos ir HR laiškai – „Tikras“. Reikiamas mygtukas apvestas punktyru.',
      ],
      solvedNote:
        'Atlikta: masalas iš romashka-pay.example pažymėtas, o tikri kolegų laiškai liko vietoje.',
    },
    'it-call': {
      prompt:
        'Programos nediekite: atsakykite pauze, patikrinkite pagal katalogą ir persiųskite susirašinėjimą IT.',
      goals: {
        pause: '„Irai“ išsiųstas atsakymas su pauze ir patikrinimu',
        verified: 'Paskambinta Irai numeriu iš katalogo',
        forwarded: 'Susirašinėjimas persiųstas tikrai Irai',
      },
      hints: [
        'Naujas numeris, skubus prašymas, skambinti „nereikia“ – pažįstamas svertų rinkinys.',
        'Skambinkite ne žinutėje nurodytu numeriu, o tuo, kuris kataloge. Tada persiųskite susirašinėjimą IT.',
        'Išsiųskite atsakymą „Ira, perskambinsiu tau darbo numeriu…“, paskambinkite Irai iš katalogo ir spauskite „Persiųsti IT“. Reikiama vieta apvesta punktyru.',
      ],
      solvedNote: 'Atlikta: programa neįdiegta, tikra Ira žino ir įspės kitus.',
    },
    extension: {
      prompt:
        'Atsisakykite plėtinio su visomis svetainėmis ir pašalinkite nereikalingą iš įdiegtų.',
      goals: {
        declined: 'Lentelių pagalbininkas su visomis svetainėmis neįdiegtas',
        cleaned: 'Senas kuponų plėtinys pašalintas',
      },
      hints: [
        'Skaitykite raudonas leidimų eilutes.',
        'Lentelėms nereikia visų svetainių ir to, ką kopijuojate. Kuponai įdiegti dėl vieno pirkinio.',
        'Super Sheets Helper – „Atšaukti“, „Kuponai ir nuolaidos 24/7“ – „Pašalinti“. Reikiamas mygtukas apvestas punktyru.',
      ],
      solvedNote: 'Atlikta: naršyklė negavo naujo šnipo ir atsikratė seno.',
    },
    assistant: {
      prompt:
        'Duokite asistentui prieigą be slaptažodžio pokalbyje ir atšaukite ją baigus darbą.',
      goals: {
        scoped: 'Asistentas dirba su raktu „tik skaityti“ vienam skyriui',
        revoked: 'Baigus darbą raktas atšauktas',
        clean: 'Pokalbyje nėra slaptažodžių ir raktų',
      },
      hints: [
        'Administratoriaus slaptažodžio į pokalbį nesiunčia. Prieigą asistentui suteikia CRM nustatymuose.',
        'Raktas: tik skaityti, skyrius „Klientai“, 7 dienos. Išsaugokite jį 1Password ir duokite asistentui nuorodą į įrašą.',
        'CRM sistemoje: „Tik skaityti“, varnelė tik prie „Klientai“, „7 dienos“ → „Sukurti raktą“ → „Išsaugoti slaptažodžių tvarkyklėje“. Asistento pokalbyje – „Duoti nuorodą į įrašą slaptažodžių tvarkyklėje“. Kai sąrašas parengtas, CRM sistemoje – „Atšaukti“. Reikiama vieta apvesta punktyru.',
      ],
      solvedNote:
        'Atlikta: asistentas surinko sąrašą per nuorodą į raktą, administratoriaus slaptažodis liko seife, o leidimas jau sudegė.',
    },
  },
} satisfies LessonTexts<typeof lesson>
