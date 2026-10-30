import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Prievadai: butai viename name',
  summary:
    'Viename kompiuteryje veikia daug programų, ir kiekviena turi savo numerį — prievadą. Atidarykite savo dev serverį telefone.',
  labels: {
    phone: { name: 'Telefonas', note: 'jūsų rankoje' },
    laptop: {
      name: 'Nešiojamasis kompiuteris',
      note: 'jame kuriate svetainę',
    },
    printer: { name: 'Spausdintuvas', note: 'kabeliu prie maršrutizatoriaus' },
    router: { name: 'Wi-Fi maršrutizatorius', note: 'jūsų namų paštas' },
    internet: { name: 'Internetas', note: 'daug tinklų' },
    dns: { name: 'Informacijos tarnyba', note: 'tiekėjo DNS serveris' },
    shop: { name: 'Parduotuvės svetainė', note: 'kažkur toli' },
  },
  steps: {
    apartments: {
      title: 'Butai name',
      body: `Adresas — namo numeris. Bet name daug butų, ir laiškanešiui reikia dar buto numerio. Su kompiuteriu taip pat: jame veikia daug programų, ir kiekvienai reikia savo vokų. Programos numeris vadinamas **prievadu** (port) — tai buto numeris.

[[shop|Parduotuvės serveryje]] svetainė gyvena 443 bute. Todėl ant telefono voko dabar du skaičiai, atskirti dvitaškiu: adresas ir prievadas — 198.51.100.10:443. Paspauskite „Paleisti“.`,
    },
    'dev-server': {
      title: 'Jūsų svetainė nešiojamajame kompiuteryje',
      body: `Jūs su DI kuriate savo svetainę. Kad pamatytumėte, kas išėjo, [[laptop|nešiojamojo kompiuterio]] terminale paleidžiama npm run dev. Pasileidžia dev serveris — programa, kuri rodo jūsų svetainę, kol ją kuriate. Jis užima 5173 butą ir parašo, kur ją atidaryti: http://localhost:5173.

**localhost** — vardas, kuris bet kuriame įrenginyje reiškia „aš pats“. Kaip prierašas „sau“ ant voko: toks vokas niekur neišeina. Nešiojamajame kompiuteryje localhost:5173 — tai paties kompiuterio 5173 butas. Paspauskite „Paleisti“: kompiuterio naršyklė atidarys svetainę.`,
    },
    'what-phone-sees': {
      title: 'Klausimas: ką parodys telefonas',
      body: `Dev serveris veikia nešiojamajame kompiuteryje ir rašo: Local: http://localhost:5173/. Tą patį adresą įvedate [[phone|telefono]] naršyklėje. Ką parodys telefonas? Pasirinkite ekraną.`,
    },
    door: {
      title: 'Durys atidarytos tik iš vidaus',
      body: `Vadinasi, telefonui reikia tikrojo kompiuterio adreso — 192.168.1.42, iš 2 pamokos. Bet ir adresu 192.168.1.42:5173 telefonas gaus atsisakymą. Paspauskite „Paleisti“.

Dev serveris pagal nutylėjimą atidaro duris tik iš vidaus: užeiti gali tik pats [[laptop|nešiojamasis kompiuteris]]. Tai saugumo sumetimais: kol kuriate svetainę, kaimynams Wi-Fi tinkle nėra ko jos matyti. Kad įleistumėte telefoną, serveris paleidžiamas su vėliavėle --host — „atidaryk duris visiems namų tinkle“.`,
      more: {
        title: 'Išsamiau: 127.0.0.1, 0.0.0.0 ir žinomi numeriai',
        body: `localhost turi adresą — 127.0.0.1. Jį matyti ip a išvestyje, eilutėje lo0: tai „kilpa“ įrenginio viduje, ja vokas niekur neišeina.

Kai serveris klauso 127.0.0.1, jis atidarytas tik iš vidaus. Vėliavėlė --host priverčia jį klausyti 0.0.0.0 — „visais kompiuterio adresais“, taip pat ir 192.168.1.42. Iš interneto jo vis tiek nesimato: namų adresai veikia tik namų viduje (9 pamoka).

Žinomi butų numeriai: 80 — svetainės be šifravimo (http), 443 — svetainės su šifravimu (https), 22 — nuotolinis prisijungimas (ssh), 5432 — PostgreSQL duomenų bazė. Dev serveriai mėgsta 3000, 5173 ir 8080.

Vokai būna dviejų rūšių. TCP — vokas su įteikimo patvirtinimu: gavėjas patvirtina, kad viskas atkeliavo. UDP — atvirukas be patvirtinimo: išsiuntėme ir nelaukiame. Svetainės naudoja TCP, klausimai informacijos tarnybai dažniausiai keliauja UDP.

Jei telefonas vis tiek neatidaro svetainės, nors serveris paleistas su --host, duris gali laikyti kompiuterio ugniasienė. Apie ją — 12 pamoka.

/24 po adreso ip a išvestyje — namų tinklo dydis. Apie jį — 8 pamoka.`,
      },
    },
    'phone-dev': {
      title: 'Užduotis: svetainė telefone',
      body: `Parodykite savo svetainę telefone. Dabar dev serveris atidarytas tik pačiam nešiojamajam kompiuteriui, ir telefonas gauna atsisakymą.

Kompiuterio terminale paleiskite serverį iš naujo taip, kad jis atidarytų duris namų tinklui. Serveris veikia terminale ir jį užima; sustabdyti serverį galima klavišais Ctrl+C. Tada telefono naršyklėje įveskite kompiuterio adresą su buto numeriu.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Jūsų svetainė atsidarė telefone. Paspauskite „Paleisti“: telefonas ją atidarys dar kartą.

- **Prievadas** — buto numeris: adresas veda į įrenginį, prievadas — į programą jame. Rašoma per dvitaškį: 192.168.1.42:5173.
- **localhost** — visada „aš pats“. Iš telefono localhost veda į telefoną, o ne į kompiuterį.
- Dev serveris pagal nutylėjimą įleidžia tik patį kompiuterį. Su --host jis atidaro duris namų tinklui, ir telefonas užeina kompiuterio adresu.

Toliau, 7 pamoka: po gaubtu. Vokas, kuris skraidė po lentą šešias pamokas, iš tikrųjų yra keli vienas į kitą įdėti vokai. Išsiaiškinsime, kam reikalingas kiekvienas.`,
    },
  },
  annotations: {
    door443: () => '443 butas: svetainė',
    devOpened: () => 'svetainė atsidarė kompiuteryje',
    phoneEmpty: () => 'telefone 5173 bute tuščia',
    onlyInside: () => '5173 atidarytas tik saviems',
    devOnPhone: () => 'jūsų svetainė telefone',
  },
  quizzes: {
    'phone-localhost': {
      question: 'Telefone įvedate http://localhost:5173. Ką jis parodys?',
      options: {
        page: 'Jūsų svetainė atsidarė',
        refused: 'Prisijungimas atmestas',
        'not-found': 'Svetainė nerasta',
        offline: 'Nėra interneto',
      },
      wrong: {
        page: 'Svetainė gyvena kompiuteryje, o localhost telefone reiškia patį telefoną. Telefonas beldžiasi į savo paties 5173 butą — o ten nieko nėra.',
        'not-found':
          'Vardą localhost telefonas žino be jokios informacijos tarnybos: jis visada reiškia „aš pats“. Adresą jis rado — tai jis pats. Klaida bus kita.',
        offline:
          'Wi-Fi telefonas turi, o internetas čia niekuo dėtas: vokas net neišeina iš telefono.',
      },
      explain:
        'localhost — visada „aš pats“. Telefone tai pats telefonas, o jo 5173 bute niekas negyvena. Telefonas beldžiasi — durys uždarytos. Tai ir yra ERR_CONNECTION_REFUSED: „prisijungimas atmestas“.',
    },
  },
  tasks: {
    'phone-dev': {
      prompt: 'Atidarykite savo dev serverį telefone.',
      goals: {
        listens: 'Serveris atidarytas namų tinklui',
        'phone-opens': 'Svetainė atsidarė telefone',
      },
      hints: [
        'Adresu localhost telefonas beldžiasi pats pas save. Jam reikia kompiuterio adreso. O serveriui — leidimo įleisti svečius iš namų tinklo.',
        'Sustabdykite serverį: Ctrl+C. Paleiskite iš naujo su vėliavėle: npm run dev -- --host. Du minusai viduryje svarbūs: taip vėliavėlė atiteks serveriui, o ne npm.',
        'Eilutėje Network serveris pats parašys adresą telefonui: http://192.168.1.42:5173. Įveskite jį telefono naršyklėje.',
      ],
      solvedNote:
        'Svetainė iš kompiuterio atsidarė telefone. Tai ir yra pagrindinis kurso pažadas: dabar žinote, kodėl localhost neveikia iš telefono ir ką su tuo daryti.',
    },
  },
  feedback: {
    GoalListeningOnWrongAddress: () =>
      'Serveris vis dar atidarytas tik pačiam kompiuteriui: eilutėje Network parašyta „use --host“. Paleiskite jį iš naujo su dviem minusais: npm run dev -- --host. Be jų npm pasilieka vėliavėlę sau, ir serveris jos negauna.',
    GoalNotListening: () =>
      'Dev serveris nepaleistas. Kompiuterio terminale paleiskite npm run dev -- --host.',
    GoalNotPerformed: () =>
      'Svetainė telefone dar neatsidarė. Telefono naršyklėje įveskite kompiuterio adresą su buto numeriu: 192.168.1.42:5173.',
    PortClosed: ({ device, port }) =>
      device === 'phone'
        ? 'Šis adresas veda į patį telefoną: localhost ir 192.168.1.100 — tai jis. Jo 5173 bute niekas negyvena. Reikia kompiuterio adreso — jis eilutėje Network arba ip a išvestyje.'
        : port === 80
          ? 'Be buto numerio naršyklė beldžiasi į 80 butą — ten nieko nėra. Pridėkite prievadą: :5173.'
          : `${port} bute niekas negyvena. Dev serveris — 5173 bute.`,
    ListensOnlyOnLoopback: () =>
      'Adresas teisingas, bet serverio durys kol kas atidarytos tik pačiam kompiuteriui. Paleiskite serverį iš naujo su --host.',
    TlsNotConfigured: () =>
      'Dev serveris veikia be šifravimo: adresas prasideda http://, o ne https://.',
  },
  askAi: {
    lead: 'Kai svetainė neatsidaro iš kito įrenginio, pridėkite serverio išvestį, adresus ir klaidos kodą:',
    template:
      'Nešiojamajame kompiuteryje paleidžiu npm run dev. Išvestis: Local: http://localhost:5173/, Network: use --host to expose. Kompiuterio adresas 192.168.1.42 (iš ip a). Telefone tame pačiame Wi-Fi atidarau http://192.168.1.42:5173 — ERR_CONNECTION_REFUSED. Ką pakeisti?',
    note: 'Iš eilutės Network ir klaidos kodo DI iš karto supras, kad serveris atidarytas tik pačiam kompiuteriui.',
  },
} satisfies LessonTexts<typeof lesson>
