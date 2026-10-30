import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Po gaubtu: vokas voke',
  summary:
    'Pirmosios pamokos vokas iš tikrųjų yra keli vienas į kitą įdėti vokai: layers ir MAC addresses. Išnagrinėkite voko kelią pagal layers.',
  labels: {
    phone: { name: 'Phone', note: 'jūsų rankoje' },
    laptop: { name: 'Laptop', note: 'jame kuriate svetainę' },
    printer: { name: 'Printer', note: 'kabeliu prijungtas prie router' },
    router: { name: 'Wi-Fi router', note: 'jūsų namų paštas' },
    internet: {
      name: 'Internet',
      note: 'už debesies — routers grandinė iš 4 pamokos',
    },
    dns: { name: 'DNS server', note: 'tiekėjo informacijos tarnyba' },
    shop: { name: 'Parduotuvės svetainė', note: 'kažkur toli' },
  },
  steps: {
    'open-envelope': {
      title: 'Atidarykime voką',
      body: `Šešias pamokas po lentą skraidė vokas — tinkluose jis vadinamas packet. Pradžioje ant jo buvo vardai, paskui IP addresses ir ports. Iš tikrųjų tai keli vienas į kitą įdėti vokai, kaip matrioška; tinkluose tai vadinama encapsulation. Paspauskite „Paleisti“: vokas sustos prie [[router|router]]. Tada spustelėkite patį voką — jis atsivers.

Kiekvienas įdėtas vokas turi savo darbą. Toks vokas vadinamas **layer** (lietuviškai — sluoksnis). Jų yra keturi: ryšys, adresas, port ir programa.`,
    },
    'four-layers': {
      title: 'Keturi įdėti vokai',
      body: `Išardykime matriošką iš vidaus. Paspauskite „Paleisti“: vokas vėl sustos prie router ir atsivers.

- [[env:application|HTTP]] — programa, pats prašymas: „atsiųskite puslapį“. Jį parašo naršyklė.
- [[env:transport|TCP]] — port, buto numeris: 443, svetainės programa serveryje. Tai 6 pamoka.
- [[env:internet|IP]] — adresas: nuo telefono iki svetainės. Tai 2 pamoka.
- [[env:link|Frame]] (lietuviškai — kadras, išorinis vokas vienai kelio atkarpai) — ryšys. Jis neša visa kita tik iki kaimyninio įrenginio: nuo telefono iki router, per [[link:phone-router|Wi-Fi]].

Kiekvienas layer daro savo darbą ir nežiūri į svetimus vokus. Pavyzdžiui, router skaito tik IP: į prašymą jis nežiūri.`,
    },
    mac: {
      title: 'MAC address: išorinis vokas keičiasi',
      body: `Ant frame ne IP, o kiti adresai — **MAC address** (lietuviškai — MAC adresas). Tai gamyklinis tinklo plokštės numeris, kaip serijos numeris ant dėžutės. IP address išduoda router, ir jis gali pasikeisti, o MAC address lieka su įrenginiu. Dabar jis matomas kiekvieno įrenginio kortelėje.

Frame vežamas tik iki kaimyno. Paspauskite „Paleisti“, o per pauzę — „Žingsnis“: vokas pereis iš [[router|router]] į [[internet|internetą]]. Router nusiims seną frame ir uždės naują: dabar tai Ethernet, frame [[link:router-internet|kabeliui]], ir ant jo nauji MAC addresses — nuo router iki kito kaimyno. Kaip siunta tarp sandėlių: adresas ant dėžutės tas pats, o važtaraštis kiekvienoje atkarpoje klijuojamas naujas.

Pastebėsite, kad pasikeitė ir siuntėjo IP address, ir port: router pasirašė ant voko visų namų adresu. Kodėl — 9 pamokoje. Mygtukas „Žingsnis atgal“ grąžins voką vienu šuoliu atgal, „×¼“ sulėtins skrydį.`,
      more: {
        title:
          'Išsamiau: switch, MAC address paieška, adresų išdavimas ir septyni layers',
        body: `**Switch** (lietuviškai — komutatorius). Router gale yra keli lizdai kabeliams — tai įmontuotas switch. Jis žiūri tik į frame: įsimena, už kurio lizdo koks MAC address, ir perduoda voką į reikiamą lizdą. Kol nežino — perduoda į visus.

**Kaip sužinomas MAC address.** Telefonas žino, kad router IP address yra 192.168.1.1, o frame reikia jo MAC address. Telefonas klausia visų namų: „Kas turi 192.168.1.1? Pasakykite MAC address.“ Atsako tik router, ir telefonas įsimena atsakymą. Tai vadinama ARP. Ką įsiminė nešiojamasis kompiuteris, rodo komanda arp -a — ji dabar yra terminale. O router rodo visus, kuriuos žino, savo skydelio kortelėje „Įrenginiai“: vardą, IP address ir MAC address.

**Adresų išdavimas žingsnis po žingsnio.** 2 pamokoje router išdavė telefonui IP address dviem vokais. Iš tikrųjų jų keturi: telefonas klausia visų „kas dalija adresus?“, router pasiūlo adresą, telefonas jo paprašo, router patvirtina ir kartu praneša DNS server adresą. Tai vadinama DHCP.

**Septyni layers ar keturi.** Vadovėliuose dažnai piešiami septyni layers (OSI modelis). Mūsų keturi — TCP/IP modelis, ir jie ant septynių gula taip:

- HTTP — application layer, taikomasis (OSI tai layers 7, 6 ir 5);
- TCP — transport layer, transportinis (4);
- IP — network layer, tinklo (3);
- frame — data link layer, kanalinis (2), o patys laidai ir radijas — physical layer, fizinis (1).`,
      },
    },
    'which-layer': {
      title: 'Klausimas: kieno tai numeris',
      body: `Voke paryškintas laukas 443. Kuriam layer jis priklauso? Pasirinkite atsakymą po voku.`,
    },
    pack: {
      title: 'Užduotis: surinkite voką',
      body: `Telefonas nori atidaryti [[shop|parduotuvės svetainę]]. Surinkite jam voką: įdėkite keturis layers vieną į kitą teisinga tvarka, nuo išorinio iki paties vidinio.

Kai surinksite, paspauskite „Siųsti“, ir vokas nuskris po lentą. Jei tvarka neteisinga, jo negalės perskaityti jau pirmas įrenginys kelyje.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Paspauskite „Paleisti“: [[laptop|nešiojamasis kompiuteris]] pirmą kartą atidaro parduotuvės svetainę, ir lentoje matyti visas puslapio kelias su visais vokais. Spalvos paaiškintos legendoje.

- Vokas — tai **layers**, įdėti vienas į kitą: frame, IP, TCP, HTTP. Kiekvienas turi savo darbą.
- Išorinis frame neša iki kaimyno, ant jo — **MAC address**. Kiekviename šuolyje jį pakeičia.
- Gavėjo IP address, port ir prašymas iki svetainės nukeliauja nepakitę.
- Gedimo ieškokite iš eilės, iš išorės į vidų: ar yra Wi-Fi ar kabelis? Ar yra IP address? Ar atviras port? Ar atsako programa?

1 modulis baigtas: jūs žinote, kaip veikia namų tinklas. Toliau — 2 modulis „Internetas“: gateway (lietuviškai — šliuzas) ir traceroute, kaip namai išeina į internetą vienu adresu, savas domenas ir HTTPS.`,
    },
  },
  annotations: {},
  quizzes: {
    'which-layer': {
      question: 'Laukas 443 — iš kurio layer?',
      options: {
        'env:link': 'Frame · Wi-Fi arba Ethernet',
        'env:internet': 'IP · adresas',
        'env:transport': 'TCP arba UDP · port',
        'env:application': 'HTTP · programa',
      },
      wrong: {
        'env:link':
          'Frame yra tik MAC addresses: nuo ko ir kam perduoti iki kaimyninio įrenginio. Butų numerių ten nėra.',
        'env:internet':
          'IP yra IP address: kuris įrenginys. O 443 — butas jame, svetainės programa.',
        'env:application':
          'HTTP — pats prašymas: „atsiųskite puslapį“. O į kurį butą jį nunešti, sako port, esantis TCP.',
      },
      explain:
        '443 — port, buto numeris: svetainės programa serveryje. Ports gyvena TCP arba UDP. Jūsų dev server iš 6 pamokos gyveno 5173 bute — tame pačiame layer.',
    },
  },
  tasks: {
    pack: {
      prompt: 'Surinkite voką, kuris nukeliaus iki parduotuvės svetainės.',
      goals: {
        'router-reads': 'Router perskaitė IP address ir perdavė voką toliau',
        'shop-gets': 'Parduotuvės svetainė gavo prašymą ir atsakė',
      },
      hints: [
        'Pradėkite iš išorės. Kokio voko reikia, kad viską perduotumėte kaimynui, router, per Wi-Fi?',
        'Išorėje — frame (Wi-Fi / Ethernet), po juo — IP: router skaito tik šiuos du, kad išsiųstų voką toliau. Giliau — TCP su port, pačiame viduryje — prašymas.',
        'Tvarka iš išorės į vidų: Wi-Fi / Ethernet, IP, TCP, HTTP.',
      ],
      solvedNote:
        'Išorėje frame, viduje IP, giliau TCP su port, viduryje prašymas. Kiekvienas įrenginys kelyje atidaro lygiai tiek layers, kiek jam reikia.',
    },
  },
  feedback: {
    GoalNotPerformed: ({ at }) =>
      at === 'shop'
        ? 'Parduotuvės svetainė gavo voką, bet nesuprato, kuriai programai jį atiduoti: buto numeris paslėptas giliau už prašymą. TCP su port dedamas prieš HTTP.'
        : 'Vokas dar nepasiekė interneto. Paspauskite „Siųsti“ ir pažiūrėkite lentoje, kur jis sustojo ir kodėl.',
  },
  askAi: {
    lead: 'Gedimą aprašykite iš eilės, nuo išorinio layer iki vidinio:',
    template:
      'Telefonas neatidaro mano dev server. Wi-Fi: telefonas tinkle Router-7C21. IP address: telefono 192.168.1.100, nešiojamojo kompiuterio 192.168.1.42, ping iš kompiuterio į telefoną praeina. Port: adresu http://192.168.1.42:5173 telefonas gauna ERR_CONNECTION_REFUSED. Programa: npm run dev rašo tik Local: http://localhost:5173/. Kas negerai?',
    note: 'Taip DI mato, kurie layers jau patikrinti ir kur ieškoti toliau.',
  },
} satisfies LessonTexts<typeof lesson>
