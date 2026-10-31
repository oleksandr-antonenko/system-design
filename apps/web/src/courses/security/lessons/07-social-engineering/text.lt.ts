import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Social engineering. Skambutis „iš IT“',
  summary:
    'Apgaudinėja žmones, o ne kompiuterius: pauzė ir patikrinimas kitu kanalu. „Direktorius“ iš naujo numerio prašo skubiai apmokėti sąskaitą.',
  preview: {
    alt: 'Iliustracija: social engineering – skambina nežinomas numeris, o ranka kelia stalinį telefoną, kad perskambintų žinomu numeriu.',
  },
  labels: {
    marina: { name: 'Marina' },
    striped: { name: 'Dryžuotasis' },
    victor: { name: 'Viktoras' },
    'victor-mask': { name: '„Viktoras“' },
    'chat:new-victor': {
      name: 'Viktoras Andrejevičius',
      note: '+370 600 41 977 · naujas numeris',
    },
    'chat:new-victor:body': {
      name: `Marina, laba diena. Čia mano naujas numeris, senasis nebeveikia.

Skubiai reikia apmokėti sąskaitą už stendą parodoje Vilniuje – 4 800 €, rekvizitai nauji, tuoj atsiųsiu. Reikia suspėti iki 15:00, kitaip stendą atiduos.

Aš derybose, skambinti nereikia. Tiesiog parašykite, kai apmokėsite.`,
    },
    'chat:new-victor:call': {
      name: '„Marina, juk prašiau neskambinti! Aš susitikime. Prašom apmokėti, vėliau viską paaiškinsiu“. Balsas panašus – bet suklastoti balsą dabar nesunku.',
    },
    'chat:new-victor:forwarded': {
      name: 'Ačiū, kad persiuntėte! Tai sukčius: numerį blokuoju ir perspėsiu visus bendrame pokalbyje.',
    },
    'reply:new-victor:pay': {
      name: 'Gerai, tuoj apmokėsiu.',
      note: 'Puiku! Kai tik apmokėsite, atsiųskite mokėjimo pavedimo nuotrauką.',
    },
    'reply:new-victor:pause': {
      name: 'Viktorai Andrejevičiau, perskambinsiu jums numeriu iš žinyno ir tada apmokėsiu.',
      note: 'Nereikia skambinti, aš juk susitikime! Reikalas skubus!',
    },
    'chat:ira': { name: 'Ira · IT', note: 'IT administratorė' },
    'chat:ira:body': {
      name: 'Kolegos, primenu: keisti laiškai, skambučiai ir žinutės – iškart man. Geriau kartą per daug.',
    },
    'chat:oleg': { name: 'Olegas', note: 'pardavimų skyrius' },
    'chat:oleg:body': { name: 'Marina, einam kavos trečią?' },
    'contact:victor': { name: 'Viktoras Andrejevičius', note: 'direktorius' },
    'contact:ira': { name: 'Ira', note: 'IT administratorė' },
    'call:victor': {
      name: '„Marina? Kokia sąskaita? Aš nieko nerašiau, mano numeris tas pats. Persiųskite tai Irai“.',
    },
    'call:ira': {
      name: '„Taip, klausau! Kažkas įtartino? Persiųskite man, išsiaiškinsime“.',
    },
  },
  steps: {
    'fake-ira': {
      title: 'Skambutis „iš IT“',
      body: `Apgauti žmogų lengviau nei įsilaužti į kompiuterį. **Socialinė inžinerija** (social engineering) – kai sukčius nelaužia apsaugos, o įkalba jus ją atverti: įdiegti programą, pasakyti kodą, apmokėti sąskaitą.

Svertai beveik visada tie patys: **skubu**, **vadovas** ir **padėkite**.`,
    },
    door: {
      title: 'Prilaikykite duris',
      body: `Tas pats triukas veikia ir be telefono: žmogus su [[boxes|dėžėmis]] prašo prilaikyti duris, „naujokas“ pamiršo praėjimo kortelę. Padėti norisi – taip mus išauklėjo.

Mandagiai atsisakyti – normalu: „Leiskite, pakviesiu tą, pas kurį atėjote“.`,
    },
    which: {
      title: 'Klausimas: kur socialinė inžinerija',
      body: 'Per dieną Marina gavo tris prašymus. Vienas iš jų – socialinė inžinerija. Kuris?',
    },
    'new-account': {
      title: 'Naujas „direktoriaus“ numeris',
      body: `Penktadienis, po pietų. „Viktoras“ rašo žinutę iš naujo numerio: nuotrauka kaip tikra, vardas kaip tikras.

Nuotrauką nukopijuoti lengva – ji yra įmonės svetainėje. O „naujas numeris“, „skubu“ ir „neskambinkite“ – tas pats svertų rinkinys.`,
    },
    'second-channel': {
      title: 'Pauzė ir antrasis kanalas',
      body: `Taisyklė: **pauzė ir patikrinimas antruoju kanalu** (out-of-band verification). Neatsakykite „taip“ tame pačiame pokalbyje ir neskambinkite numeriu iš žinutės: ten atsilieps tas pats žmogus.

Skambinkite numeriu, kurį žinote patys (iš žinyno), arba paklauskite asmeniškai. Įtartinas žinutes persiųskite IT: tokia žinutė atėjo ne tik jums.`,
      more: {
        title: 'Daugiau: balsas, vaizdo skambutis ir kodinis žodis',
        body: `**Balsas ir vaizdas klastojami.** Užtenka kelių minučių įrašo, kad programa prabiltų direktoriaus balsu, o vaizdo skambutyje parodytų jo veidą. Todėl tikrina ne balsą, o kanalą: skambina numeriu iš žinyno.

**Kodinis žodis mokėjimams.** Daug įmonių susitaria: skubus mokėjimas, kurio prašoma „iš viršaus“, patvirtinamas kodiniu žodžiu arba antro žmogaus. Paklauskite vadovo, ar jūsų įmonėje yra tokia taisyklė.

**Turniketas ir praėjimo kortelė.** Praleisti nepažįstamąjį „minutėlei“ – tas pats, kas duoti jam raktą. Jei žmogus laukia kolegos, pakvieskite kolegą.`,
      },
    },
    messenger: {
      title: 'Užduotis: žinutė nuo „direktoriaus“',
      body: `Jūsų eilė. Marinai iš naujo numerio rašo „Viktoras Andrejevičius“ ir skubina apmokėti sąskaitą.

Atsakykite mandagiai ir nemokėkite, patikrinkite prašymą paskambinę numeriu iš žinyno ir persiųskite pokalbį Irai iš IT.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Dryžuotasis skambino „iš IT“, prašė prilaikyti duris ir rašė „nuo direktoriaus“. Marina kaskart stabtelėdavo.

- **Socialinė inžinerija** naudoja tris svertus: skubu, vadovas, padėkite.
- **Pauzė ir antrasis kanalas:** patikrinkite prašymą paskambinę numeriu iš žinyno, o ne iš žinutės.
- Mandagiai atsisakyti – normalu. Įtartinas žinutes persiųskite IT.`,
    },
  },
  annotations: {
    'fakeIra.alt': () =>
      'Dryžuotasis su violetiniu peruku ir ausinėmis apsimeta Ira iš IT ir skambina Marinai; iš po džemperio kyšo dryžiai. Marina su rageliu rankoje abejoja.',
    'fakeIra.narration': () => 'Rytas. Skambina „Ira iš IT“.',
    'fakeIra.striped': () =>
      'Marina, čia Ira. Jūsų kompiuteryje virusas! Įdiekite nuotolinės prieigos programą, aš viską išvalysiu.',
    'fakeIra.marina': () =>
      'Balsas nepanašus… Ir Ira visada rašo darbo pokalbyje.',
    'door.alt': () =>
      'Dryžuotasis, apsirengęs kurjeriu, su krūva dėžių stovi prie biuro durų su kortelių skaitytuvu. Marina artėja su praėjimo kortele rankoje.',
    'door.narration': () => 'Įėjimas į biurą. Žmogus su dėžėmis.',
    'door.striped': () => 'Prilaikykite, prašom, duris – rankos užimtos!',
    'requests.alt': () =>
      'Marina prie darbo stalo; virš jos trys debesėliai – telefono skambutis, žinutė pokalbyje ir pasitarimas.',
    'requests.narration': () => 'Trys prašymai per vieną dieną.',
    'newAccount.alt': () =>
      'Iš Marinos telefono ekrano žvilgčioja Dryžuotasis su kartonine Viktoro kauke ant pagaliuko; šalia – profilio paveikslėlis su tikra Viktoro nuotrauka.',
    'newAccount.narration': () =>
      'Penktadienis, 14:10. Žinutė iš naujo numerio.',
    'newAccount.victor': () =>
      'Marina, čia mano naujas numeris. Skubiai apmokėkite sąskaitą, aš susitikime – neskambinkite.',
    'check.alt': () =>
      'Kairėje Marina skambina darbo telefonu, šalia atverstas įmonės žinynas. Dešinėje tikrasis Viktoras derybose nustebęs atsiliepia.',
    'check.narration': () => 'Marina skambina Viktorui numeriu iš žinyno.',
    'check.marina': () =>
      'Viktorai Andrejevičiau, ar prašėte apmokėti sąskaitą?',
    'check.victor': () =>
      'Kokią sąskaitą? Aš nieko nerašiau. Persiųskite tai Irai!',
    'summary.fakeIra': () => '„Ira“ prašo įdiegti programą',
    'summary.door': () => 'Mandagiai atsisakyti – normalu',
    'summary.newAccount': () => 'Naujas numeris, skubu, „neskambinkite“',
    'summary.check': () => 'Patikrinimas numeriu iš žinyno',
  },
  quizzes: {
    which: {
      question: 'Kuris iš trijų prašymų – socialinė inžinerija?',
      options: {
        'bank-call':
          '„Banko saugumo tarnyba“ skambina ir prašo pasakyti kodą iš SMS, kad „atšauktų įtartiną pervedimą“.',
        'ira-chat':
          'Ira rašo darbo pokalbyje: „Šeštadienį atnaujiname paštą, nieko daryti nereikia“.',
        'victor-meeting':
          'Viktoras pasitarime prašo iki penktadienio parengti pardavimų ataskaitą.',
      },
      wrong: {
        'ira-chat':
          'Ira nieko neprašo: nei kodo, nei pinigų, nei skubos. Ir rašo ji darbo pokalbyje, kurį jūs žinote.',
        'victor-meeting':
          'Įprastas darbo prašymas, išsakytas asmeniškai pasitarime: nieko slapto ir jokios skubos.',
      },
      explain:
        'Skambutis „iš banko“ naudoja visus svertus iš karto: skuba („pervedimas jau vyksta“), autoritetas („saugumo tarnyba“) ir pagalba („leiskite, aš jį atšauksiu“). Bankas niekada neprašo kodo iš SMS. Padėkite ragelį ir perskambinkite numeriu, nurodytu ant kortelės.',
    },
  },
  tasks: {
    messenger: {
      prompt:
        'Neapmokėkite sąskaitos vien pagal žinutę: padarykite pauzę, patikrinkite prašymą antruoju kanalu ir praneškite IT.',
      goals: {
        pause: '„Viktorui“ atsakyta mandagiai ir be apmokėjimo',
        verified: 'Prašymas patikrintas paskambinus numeriu iš žinyno',
        forwarded: 'Pokalbis persiųstas Irai iš IT',
      },
      hints: [
        'Pirmiausia atsakymas: pasirinkite tą, kuris daro pauzę, o ne sutinka. Mandagiai atsisakyti – normalu.',
        'Numeris iš žinutės patikrinimui netinka: ten atsilieps tas pats žmogus. Atidarykite skirtuką „Žinynas“ – ten numeris, kurį žinote patys.',
        'Pokalbyje „Viktoras Andrejevičius“ atsakykite „…perskambinsiu jums numeriu iš žinyno…“, skirtuke „Žinynas“ paskambinkite Viktorui Andrejevičiui, grįžkite į pokalbį ir paspauskite „Persiųsti IT“. Reikiama vieta apvesta punktyru.',
      ],
      solvedNote:
        'Atlikta: pinigai vietoje, tikrasis Viktoras nieko nerašė, o Ira užblokavo numerį ir perspėjo kitus.',
    },
  },
} satisfies LessonTexts<typeof lesson>
