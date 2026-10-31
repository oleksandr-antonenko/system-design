import { byProgress } from '../../../../kinds/scenario/dsl'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Wi-Fi. Bendras kambarys',
  summary:
    'Kas jūsų tinkle, tas jūsų kambaryje. Svečiams – svečių tinklas, svetimame tinkle – pirmiausia VPN.',
  preview: {
    alt: 'Schema: bendras Wi-Fi – vienas kambarys, kuriame svetimi įrenginiai mato srautą, svečiams skirtas savas tinklas, o darbo kompiuteris išeina per VPN.',
  },
  labels: {
    marina: { name: 'Marina' },
    oleg: { name: 'Olegas' },
    courier: { name: 'Kurjeris' },
    striped: { name: 'Dryžuotasis' },
    guest: { name: 'Viešnia' },
    client: { name: 'Klientė' },
    'vpn-profile': { name: 'Romashka' },
    contract: {
      name: 'Tiekimo sutartis',
      note: 'Laba diena! Siunčiu sutartį, lauksiu parašo iki penktadienio. Marina',
    },
    'contract:file': { name: 'Sutartis_Lastochka.pdf' },
    'net:AIRPORT-FREE': {
      name: 'Oro uosto Wi-Fi',
      note: 'Nemokamas internetas 2 valandoms. Spausdami „Sutinku“ sutinkate su tinklo naudojimo taisyklėmis.',
    },
    'net:AIRPORT-FREE-WiFi': {
      name: 'Free WiFi · prisijungimas',
      note: 'Kad gautumėte nemokamą internetą, prisijunkite su darbo paštu.',
    },
    'net:Lounge-Business': {
      name: 'Verslo salė',
      note: 'Tai verslo salės tinklas. Jo slaptažodį duoda salės registratūroje.',
    },
    'net:Galaxy A52': {
      name: 'Telefono dalijimasis',
      note: 'Tai kažkieno telefono dalijamas internetas. Slaptažodį žino tik jo savininkas.',
    },
  },
  steps: {
    office: {
      title: 'Wi-Fi – bendras kambarys',
      body: `Biuro Wi-Fi panašus į bendrą kambarį. Visi, kas jame, mato vieni kitus: kolegų nešiojamuosius, [[printer|spausdintuvą]], [[nas|bendrus aplankus]], [[cam|kameras]]. Daugelis šių įrenginių pasitiki bet kuriuo „savu“ ir slaptažodžio neklausia.

Perskaitėte? Spauskite „Toliau“: kitas kadras atsivers kartu su savo tekstu.`,
    },
    courier: {
      title: 'Kurjeris prašo slaptažodžio',
      body: `Wi-Fi slaptažodis – raktas nuo šio kambario. Kurjeriui „tik važtaraštį išsiųsti“, ir atsisakyti nepatogu: argi gaila?

Bet pasakėte slaptažodį – raktą dabar turi ir jis.`,
    },
    parking: {
      title: 'Po savaitės',
      body: 'Wi-Fi signalas pasiekia stovėjimo aikštelę, o slaptažodis veikia, kol jo nepakeičia. Paprastai tai trunka mėnesius. Kurjeris seniai išvažiavo, o raktas nuo kambario taip ir liko pas jį.',
    },
    'guest-network': {
      title: 'Svečiams – svečių tinklas',
      body: `Todėl svečiams daro atskirą kambarį – **svečių tinklą**. Iš jo yra internetas, bet nesimato nei spausdintuvo, nei aplankų, nei darbuotojų nešiojamųjų: tarp [[guest-net|svečių]] ir [[office-net|biuro]] tinklo yra siena.

Svečių tinklo slaptažodžio negaila: jį dažnai keičia ir spausdina kortelėje su QR kodu. Kurjeriui, klientui, rangovui, draugui valandai – svečių tinklas. Biuro tinklo slaptažodį žino tik darbuotojai, o kai kas nors išeina iš įmonės, IT jį pakeičia.`,
    },
    'client-wifi': {
      title: 'Klausimas: klientei reikia Wi-Fi',
      body: 'Į susitikimą atėjo klientė ir nori parodyti pristatymą iš savo nešiojamojo. Olegas žino biuro tinklo slaptažodį, ant registratūros stalo guli svečių tinklo kortelės, o tinklų sąraše matyti atviras „Free_WiFi“. Ką jai duoti?',
    },
    cafe: {
      title: 'Kavinė: kambarys su nepažįstamaisiais',
      body: `Kavinėje, viešbutyje ar oro uoste viskas atvirkščiai: dabar jūs – svečias svetimame kambaryje. Tame pačiame tinkle su jumis nepažįstami žmonės, o tinklo savininkas mato, kur keliauja jūsų vokai.

Dar blogiau – tinklą „Kavinė“ galėjo įjungti kaimynas prie gretimo staliuko: tinklo vardą sugalvoja bet kas.`,
    },
    vpn: {
      title: 'VPN – uždaras vamzdis',
      body: `**VPN** – uždaras vamzdis nuo jūsų nešiojamojo iki biuro. Vokai keliauja jo viduje, o kaimynas ir tinklo savininkas mato tik vamzdį.

Taisyklė: svetimame tinkle pirma VPN, tada darbo paštas, CRM ir bendri aplankai.`,
      more: {
        title: 'Daugiau: argi spyna naršyklėje neapsaugo?',
        body: `**Spyna adreso juostoje** (HTTPS) užšifruoja puslapio turinį: kaimynas kavinėje neperskaitys laiško teksto. Bet tinklo savininkas vis tiek mato, kokias svetaines lankote, gali pakišti netikrą prisijungimo puslapį, o dalis programų nešiojamajame jungiasi prie tinklo be šifravimo. VPN uždaro viską iš karto, o biuro sistemos dažnai atsidaro tik per jį.

**Tinklas antrininkas.** Tinklo vardą sugalvoja jo savininkas. Kaimynas gali telefone įjungti tinklą „Kavinė Rytas“ arba „AIRPORT-FREE-WiFi“, ir jūsų nešiojamasis pats prie jo prisijungs, jei kažkada buvo panašiu vardu tinkle. Todėl tinklą rinkitės pagal lentelę ir svetimiems tinklams išjunkite „jungtis automatiškai“.

**VPN neįsijungia?** Dalinkitės internetu iš telefono: tai jūsų nuosavas kambarys.`,
      },
    },
    airport: {
      title: 'Užduotis: oro uostas',
      body: `Iki įlaipinimo 20 minučių, o klientui reikia išsiųsti sutartį iš darbo pašto. Telefonas mato kelis tinklus.

Prisijunkite prie oro uosto tinklo – jo vardas [[sign|lentelėje]] prie kolonos, lentelę galima paspausti, – įjunkite VPN ir tik tada atidarykite paštą.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Perėjote visą istoriją: biurą, kurjerį, svečių tinklą, kavinę ir oro uostą.

- **Wi-Fi – bendras kambarys:** kas tinkle, tas mato spausdintuvą, aplankus ir nešiojamuosius.
- Biuro tinklo slaptažodis – tik darbuotojams. Svečiams, kurjeriams ir klientams – **svečių tinklas**.
- Svetimame tinkle: tinklas pagal lentelę, tada **VPN**, tada darbo reikalai.`,
    },
  },
  annotations: {
    'office.alt': () =>
      'Biuro pjūvis po dideliu mėtiniu Wi-Fi kupolu: Marinos ir Olego nešiojamieji, spausdintuvas, bendra saugykla ir kamera sujungti punktyru.',
    'office.narration': () =>
      '„Romashka“ biuras. Visi įrenginiai – po vienu Wi-Fi kupolu.',
    'office.oleg': () => 'Patogu: spausdinu iš telefono neatsistodamas.',
    'office.printer': () => 'spausdintuvas',
    'office.nas': () => 'bendri aplankai',
    'office.cam': () => 'kamera',
    'courier.alt': () =>
      'Dryžuotasis persirengęs kurjeriu: raudona kepurėlė, liemenė, iš po rankovių kyšo dryžiai. Jis tiesia telefoną per registratūros stalą. Marina abejoja, ant monitoriaus geltonas lipnus lapelis.',
    'courier.narration': () => 'Rytas. Prie registratūros kurjeris.',
    'courier.courier': () =>
      'Gal galima Wi-Fi slaptažodį? Man tik važtaraštį išsiųsti.',
    'courier.marina': () => 'Na… argi gaila?',
    'parking.alt': () =>
      'Vakaras. Wi-Fi kupolas išeina už biuro sienų į stovėjimo aikštelę. Dryžuotasis sėdi automobilyje prie įėjimo su nešiojamuoju ir meškere traukia iš biuro aplanką ir spausdintuvo lapą.',
    'parking.narration': () => 'Po savaitės. Stovėjimo aikštelė prie biuro.',
    'parking.striped': () =>
      'Slaptažodžio niekas taip ir nepakeitė. Kas šiandien bendruose aplankuose?',
    'guest.alt': () =>
      'Du kupolai: didelis mėtinis virš darbo vietų ir mažas persikinis virš sofos prie registratūros. Tarp jų stiklinė siena su spyna. Marina duoda viešniai kortelę su QR kodu.',
    'guest.narration': () => 'Tas pats biuras, dabar su svečių tinklu.',
    'guest.officeNet': () => 'biuro tinklas',
    'guest.guestNet': () => 'svečių tinklas',
    'guest.marina': () => 'Štai svečių Wi-Fi: nukreipkite kamerą į kodą.',
    'guest.guest': () => 'Veikia, ačiū!',
    'meeting.alt': () =>
      'Posėdžių kambarys. Klientė turkio spalvos palte kelia telefoną su Wi-Fi ženkleliu. Olegas su užrašų knygele ir puodeliu galvoja, ką atsakyti.',
    'meeting.narration': () =>
      'Posėdžių kambarys. Klientė atėjo su pristatymu.',
    'meeting.client': () =>
      'Ar galiu prisijungti prie jūsų Wi-Fi? Noriu parodyti pristatymą.',
    'cafe.alt': () =>
      'Kavinė po bendru pilku Wi-Fi kupolu. Nuo Marinos nešiojamojo prie maršrutizatoriaus ant baro skrenda permatomi vokai. Prie gretimo staliuko Dryžuotasis su prijuoste ir kišeniniu maršrutizatoriumi apžiūri juos pro didinamąjį stiklą.',
    'cafe.narration': () =>
      'Pietūs kavinėje. Vienas tinklas visiems lankytojams.',
    'cafe.striped': () => 'Taip taip. Paštas, CRM, bendri aplankai…',
    'vpn.alt': () =>
      'Ta pati kavinė. Nuo Marinos nešiojamojo per sieną iki tolimo biuro eina storas mėlynas vamzdis su kniedėmis. Dryžuotasis prikiša didinamąjį stiklą prie vamzdžio, nieko nemato ir kasosi pakaušį.',
    'vpn.narration': () => 'Ta pati kavinė. Marina įjungė VPN.',
    'vpn.striped': () => 'Kažkoks vamzdis. Nieko nesimato!',
    'vpn.marina': () => 'Dabar galima ir paštą.',
    'airport.alt': () =>
      'Oro uosto laukimo salė. Marina su telefonu, aplink kelių Wi-Fi tinklų ženkleliai. Prie kolonos mėlyna lentelė. Priešais Dryžuotasis su panama ir tamsiais akiniais, ant lagamino kišeninis maršrutizatorius.',
    'airport.narration': () => 'Oro uostas. Iki įlaipinimo 20 minučių.',
    'airport.sign': () =>
      'Oro uosto Wi-Fi\nbe slaptažodžio\nOro uostas niekada neprašo jūsų pašto ar socialinių tinklų prisijungimo ir slaptažodžio.',
    'airport.marina': doc =>
      byProgress(doc, {
        start: 'Ar spėsiu išsiųsti klientui sutartį?',
        twin: 'Keista: oro uosto tinklas prašo pašto slaptažodžio?',
        leaked: 'Oi. Atrodo, tinklas buvo ne tas.',
        online: 'Tinklas kaip lentelėje. Dabar VPN.',
        vpn: 'VPN įjungtas – dabar paštas.',
        sent: 'Sutartis išsiųsta. Galima į lėktuvą!',
      }),
    'airport.striped': doc =>
      byProgress(doc, {
        start: 'Mano Wi-Fi signalas geriausias.',
        twin: 'Sveiki atvykę į „nemokamą“ Wi-Fi!',
        leaked: 'Pašto slaptažodis? Ačiū!',
        online: 'Ech, ne į mano tinklą…',
        vpn: 'Vėl tas vamzdis.',
        sent: 'Vėl tas vamzdis.',
      }),
    'summary.parking': () => 'Slaptažodis veikia ir iš aikštelės',
    'summary.guest': () => 'Svečiams – svečių tinklas',
    'summary.cafe': () => 'Kavinėje esate svetimame kambaryje',
    'summary.vpn': () => 'VPN – uždaras vamzdis',
  },
  quizzes: {
    'client-wifi': {
      question: 'Klientei reikia Wi-Fi. Ką jai duoti?',
      options: {
        'office-password':
          'Biuro tinklo slaptažodį: tai klientė, o ne kurjeris iš gatvės.',
        'guest-card': 'Svečių tinklo kortelę su QR kodu.',
        'open-network':
          'Parodyti atvirą „Free_WiFi“ iš sąrašo: slaptažodžio nereikia.',
      },
      wrong: {
        'office-password':
          'Klientas – irgi svečias. Su biuro tinklo slaptažodžiu jos nešiojamasis atsidurs tame pačiame kambaryje su jūsų aplankais ir spausdintuvu, o slaptažodis išeis kartu su ja.',
        'open-network':
          'Kieno tai tinklas – nežinia. Atvirą tinklą bet kokiu vardu gali įjungti bet kas šalia, o viską, kas per jį eina, mato jo savininkas.',
      },
      explain:
        'Svečių tinklas duoda klientei internetą ir nieko daugiau: biuro įrenginių iš jo nesimato, o slaptažodžio kortelėje negaila.',
    },
  },
  tasks: {
    airport: {
      prompt:
        'Išsiųskite sutartį iš darbo pašto, nepakišdami savęs svetimame tinkle.',
      goals: {
        'on-sign-network': 'Telefonas tinkle iš lentelės',
        'vpn-on': 'VPN įjungtas',
        sent: 'Sutartis išsiųsta per VPN',
      },
      hints: [
        'Palyginkite tinklų vardus su lentele prie kolonos: paspauskite ją kadre. Svarbi kiekviena raidė ir brūkšnelis.',
        'Oro uosto tinklas atviras, be spynos. Tinklas su stipriausiu signalu nebūtinai tikras: antrininkas sėdi šalia, todėl ir pagauna geriau.',
        'Prisijunkite prie AIRPORT-FREE ir sutikite su taisyklėmis, pagrindiniame ekrane įjunkite VPN, tada atidarykite „Paštą“ ir išsiųskite sutartį. Reikiama vieta apvesta punktyru.',
      ],
      solvedNote:
        'Atlikta: tikras oro uosto tinklas, VPN iki biuro, sutartis pas klientą.',
    },
  },
} satisfies LessonTexts<typeof lesson>
