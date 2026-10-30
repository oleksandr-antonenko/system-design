import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'TCP/IP. Vokas voke',
  summary:
    'Pirmosios pamokos vokas iš tikrųjų yra keli vienas į kitą įdėti vokai: sluoksniai ir MAC addresses. Išnagrinėkite voko kelią sluoksnis po sluoksnio.',
  labels: {
    phone: { name: 'Phone', note: 'jūsų rankoje' },
    laptop: { name: 'Laptop', note: 'jame kuriate svetainę' },
    printer: { name: 'Printer', note: 'prijungtas kabeliu prie „Router“' },
    router: { name: 'Router', note: 'jūsų namų paštas' },
    internet: { name: 'Internet', note: 'routers grandinė iš 4 pamokos' },
    dns: { name: 'DNS server', note: 'tiekėjo informacijos tarnyba' },
    shop: { name: 'Parduotuvės svetainė', note: 'kažkur toli' },
  },
  steps: {
    'open-envelope': {
      title: 'Atidarykime voką',
      body: `Šešias pamokas po lentą skraidė vokas: pradžioje su vardais, paskui su IP address ir port. Iš tikrųjų tai keli vienas į kitą įdėti vokai, kaip matrioška; tinkluose tai vadinama encapsulation. Paspauskite „Paleisti“: vokas sustos prie [[router|„Router“]]. Tada spustelėkite patį voką — jis atsivers.

Kiekvienas įdėtas vokas turi savo darbą. Toks vokas vadinamas **sluoksniu** (layer). Sluoksnių yra keturi, kiekvienas turi anglišką vardą: Link — ryšys, Network — adresas, Transport — port ir Application — programa.`,
    },
    'four-layers': {
      title: 'Keturi sluoksniai',
      body: `Išardykime matriošką iš vidaus. Paspauskite „Paleisti“: vokas vėl sustos prie „Router“ ir atsivers.

- [[env:application|Application]] — pats prašymas: „atsiųskite puslapį“, voke tai HTTP. Jį parašo naršyklė.
- [[env:transport|Transport]] — buto numeris, port 443: svetainės programa serveryje. Tai 6 pamoka.
- [[env:internet|Network]] — IP address: nuo telefono iki svetainės. Tai 2 pamoka.
- [[env:link|Link]] — pats išorinis vokas, **frame** (lietuviškai – kadras, vokas vienai kelio atkarpai). Jis neša visa kita tik iki kaimyninio įrenginio: nuo telefono iki „Router“, per [[link:phone-router|Wi-Fi]].

Kiekvienas sluoksnis daro savo darbą ir nežiūri į svetimus vokus. Pavyzdžiui, router skaito tik IP address: į prašymą jis nežiūri.`,
    },
    mac: {
      title: 'MAC address: išorinis vokas keičiasi',
      body: `Ant frame ne IP address, o kiti adresai — **MAC address** (lietuviškai – MAC adresas). Tai gamyklinis tinklo plokštės numeris, kaip serijos numeris ant dėžutės. IP address išduoda router, ir jis gali pasikeisti, o MAC address lieka su įrenginiu. Dabar jis matomas kiekvieno įrenginio kortelėje.

Frame vežamas tik iki kaimyno. Paspauskite „Paleisti“, o per pauzę — „Žingsnis“: vokas pereis iš [[router|„Router“]] į [[internet|internetą]]. Router nusiims seną frame ir uždės naują: dabar tai Ethernet, frame [[link:router-internet|kabeliui]], ir ant jo nauji MAC addresses — nuo router iki kito kaimyno. Kaip siunta tarp sandėlių: adresas ant dėžutės tas pats, o važtaraštis kiekvienoje atkarpoje klijuojamas naujas.

Pastebėsite, kad pasikeitė ir siuntėjo IP address, ir port: router pasirašė ant voko visų namų adresu. Kodėl — 9 pamokoje. Mygtukas „Žingsnis atgal“ grąžins voką vienu hop atgal, „×¼“ sulėtins skrydį.`,
      more: {
        title:
          'Išsamiau: switch, MAC address paieška, adresų išdavimas ir septyni sluoksniai',
        body: `**Switch** (lietuviškai – komutatorius). Router gale yra keli lizdai kabeliams — tai įmontuotas switch. Jis žiūri tik į frame: įsimena, už kurio lizdo koks MAC address, ir perduoda voką į reikiamą lizdą. Kol nežino — perduoda į visus.

**Kaip sužinomas MAC address.** Telefonas žino „Router“ IP address, o frame reikia jo MAC address. Telefonas klausia visų namų: „Kas turi 192.168.1.1? Pasakykite MAC address.“ Atsako tik router, ir telefonas įsimena atsakymą. Tai vadinama **ARP**. Ką įsiminė nešiojamasis kompiuteris, rodo komanda arp -a — ji dabar yra terminale. O router rodo visus, kuriuos žino, savo skydelio kortelėje „Įrenginiai“: vardą, IP address ir MAC address.

**Adresų išdavimas žingsnis po žingsnio.** 2 pamokoje router išdavė telefonui IP address dviem vokais. Iš tikrųjų jų keturi: telefonas klausia visų „kas dalija adresus?“, router pasiūlo adresą, telefonas jo paprašo, router patvirtina ir kartu praneša informacijos tarnybos (DNS server) adresą. Tai vadinama DHCP.

**Septyni sluoksniai ar keturi.** Vadovėliuose dažnai piešiami septyni sluoksniai (OSI modelis). Mūsų keturi — TCP/IP modelis, ir jie ant septynių gula taip:

- Application — taikomasis sluoksnis (OSI tai sluoksniai 7, 6 ir 5);
- Transport — transportinis sluoksnis (4);
- Network — tinklo sluoksnis (3);
- Link — kanalinis sluoksnis (2) ir patys laidai bei radijas, fizinis sluoksnis (1).`,
      },
    },
    'which-layer': {
      title: 'Klausimas: kieno tai numeris',
      body: `Voke paryškintas laukas 443. Kuriam sluoksniui jis priklauso? Pasirinkite sluoksnį po voku.`,
    },
    pack: {
      title: 'Užduotis: surinkite voką',
      body: `Telefonas nori atidaryti [[shop|parduotuvės svetainę]]. Surinkite jam voką: įdėkite keturis sluoksnius vieną į kitą teisinga tvarka, nuo išorinio iki paties vidinio.

Kai surinksite, paspauskite „Siųsti“, ir vokas nuskris po lentą. Jei tvarka neteisinga, jo negalės perskaityti jau pirmas įrenginys kelyje.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Paspauskite „Paleisti“: [[laptop|nešiojamasis kompiuteris]] pirmą kartą atidaro parduotuvės svetainę, ir lentoje matyti visas puslapio kelias su visais vokais. Spalvos paaiškintos legendoje.

- Vokas — tai **sluoksniai**, įdėti vienas į kitą: Link, Network, Transport, Application. Kiekvienas turi savo darbą.
- Išorinis vokas, frame, neša iki kaimyno, ant jo — **MAC address**. Kiekviename hop jį pakeičia.
- Gavėjo IP address, port ir prašymas iki svetainės nukeliauja nepakitę.
- Gedimo ieškokite sluoksnis po sluoksnio, nuo Link iki Application: ar yra Wi-Fi ar kabelis? Ar yra IP address? Ar atviras port? Ar atsako programa?

1 modulis baigtas: jūs žinote, kaip veikia namų tinklas. Toliau — 2 modulis „Internetas“: default gateway (lietuviškai – šliuzas) ir traceroute, kaip namai išeina į internetą vienu adresu, savas domenas ir HTTPS.`,
    },
  },
  annotations: {},
  quizzes: {
    'which-layer': {
      question: 'Laukas 443 — koks tai sluoksnis?',
      options: {
        'env:link': 'Link · Wi-Fi arba Ethernet',
        'env:internet': 'Network · IP',
        'env:transport': 'Transport · TCP arba UDP',
        'env:application': 'Application · HTTP',
      },
      wrong: {
        'env:link':
          'Išoriniame voke, frame, tik MAC addresses: nuo ko ir kam perduoti iki kaimyninio įrenginio. Butų numerių ten nėra.',
        'env:internet':
          'Network sluoksnyje — IP address: kuris įrenginys. O 443 — butas jame, svetainės programa.',
        'env:application':
          'Application — pats prašymas: „atsiųskite puslapį“. O į kurį butą jį nunešti, sako Transport sluoksnis.',
      },
      explain:
        '443 — buto numeris, svetainės programos port serveryje. Butų numeriai — tai Transport sluoksnis: TCP arba UDP. Jūsų dev server iš 6 pamokos gyveno 5173 bute — tame pačiame sluoksnyje.',
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
        'Pradėkite iš išorės. Kokio voko reikia, kad viską perduotumėte kaimynui „Router“ per Wi-Fi?',
        'Išorėje — Link (Wi-Fi / Ethernet), po juo — Network (IP): router skaito tik šiuos du sluoksnius, kad išsiųstų voką toliau. Giliau — Transport (TCP), pačiame viduryje — prašymas (HTTP).',
        'Tvarka iš išorės į vidų: Wi-Fi / Ethernet, IP, TCP, HTTP.',
      ],
      solvedNote:
        'Išorėje Link, viduje Network, giliau Transport, viduryje prašymas. Kiekvienas įrenginys kelyje atidaro lygiai tiek sluoksnių, kiek jam reikia.',
    },
  },
  feedback: {
    GoalNotPerformed: ({ at }) =>
      at === 'shop'
        ? 'Parduotuvės svetainė gavo voką, bet nesuprato, kuriai programai jį atiduoti: buto numeris paslėptas giliau už prašymą. Transport (TCP) dedamas prieš Application (HTTP).'
        : 'Vokas dar nepasiekė interneto. Paspauskite „Siųsti“ ir pažiūrėkite lentoje, kur jis sustojo ir kodėl.',
  },
  askAi: {
    lead: 'Gedimą aprašykite sluoksnis po sluoksnio, nuo Link iki Application:',
    template:
      'Telefonas neatidaro mano dev server. Link: telefonas Wi-Fi tinkle Router-7C21. Network: telefono IP address 192.168.1.100, nešiojamojo kompiuterio 192.168.1.42, ping iš kompiuterio į telefoną praeina. Transport: adresu http://192.168.1.42:5173 telefonas gauna ERR_CONNECTION_REFUSED. Application: npm run dev rašo tik Local: http://localhost:5173/. Kas negerai?',
    note: 'Taip DI mato, kurie sluoksniai jau patikrinti ir kur ieškoti toliau.',
  },
} satisfies LessonTexts<typeof lesson>
