import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'NAT ir port forwarding',
  summary:
    'Visi namai išeina į internetą vienu router adresu – tai NAT. Įleiskite draugą į žaidimą savo kompiuteryje per port forwarding.',
  labels: {
    phone: { name: 'Phone', note: 'jūsų rankoje' },
    laptop: { name: 'Laptop', note: 'ant stalo' },
    printer: { name: 'Printer', note: 'gretimame kambaryje' },
    pc: { name: 'PC', note: 'žaidimų kompiuteris: žaidimas ir duomenų bazė' },
    router: { name: 'Router', note: 'jūsų namų paštas' },
    internet: { name: 'Internet', note: 'daug tinklų' },
    dns: { name: 'DNS server', note: 'tiekėjo informacijos tarnyba' },
    shop: { name: 'Parduotuvės svetainė', note: 'shop.example' },
    'friend-router': { name: 'Router', note: 'draugo namų paštas' },
    friend: { name: 'Laptop', note: 'draugo' },
    'zone:friend-router': { name: 'Draugo namai' },
  },
  steps: {
    'home-only': {
      title: 'Namų adresai – tik namams',
      body: `Lentoje dabar yra ir jūsų draugo namai. Pažiūrėkite į jo [[friend|nešiojamojo kompiuterio]] IP address: 192.168.1.100. Lygiai toks pat yra jūsų [[phone|telefono]]. Tai ne klaida: adresus 192.168.… dalija kiekvienas namų router, ir milijonuose namų jie kartojasi. Todėl jie veikia tik savo namuose.

Paspauskite „Paleisti“: draugas siunčia voką adresu 192.168.1.42 – tai jūsų nešiojamojo kompiuterio adresas. Vokas net neišeina iš jo namų: draugo nešiojamajam kompiuteriui tai kaimyno jo paties namuose adresas, o tokio kaimyno ten nėra. Iš išorės jūsų namai matomi vienu adresu – jūsų [[router|router]] išoriniu adresu 203.0.113.7.`,
    },
    nat: {
      title: 'Router užrašo savo atgalinį adresą',
      body: `Kaip tada nešiojamasis kompiuteris atidaro svetaines? Paspauskite „Paleisti“. Vokas keliauja į [[shop|parduotuvės svetainę]] su kompiuterio atgaliniu adresu 192.168.1.42. Išeinant [[router|router]] jį išbraukia ir užrašo savo: 203.0.113.7. Buto numerį jis taip pat pakeičia laisvu ir užsirašo lentelėje: „šis butas – nešiojamasis kompiuteris“. Svetainė atsako router adresu, o router pagal lentelę nuneša atsakymą kompiuteriui. Vokas sustos prie router ir internete: palyginkite atgalinį adresą prieš ir po.

Tai ir yra **NAT** (lietuviškai – adresų transliavimas): paštas užrašo ant voko savo atgalinį adresą ir veda žurnalą, kas ką išsiuntė. Šis žurnalas – NAT table, jis atidarytas router kortelėje. Prisimenate 3 pamoką? Už router ant telefono voko jau buvo 203.0.113.7, o ne jo namų adresas. Štai kodėl.`,
    },
    'no-way-in': {
      title: 'Iš išorės be kvietimo neįeisi',
      body: `Jūsų [[pc|žaidimų kompiuteryje]] paleistas Minecraft server – programa, prie kurios jungiasi draugai, kad žaistų kartu. Jis laukia vokų 25565 bute. Draugas beldžiasi jūsų namų adresu: 203.0.113.7, port 25565. Paspauskite „Paleisti“. [[router|Router]] ieško eilutės lentelėje NAT table, o jos nėra: niekas namuose šio voko nelaukė. Router tyliai išmeta voką, o draugo žaidimas rašo „Connection timed out“.

Tai apsauga: be kvietimo iš išorės iki jūsų įrenginių neprisibelsi. Kad įleistumėte draugą, router nustatymuose įjungiamas **port forwarding** (lietuviškai – prievado peradresavimas) – taisyklė „viską, kas atėjo į mano port 25565, atiduoti žaidimų kompiuteriui į port 25565“. Kaip lentelė pašte: „siuntinius su žyma 25565 nešti žaidimų kompiuteriui“.`,
      more: {
        title: 'Plačiau: CGNAT, vakarėlis ir nereikalingos durys',
        body: `Kartais NAT prideda ir tiekėjas: vienas išorinis adresas daugeliui namų. Tai vadinama CGNAT. Tada router skydelyje išorinis adresas prasideda 100.64–100.127, o svetainės „koks mano IP“ rodo visai kitą. Port forwarding jūsų router nustatymuose tokiu atveju nepadės: draugo vokas įstrigs pas tiekėją. Išeitis – tunnel arba mesh VPN (13 ir 14 pamokos) arba atskiras „baltas“ adresas iš tiekėjo.

Router dalija adresus iš intervalo, paprastai nuo .100 iki .199. Jei jį sumažinsite iki dešimties adresų, vakarėlyje vienuoliktasis svečias negaus adreso ir liks be Wi-Fi. Priskirti adresai paprastai imami už šio intervalo ribų, kaip .50 užduotyje.

Bet kuri port forwarding taisyklė – atviros durys: robotai visą parą perrenka adresus ir beldžiasi į žinomus butus. Neperadresuokite „laikinai“ duomenų bazės, nuotolinio darbalaukio ir SSH. Funkcija UPnP leidžia žaidimams patiems atidaryti duris: patogu, bet tada duris atidaro ne tik žaidimas.`,
      },
    },
    'what-site-sees': {
      title: 'Klausimas: kokį adresą pamatys svetainė',
      body: 'Nešiojamasis kompiuteris atidaro [[shop|parduotuvės svetainę]]. Kokį atgalinį adresą svetainė pamatys ant voko? Pasirinkite vieną.',
    },
    'let-friend-in': {
      title: 'Užduotis: įleiskite draugą į žaidimą',
      body: `Atverkite draugui Minecraft server [[pc|žaidimų kompiuteryje]], ir tik jį: kompiuteryje dar veikia jūsų projekto duomenų bazė 5432 bute, ir iš išorės jos neturi būti matyti.

Pirmiausia priskirkite kompiuteriui adresą 192.168.1.50. Adresus suteikia router, ir po perkrovimo jis gali duoti kompiuteriui kitą – tada port forwarding ves į niekur. Po lenta atidarytas skydelis „Router“: kortelėje „Adresai“ priskiriamas adresas, kortelėje „Ports“ nustatomas port forwarding.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Draugas žaidime, o duomenų bazės iš išorės nematyti. Paspauskite „Paleisti“: draugas vėl prisijungs, ir router pagal port forwarding taisyklę atiduos jo voką žaidimų kompiuteriui.

- Adresai 192.168.… veikia tik namų viduje: kiekvieni namai turi savus.
- Išeinant router užrašo savo atgalinį adresą – tai **NAT**. Todėl svetainės mato router adresą, o ne nešiojamojo kompiuterio.
- Iš išorės į namus be kvietimo neįeisi. **Port forwarding** – kvietimas vienam įrenginiui ir tik į reikiamą port. To įrenginio adresas priskiriamas.
- Bet kuri port forwarding taisyklė – atviros durys. Atidarykite tik tai, ko reikia, ir ištrinkite taisyklę, kai jos nebereikia.

Toliau, 10 pamoka: kaip nukreipti savo domain į savo server ir kodėl draugas dar valandą mato seną svetainę.`,
    },
  },
  annotations: {
    sameAsFriend: () => 'toks pat ir pas draugą',
    sameAsPhone: () => 'toks pat kaip jūsų telefono',
    outside: () => 'iš išorės: 203.0.113.7',
    timedOut: () => 'Connection timed out',
    gameServer: () => 'Minecraft server laukia 25565',
    friendPlays: () => 'draugas žaidime',
  },
  quizzes: {
    'what-site-sees': {
      question:
        'Nešiojamasis kompiuteris atidaro parduotuvės svetainę. Kokį atgalinį adresą svetainė pamatys ant voko?',
      options: {
        '192.168.1.42': '192.168.1.42',
        '192.168.1.1': '192.168.1.1',
        '203.0.113.7': '203.0.113.7',
        '198.51.100.10': '198.51.100.10',
      },
      wrong: {
        '192.168.1.42':
          'Tai nešiojamojo kompiuterio adresas namų viduje. Išeinant router jį pakeitė savu: namų adresų internetu nevežioja.',
        '192.168.1.1':
          'Tai router adresas iš namų pusės, jūsų įrenginiams. Į internetą router žiūri kitu adresu.',
        '198.51.100.10':
          'Tai pačios svetainės adresas. Jis įrašytas laukelyje „kam“, o ne „nuo ko“.',
      },
      explain:
        'Svetainė mato 203.0.113.7 – router išorinį adresą. Visi namų įrenginiai išeina į internetą šiuo vienu adresu. Todėl svetainės „koks mano IP“ rodo router adresą, o ne nešiojamojo kompiuterio.',
    },
  },
  tasks: {
    'let-friend-in': {
      prompt: 'Atverkite draugui Minecraft server, ir tik jį.',
      goals: {
        'pc-address': 'Žaidimų kompiuteris turi pastovų adresą 192.168.1.50',
        'friend-in':
          'Draugas prisijungia prie žaidimo: 203.0.113.7, port 25565',
        'only-game':
          'Iš išorės atviras tik port 25565: duomenų bazės ir kitų nematyti',
      },
      hints: [
        'Draugas beldžiasi jūsų router adresu 203.0.113.7, port 25565. Router dar nežino, kam namuose atiduoti tokį voką, ir jį išmeta.',
        'Pirmiausia kortelėje „Adresai“ priskirkite žaidimų kompiuteriui adresą 192.168.1.50: sąraše „Priskirti adresai“ paspauskite „+ Pridėti“, pasirinkite „PC“ ir įrašykite adresą. Tada kortelėje „Ports“ pridėkite taisyklę: „Protocol“ TCP, „Outside port“ 25565, „IP address (namuose)“ 192.168.1.50, „Inside port“ 25565.',
        'Reikiamos vietos skydelyje apvestos punktyru: sąrašas „Priskirti adresai“ kortelėje „Adresai“ ir sąrašas „Port forwarding“ kortelėje „Ports“. Reikšmes įrašykite patys.',
      ],
      solvedNote:
        'Draugas žaidime, o duomenų bazės iš išorės nematyti. Kompiuterio adresas priskirtas: po perkrovimo port forwarding vis tiek veda į jį.',
    },
  },
  feedback: {
    GoalWrongAddress: ({ have, want }) =>
      `Žaidimų kompiuteris dabar turi ${have}: šį adresą router davė laikinai. Po perkrovimo jis gali pasikeisti, ir port forwarding ves į niekur. Kortelėje „Adresai“ priskirkite kompiuteriui ${want}.`,
    NatNoMapping: ({ port }) =>
      `Router nerado taisyklės TCP ${port} ir tyliai išmetė draugo voką. Žaidimas jungiasi per TCP į port ${port}: patikrinkite taisyklės „Protocol“ ir „Outside port“.`,
    ArpNoReply: ({ device, ip }) =>
      device === 'router'
        ? `Port forwarding veda į ${ip}, bet namuose niekas neatsiliepia šiuo adresu. Kortelėje „Adresai“ priskirkite jį žaidimų kompiuteriui.`
        : `Niekas neatsiliepė adresu ${ip}.`,
    PortClosed: ({ device, port }) =>
      device === 'laptop'
        ? `Vokas pasiekė nešiojamąjį kompiuterį, bet jame nėra Minecraft server: port ${port} uždarytas. Port forwarding turi vesti į žaidimų kompiuterį.`
        : `Vokas atkeliavo, bet ${port} bute niekas negyvena. Port forwarding turi vesti į žaidimų kompiuterį, į 25565 butą.`,
    GoalExtraOpenPort: ({ port }) =>
      port === 5432
        ? 'Iš išorės matyti port 5432 – tai projekto duomenų bazė. Ištrinkite šią taisyklę.'
        : `Iš išorės atviras port ${port}. Žaidimui reikia tik 25565.`,
    ReservationTaken: ({ ip }) =>
      `Adresas ${ip} jau priskirtas kitam įrenginiui. Imkite laisvą, pavyzdžiui, 192.168.1.50.`,
    ReservationOutsideSubnet: ({ ip }) =>
      `Adresas ${ip} ne iš jūsų namų: reikia 192.168.1.kažkas.`,
    ForwardOutsideLan: ({ ip }) =>
      `Port forwarding veda į ${ip}, o reikia adreso iš jūsų namų: 192.168.1.kažkas.`,
  },
  askAi: {
    lead: 'Jei port forwarding neveikia, DI padės greičiau, kai matys adresus ir visą taisyklę:',
    template: `Noriu, kad draugas prisijungtų prie žaidimo mano kompiuteryje (port 25565/TCP), bet jam rodo Connection timed out.

Router išorinis adresas (iš router skydelio, „Būsena“ arba „WAN“): <…>
Adresas, kurį rodo svetainė „koks mano IP“: <…>
Mano kompiuterio IP address namuose – ip a išvestis (Windows sistemoje – ipconfig):
<įklijuokite išvestį>

Port forwarding taisyklė: protocol …, outside port …, IP address …, inside port …
Kompiuterio adresas priskirtas router nustatymuose: taip / ne.

Ką tikrinti toliau? Jei router išorinis adresas ir „mano IP“ skiriasi, pasiūlyk būdą be port forwarding.`,
    note: 'Pagal išorinį adresą ir „mano IP“ DI iškart pamatys, ar nėra CGNAT, o pagal taisyklę – klaidą port ar adrese.',
  },
} satisfies LessonTexts<typeof lesson>
