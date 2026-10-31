import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Access token. Atskiras leidimas DI',
  summary:
    'Pokalbis su DI – ne seifas: asistentui išduodamas atskiras leidimas. Raktas, leidžiantis tik skaityti, vietoj slaptažodžio pokalbyje – ir atšaukimas po darbo.',
  preview: {
    alt: 'Iliustracija: pokalbis su DI nešiojamajame kompiuteryje, šalia žalias leidimas ant virvelės – asistento access token, o pagrindinis raktas lieka seife.',
  },
  labels: {
    marina: { name: 'Marina' },
    oleg: { name: 'Olegas' },
    assistant: { name: 'DI asistentas' },
    crm: { name: 'Romashka CRM' },
    'assistant:intro': {
      name: 'Labas! Parengsiu spalio pardavimų ataskaitą. Man reikia prieigos prie CRM: atsiųskite administratoriaus prisijungimo vardą ir slaptažodį – taip greičiausia.',
    },
    'assistant:say-password': {
      name: 'Prisijungimo vardas: admin\nSlaptažodis: ••••••••••••',
    },
    'assistant:say-token': { name: 'Štai raktas: crm_tok_••••••••••••3f9a' },
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
      name: 'Atlikta: eksportavau 248 spalio sandorius į lentelę „Pardavimai – spalis“. Prieigos man nebereikia – raktą galima atšaukti.',
    },
    'section:sales': { name: 'Pardavimai' },
    'section:clients': { name: 'Klientai' },
    'section:invoices': { name: 'Sąskaitos' },
    'section:staff': { name: 'Darbuotojai' },
  },
  steps: {
    'not-a-vault': {
      title: 'Pokalbis – ne seifas',
      body: `DI asistentai – Claude, ChatGPT, Codex – moka dirbti su CRM, lentelėmis ir kodu, ir jiems vis dažniau reikia prieigos prie darbo sistemų.

Tačiau pokalbis su asistentu – ne seifas. Įklijuotas slaptažodis lieka pokalbio istorijoje, jį mato paskyros administratoriai, jis patenka į žurnalus ir atsargines kopijas. O administratoriaus slaptažodis atrakina viską iš karto.`,
    },
    'own-pass': {
      title: 'Atskiras leidimas',
      body: `Asistentui duodamas atskiras leidimas – **prieigos raktas** (access token): raktas, skirtas tik šiam darbui. Jis turi savas **prieigos teises** (permissions): ką galima (tik skaityti), kur (viename skyriuje) ir kiek laiko (savaitę).

Patį raktą laiko slaptažodžių tvarkyklėje, o asistentui duoda ne tekstą, o nuorodą į įrašą: **op://Work/crm-agent/token**. Komanda **op run** perduos raktą programai, ir į pokalbį jis nepateks.`,
    },
    leak: {
      title: 'Klausimas: kur nutekėjimas',
      body: 'Olegas per dieną nusiuntė asistentui tris žinutes. Vienoje iš jų nuteka paslaptis. Kurioje?',
    },
    friday: {
      title: 'Leidimas nebegalioja',
      body: `Darbas atliktas – leidimas atšaukiamas nelaukiant penktadienio. Savaitės terminas – tik apsauga tam atvejui, jei pamirštumėte.

Atšauktas raktas nieko neatrakina, o jūsų slaptažodis lieka jums: jo nereikia nei keisti, nei kam nors sakyti.`,
      more: {
        title: 'Daugiau: nustatymai, kodas ir ekrano nuotraukos',
        body: `**Darbo prenumerata ir nustatymai.** Darbui naudokite darbinę asistento paskyrą ir patikrinkite nustatymą „nenaudoti mano duomenų mokymui“. Klientų dokumentai ir asmens duomenys į asmeninę paskyrą neįkeliami.

**Agentai kode** (Codex, Claude Code ir kiti). Paslaptys laikomos faile **.env**, o šis failas įrašytas į **.gitignore**. Agentui neduodama prieigos prie **~/.ssh** ir naršyklės slaptažodžių. Komandos, kurias agentas nori vykdyti, perskaitomos prieš patvirtinant.

**Ekrano nuotraukos.** Paslaptis ekrano nuotraukoje – ta pati paslaptis pokalbyje: prieš siųsdami patikrinkite, ar joje nesimato rakto, slaptažodžio ar QR kodo.`,
      },
    },
    'crm-token': {
      title: 'Užduotis: prieiga asistentui',
      body: `Marina prašo asistento parengti pardavimų ataskaitą, o jis prašo CRM administratoriaus slaptažodžio.

Duokite asistentui atskirą leidimą: CRM sistemoje sukurkite raktą, leidžiantį 7 dienas tik skaityti skyrių „Pardavimai“, išsaugokite jį slaptažodžių tvarkyklėje ir duokite asistentui nuorodą į įrašą. Kai darbas bus atliktas, atšaukite raktą.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Olegas įklijavo slaptažodį į pokalbį, o Marina išdavė asistentui leidimą – ir po darbo jį atsiėmė.

- Pokalbis su DI – ne seifas: slaptažodžių ir raktų į jį neklijuoja.
- **Prieigos raktas** su siauromis **prieigos teisėmis**: tik skaityti, vienas skyrius, trumpas terminas.
- Raktas – slaptažodžių tvarkyklėje, asistentui – nuoroda į įrašą; po darbo raktas atšaukiamas.`,
    },
  },
  annotations: {
    'dictate.alt': () =>
      'Olegas rodo draugiškam robotui asistentui lapelį su slaptažodžiu; lapelis nuskrenda į aukštą pokalbio archyvo spintą su šimtais tokių pat lapelių.',
    'dictate.narration': () => 'Olegas prašo asistento parengti ataskaitą.',
    'dictate.oleg': () => 'Štai administratoriaus slaptažodis – susitvarkysi?',
    'pass.alt': () =>
      'Marina užkabina robotui asistentui ant kaklo svečio leidimą su spynele „tik skaityti“ ir kalendoriuku iki penktadienio.',
    'pass.narration': () => 'Marina elgiasi kitaip.',
    'pass.marina': () =>
      'Štai tavo leidimas: tik skaityti, tik pardavimai, iki penktadienio.',
    'pass.robot': () => 'Priimta! Daugiau man ir nereikia.',
    'three.alt': () =>
      'Olegas prie nešiojamojo kompiuterio, virš jo trys debesėliai su žinutėmis asistentui: lentelė, raktas seife ir nustatymų failas.',
    'three.narration': () => 'Trys Olego žinutės per dieną.',
    'friday.alt': () =>
      'Penktadienis. Svečio leidimas ant roboto kaklo subyra kibirkštimis, robotas mojuoja ranka. Marina patenkinta linkteli.',
    'friday.narration': () => 'Ataskaita parengta. Leidimo nebereikia.',
    'friday.robot': () => 'Ačiū! Leidimą galima atsiimti.',
    'summary.dictate': () => 'Pokalbis su DI – ne seifas',
    'summary.pass': () => 'Asistentui – atskiras leidimas',
    'summary.three': () => 'Paslaptis faile – irgi nutekėjimas',
    'summary.friday': () => 'Darbas atliktas – raktas atšauktas',
  },
  quizzes: {
    leak: {
      question: 'Kurioje iš trijų žinučių asistentui nuteka paslaptis?',
      options: {
        export:
          '„Štai spalio pardavimų eksportas, klientų vardus pašalinau. Nubraižyk grafiką“.',
        reference:
          '„Raktas saugomas 1Password seife: op://Work/crm-agent/token. Paleisk per op run“.',
        env: '„Nepavyksta prisijungti prie CRM, štai visas mano .env failas – pažiūrėk, kas negerai“.',
      },
      wrong: {
        export:
          'Eksportas be klientų vardų – įprasti darbo duomenys: paslapčių jame nėra.',
        reference:
          'Tai nuoroda į įrašą slaptažodžių tvarkyklėje, o ne pats raktas. Pagal ją raktą gaus tik programa, paleista per op run jūsų kompiuteryje.',
      },
      explain:
        'Faile **.env** laikomos paslaptys: prieigos raktai, duomenų bazių slaptažodžiai, paslaugų raktai. Nusiųsti jį visą – tas pats, kas įklijuoti visus tuos slaptažodžius į pokalbį. Asistentui rodoma klaida, o ne paslaptys; jei failas jau išsiųstas, jame esantys raktai keičiami.',
    },
  },
  tasks: {
    'crm-token': {
      prompt:
        'Duokite asistentui prieigą prie pardavimų be administratoriaus slaptažodžio, o po darbo ją atsiimkite.',
      goals: {
        scoped:
          'Asistentas dirba su raktu: tik skaityti, tik „Pardavimai“, ne ilgiau kaip 7 dienas',
        revoked: 'Po darbo raktas atšauktas',
        clean:
          'Prieiga suteikta be paslapčių pokalbyje; jei slaptažodis ten pateko – jis pakeistas',
      },
      hints: [
        'Administratoriaus slaptažodžio į pokalbį neklijuoja. Atidarykite skirtuką „CRM“: ten kuriamas atskiras raktas asistentui.',
        'Rakto forma iš pradžių duoda viską: visą prieigą, visus skyrius, neterminuotai. Susiaurinkite ją iki skaitymo, vieno skyriaus ir 7 dienų. Asistentui duokite nuorodą į įrašą slaptažodžių tvarkyklėje – tam raktą pirmiausia išsaugo.',
        'CRM sistemoje: „Tik skaityti“, varnelė tik prie „Pardavimai“, „7 dienos“ → „Sukurti raktą“ → „Išsaugoti slaptažodžių tvarkyklėje“. Asistento pokalbyje – „Duoti nuorodą į įrašą slaptažodžių tvarkyklėje“. Kai ataskaita parengta, CRM sistemoje – „Atšaukti“. Reikiama vieta apvesta punktyru.',
      ],
      solvedNote:
        'Atlikta: ataskaita parengta, asistentas matė tik pardavimus ir tik savaitę, o dabar jo leidimas atšauktas. Administratoriaus slaptažodis taip ir liko CRM sistemoje.',
    },
  },
} satisfies LessonTexts<typeof lesson>
