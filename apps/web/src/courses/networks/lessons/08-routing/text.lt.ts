import type { LessonTexts } from '../../../../lesson/dsl'
import {
  PRINTER_IP,
  isHomeAddress,
  type default as lesson,
  networkPrefixOf,
} from './lesson'

export default {
  title: 'Routing ir gateway. Kaip vokas randa kelią',
  summary:
    'Viską, kas „ne mūsų namams“, įrenginys atiduoda gateway, o traceroute parodo, per kuriuos routers vokas keliauja toliau. Grąžinkite internetą kompiuteriui su svetimu gateway.',
  labels: {
    phone: { name: 'Phone', note: 'jūsų rankoje' },
    laptop: { name: 'Laptop', note: 'ant stalo' },
    printer: { name: 'Printer', note: 'prijungtas kabeliu prie „Router“' },
    router: { name: 'Router', note: 'jūsų namų paštas' },
    isp: { name: 'ISP router', note: 'į internetą' },
    core: { name: 'Core router', note: 'sankryža' },
    hosting: { name: 'Hosting router', note: 'svetainės tinklas' },
    dns: { name: 'DNS server', note: 'tiekėjo informacijos tarnyba' },
    shop: { name: 'Parduotuvės svetainė', note: 'kažkur toli' },
  },
  steps: {
    gateway: {
      title: 'Savi namai ir visa kita',
      body: `Nešiojamasis kompiuteris siunčia voką. Pirmiausia jis žiūri į IP address „kam“. Jei adresas prasideda 192.168.1., tai kaimynas namuose, pavyzdžiui, [[printer|spausdintuvas]]. Tada ant išorinio voko, frame, kompiuteris rašo spausdintuvo MAC address, o router tiesiog perduoda voką namuose. Jei adresas bet koks kitas, kompiuteris ant išorinio voko rašo paties [[router|router]] MAC address: „atiduoti gateway“.

**Gateway** (lietuviškai – šliuzas) – paštas, per kurį išeina viskas, kas „ne mūsų namams“. Namuose gateway – jūsų router, 192.168.1.1. Jį jau matėte telefono tinklo informacijoje: laukas „Router“ ir yra gateway. Kiekvienas įrenginys namuose turi žinoti šį adresą, kitaip jo vokai neišeis toliau namų.`,
    },
    'route-tables': {
      title: 'Kiekvienas paštas žino tik kitą žingsnį',
      body: `Router gavo voką [[shop|parduotuvės svetainei]], 198.51.100.10. Viso kelio jis nežino. Jis turi routing table – maršrutų lentelę: „kur – kam perduoti“. Joje tik dvi eilutės: adresai 192.168.1. – tiesiai į namus (connected), visa kita (default) – [[isp|ISP router]]. Lentelė – [[router|router]] kortelėje.

Interneto routers turi daugiau eilučių, bet taisyklė ta pati: rasti eilutę adresui „kam“ ir perduoti voką kitam. Kaip siuntinių rūšiavimo skyriuje: „į šiaurę – į šį maišą, į pietus – į tą, visa kita – į centrinį paštą“. Viso kelio nežino niekas, kiekvienas žino kitą žingsnį.

Paspauskite „Paleisti“: kiekviename sustojime atverta to router, prie kurio yra vokas, lentelė, ir paryškinta eilutė, pagal kurią jis voką išsiųs.`,
    },
    traceroute: {
      title: 'Visas kelias viena komanda',
      body: `Ant kiekvieno voko yra skaitiklis: per kiek dar paštų jam galima praeiti. Kiekvienas router sumažina jį vienetu. Jei skaitiklis pasiekė nulį, router išmeta voką ir siunčia siuntėjui trumpą atsakymą: „jūsų vokas baigėsi pas mane“. Taip pasiklydę vokai nesisuka tinkle amžinai.

**traceroute** (lietuviškai – maršruto sekimas) tuo naudojasi. Jis siunčia voką su skaitikliu 1 – atsako pirmasis paštas. Paskui su skaitikliu 2 – atsako antrasis, ir taip iki pačios svetainės. Lyg būtumėte išsiuntę kurjerius su skirtinga žingsnių atsarga, ir kiekvienas paskambino iš ten, kur žingsniai baigėsi. Kiekviena išvesties eilutė – vienas paštas: hop numeris, vardas, IP address ir trys laiko matavimai ms. Nešiojamojo kompiuterio terminale dabar yra ši komanda.`,
      more: {
        title: 'Išsamiau: subnet mask, TTL ir tylintys routers',
        body: `Kaip kompiuteris nusprendžia, kad adresas „savas“? Pagal subnet mask (lietuviškai – potinklio kaukė). ip a išvestyje ji parašyta po adreso: 192.168.1.42/24. /24 reiškia „pirmi trys skaičiai – tinklo numeris“: visa, kas prasideda 192.168.1., – namai. Nustatymuose ta pati kaukė atrodo kaip 255.255.255.0.

Skaitiklis voke vadinamas TTL (time to live, „gyvavimo laikas“). Kompiuteris nustato 64, kiekvienas router atima vienetą. Žvaigždutės – ne visada nutrūkimas: kai kurie routers neatsako traceroute, bet vokus praleidžia. Jei po žvaigždučių eilutės vėl atsiranda, kelias sveikas.

Windows sistemoje komanda vadinasi tracert. Be to, routing table būna daugiau nei dvi eilutės, pavyzdžiui, „10.0.0.0/8 – per biuro router“. Tokia eilutė vadinama static route (statinis maršrutas), ją sutiksite pamokoje apie VPN.`,
      },
    },
    'where-it-breaks': {
      title: 'Klausimas: kur nutrūksta',
      body: 'Parduotuvės svetainė nustojo atsidaryti. Kompiuteris paleido traceroute, išvestis – lentoje. Atsakė trys paštai, toliau tik žvaigždutės: „atsakymo nėra“. Paspauskite paskutinį paštą, iki kurio vokai dar nueina.',
    },
    'fix-gateway': {
      title: 'Užduotis: grąžinkite internetą kompiuteriui',
      body: `Kažkada nešiojamojo kompiuterio tinklo nustatymai buvo įrašyti rankiniu būdu, ir nuo tada jame neatsidaro svetainės. O spausdintuvas spausdina. Vadinasi, namuose vokai keliauja, o už jų ribų – ne.

Išsiaiškinkite kompiuterio terminale ir pataisykite nustatymus jo tinklo informacijoje: ji atsidaro taip pat, kaip telefone. Parduotuvės svetainė gyvena IP address 198.51.100.10, tai matyti jos kortelėje.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Kompiuterio vokas vėl išeina iš namų ir pasiekia parduotuvės svetainę paštas po pašto.

- Viską, kas skirta ne jūsų namams, įrenginys atiduoda **gateway**. Namuose gateway – router, 192.168.1.1. Jis įrašytas kiekvieno įrenginio nustatymuose, lauke „Router“.
- Routers perduoda voką pagal savo routing tables: kiekvienas žino tik kitą žingsnį.
- **traceroute** parodo paštus iš eilės. Nutrūkimas – iškart po paskutinės eilutės, kurioje kažkas atsakė. Jei atsakymo nėra jau pirmoje eilutėje, problema jūsų namuose, dažnai tai gateway.

Toliau, 9 pamoka: kodėl iš lauko negalima pasibelsti į jūsų namus ir kaip vis dėlto įleisti draugą į žaidimą.`,
    },
  },
  annotations: {
    gatewayTag: () => 'gateway 192.168.1.1',
  },
  quizzes: {
    'where-it-breaks': {
      question:
        'Kur nutrūksta kelias? Paspauskite paskutinį paštą, iki kurio vokai dar nueina.',
      wrong: {
        router:
          'Namų router atsakė pirmoje eilutėje, ir po jo vokai praėjo dar du paštus.',
        isp: 'ISP router atsakė antroje eilutėje. Vokai praėjo jį ir pasiekė kitą.',
        hosting:
          'Tai pirmasis paštas, kuris nutylėjo: 4 eilutė – žvaigždutės. Ieškome paskutinio, kuris atsakė: nutrūkimas iškart už jo.',
        shop: 'Vokai svetainės nepasiekė: adreso 198.51.100.10 išvestyje nėra.',
      },
      explain:
        'Paskutinis atsakė core router, core.isp.example. Vadinasi, iki jo vokai nueina, o toliau dingsta: nutrūkimas atkarpoje tarp jo ir hosting router. Jūsų namai ir jūsų router čia niekuo dėti.',
    },
  },
  tasks: {
    'fix-gateway': {
      prompt:
        'Grąžinkite kompiuteriui internetą: pataisykite jo tinklo nustatymus.',
      goals: {
        out: 'Kompiuterio vokai išeina iš namų: ping 198.51.100.10 praeina',
        site: 'Parduotuvės svetainė atsidaro kompiuteryje',
        printer: 'Spausdintuvas vis dar atsako',
      },
      hints: [
        'Spausdintuvas veikia, o internetas ne. Vadinasi, namuose viskas gerai, o vokai „ne mūsų namams“ nepasiekia gateway. Kam kompiuteris juos atiduoda?',
        'Paleiskite ping 192.168.1.1 – router atsako. Dabar traceroute 198.51.100.10 – pačioje pirmoje eilutėje pats kompiuteris ir !H („nepasiekiama“): neatsakė nė vienas paštas. Palyginkite lauką „Router“ kompiuterio tinklo informacijoje su jūsų router IP address.',
        'Tinklo informacijoje apibrėžtas laukas, kurį reikia pataisyti. Įrašykite ten savo router IP address iš lentos ir paspauskite „Išsaugoti“.',
      ],
      solvedNote:
        'Kompiuterio gateway vėl 192.168.1.1: vokai „ne mūsų namams“ išeina per router, ir svetainė atsidaro. Režimas „Automatiškai“ irgi tinka: tada router pats praneša gateway adresą.',
    },
  },
  feedback: {
    GatewayOutsideSubnet: ({ gateway }) =>
      `Gateway turi būti jūsų namuose, 192.168.1.kažkas. Iki ${gateway} kompiuteris pats nepasieks: ten vokus nešioja router.`,
    GatewayIsSelf: () =>
      'Kompiuteris atiduoda vokus pats sau. Gateway – tai router, o ne kompiuteris.',
    GatewayNotARouter: ({ gateway }) =>
      gateway === PRINTER_IP
        ? 'Spausdintuvas gavo voką 198.51.100.10 adresui ir išmetė: svetimų vokų jis toliau neperduoda. Gateway gali būti tik router.'
        : `Įrenginys adresu ${gateway} – ne router: svetimų vokų jis toliau neperduoda. Gateway gali būti tik router.`,
    GatewayUnreachable: ({ gateway }) =>
      isHomeAddress(gateway)
        ? `Gateway ${gateway} neatsako: tokio įrenginio namuose nėra. DNS čia niekuo dėtas: vokai iš namų visai neišeina.`
        : `Kompiuteris atsidūrė kitame tinkle: ${networkPrefixOf(gateway)}… Spausdintuvas ir router gyvena 192.168.1.…`,
    NoGateway: () =>
      'Kompiuteris neturi gateway: jis nežino, kam atiduoti vokus „ne mūsų namams“.',
  },
  askAi: {
    lead: 'Kai svetainės neatsidaro, o namuose viskas veikia, surinkite tris išvestis ir klauskite taip:',
    template: `Neatsidaro svetainės, o spausdintuvas namuose spausdina.
Sistema: macOS (arba Windows, Linux).

IP address ir gateway – ip route išvestis (Windows sistemoje ipconfig):
<įklijuokite išvestį>

Ar atsako router – ping -c 3 <gateway adresas> išvestis:
<įklijuokite išvestį>

Kelias iki svetainės – traceroute <svetainė> išvestis (Windows sistemoje tracert <svetainė>):
<įklijuokite išvestį>

Kurioje atkarpoje nutrūksta kelias ir ką man patikrinti?`,
  },
} satisfies LessonTexts<typeof lesson>
