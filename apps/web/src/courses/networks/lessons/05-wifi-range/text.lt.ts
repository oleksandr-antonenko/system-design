import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Kodėl Wi-Fi silpnai veikia',
  summary:
    'Nuotolis, sienos ir dvi dažnių juostos: 2.4 ir 5 GHz. Nustatykite Wi-Fi taip, kad jis pasiektų virtuvę.',
  labels: {
    router: { name: 'Router', note: 'stovi kambaryje' },
    phone: { name: 'Phone', note: 'jūsų rankoje' },
    laptop: { name: 'Laptop', note: 'ant stalo kambaryje' },
    printer: {
      name: 'Printer',
      note: 'prijungtas kabeliu, Wi-Fi nereikia',
    },
    bulb: {
      name: 'Smart bulb',
      note: 'išmanioji lemputė virtuvėje: supranta tik 2.4 GHz',
    },
    'zone:room': { name: 'Kambarys' },
    'zone:hall': { name: 'Koridorius' },
    'zone:kitchen': { name: 'Virtuvė' },
  },
  steps: {
    'floor-plan': {
      title: 'Vaizdas iš viršaus',
      body: `Pažiūrėkime į butą iš viršaus, kaip į planą. [[router|„Router“]] stovi kambaryje. Apskritimas aplink jį rodo, kiek toli siekia Wi-Fi: apskritimo viduje ryšys yra, už jo krašto – nėra.

Wi-Fi – tai radijas. Kuo toliau nuo „Router“, tuo tylesnis jo „balsas“. Kaip pokalbis: tame pačiame kambaryje girdisi gerai, iš kito buto galo – prastai. Paspauskite „Paleisti“: [[phone|telefonas]] nueis iš kambario į [[zone:kitchen|virtuvę]].`,
    },
    walls: {
      title: 'Sienos slopina',
      body: `Signalas silpsta ne tik dėl atstumo, bet ir dėl sienų. Pro vieną sieną jis praeina, bet tyliau. Pro dvi ar tris sienas, plytas, veidrodinę spintą ar akvariumą gali visai nepraeiti. Todėl apskritimas plane nelygus: už sienų jis susitraukia.

Tarp „Router“ ir virtuvės yra dvi sienos. Pažiūrėkite, kiek mažai brūkšnelių turi [[phone|telefonas]] virtuvėje.`,
    },
    'two-bands': {
      title: 'Dvi dažnių juostos',
      body: `Namų Wi-Fi turi dvi dažnių juostas (band): **2.4 GHz** ir **5 GHz** (gigahercai; lietuviškai rašytume 2,4 ir 5 GHz). Router kalba abiem iš karto, kaip radijo stotis dviem bangomis.

5 GHz greitesnė: filmai ir dideli failai įkeliami greičiau. Bet ji prasčiau prasiskverbia pro sienas ir siekia arčiau. 2.4 GHz lėtesnė, užtat siekia toliau. Prisimenate, kaip pro sieną girdisi kaimyno kolonėlės bosai, o aukšti garsai – ne? Su Wi-Fi panašiai: 2.4 GHz – tai bosai.

Paprastai router įjungia abi juostas, o telefonas renkasi pats: arti – 5 GHz, toliau – 2.4 GHz. Paspauskite „Paleisti“.`,
      more: {
        title:
          'Plačiau: kaimynai, kanalai, slaptažodis ir kur pastatyti router',
        body: `Kodėl vakare Wi-Fi lėtesnis? 2.4 GHz juosta padalyta į kanalus (channel), kaip radijas į stotis. Jei kaimyno router kalba tuo pačiu ar gretimu kanalu, jie trukdo vienas kitam, kaip du pokalbiai viename kambaryje. Kanalai 1, 6 ir 11 vienas kitam netrukdo, todėl router paprastai renkasi vieną iš jų. 5 GHz juostoje kanalų daugiau, ir kaimynai trukdo rečiau.

Wi-Fi slaptažodis veikia per WPA2 apsaugą arba naujesnę WPA3. Jei visi jūsų įrenginiai moka WPA3, rinkitės ją. O šio kurso slaptažodis 12345678 atspėjamas per kelias sekundes: tikram tinklui sugalvokite ilgą.

Svečių tinklas – atskiras tinklas su kitu slaptažodžiu. Svečiai gauna internetą, bet nemato jūsų spausdintuvo ir kompiuterio.

Kur pastatyti router: aukščiau ir arčiau buto vidurio, ne spintoje ir ne už veidrodžio. Jei butas didelis, pastato antrą **access point** (lietuviškai – prieigos taškas) arba mesh sistemą: keli įrenginiai dirba kaip vienas tinklas.`,
      },
    },
    'who-drops': {
      title: 'Klausimas: kas liks be tinklo',
      body: 'Kažkas „Router“ nustatymuose įjungė tik 5 GHz: „taip greičiau“. Telefonas guli virtuvėje. Kuris įrenginys negalės prisijungti prie Wi-Fi? Paspauskite jį lentoje.',
    },
    'kitchen-wifi': {
      title: 'Užduotis: Wi-Fi virtuvėje',
      body: `Dabar pataisykime. Virtuvėje telefonas be tinklo. Ten pat nupirko išmaniąją [[bulb|lemputę]]. Ją jau nustatė per programėlę: tinklo pavadinimą ir slaptažodį ji žino. Bet rašo „Tinklas nerastas“: tokios lemputės supranta tik 2.4 GHz.

Po lenta atsivėrė „Router“ skydelis – jo nustatymai. Jame kol kas viena kortelė, „Wi-Fi“. Nustatykite tinklą taip, kad virtuvėje ryšį gautų ir telefonas, ir lemputė. Tinklas turi likti su slaptažodžiu.`,
    },
    summary: {
      title: 'Santrauka',
      body: `- Wi-Fi – tai radijas. Signalas silpsta dėl atstumo ir už kiekvienos sienos.
- Router turi dvi dažnių juostas. **5 GHz** greitesnė, bet siekia arčiau. **2.4 GHz** lėtesnė, užtat siekia toliau ir praeina pro sienas.
- Įjunkite abi: įrenginiai pasirinks patys. O kai kurie išmanieji įrenginiai supranta tik 2.4 GHz.

Toliau, 6 pamoka „Ports: butai viename name“. Paleisime nešiojamame kompiuteryje savo svetainę ir atidarysime ją telefonu.`,
    },
  },
  annotations: {
    behindWalls: () => 'iki „Router“ – dvi sienos',
    onBand24: () => 'virtuvėje – 2.4 GHz',
    bulbOn: () => 'šviečia',
  },
  quizzes: {
    'who-drops': {
      question:
        '„Router“ nustatymuose įjungta tik 5 GHz. Kuris įrenginys negalės prisijungti prie Wi-Fi?',
      explain:
        'Telefonas virtuvėje, už dviejų sienų. 5 GHz ten nesiekia, o 2.4 GHz išjungta. Todėl įjungia abi juostas: arti esantys įrenginiai paims greitą 5 GHz, o tolimi – 2.4 GHz.',
      wrong: {
        laptop:
          'Nešiojamas kompiuteris kambaryje, šalia „Router“: 5 GHz jį pasiekia. Jis prisijungs, ir ryšys bus greitas.',
        printer:
          'Spausdintuvas prijungtas kabeliu. Wi-Fi jam nereikia, ir dažnių juostos jo neliečia.',
      },
      tags: {
        laptop: 'arti, 5 GHz siekia',
        printer: 'kabeliu',
        phone: '5 GHz nesiekia',
      },
    },
  },
  tasks: {
    'kitchen-wifi': {
      prompt: 'Padarykite taip, kad virtuvėje ryšį gautų telefonas ir lemputė.',
      goals: {
        phone: 'Telefonas virtuvėje prisijungęs prie Wi-Fi',
        bulb: 'Lemputė prisijungusi prie Wi-Fi',
        password: 'Tinklas vis dar su slaptažodžiu',
      },
      hints: [
        'Pažiūrėkite į žiedus: kuri juosta pasiekia virtuvę? O kurią supranta lemputė?',
        'Virtuvę pasiekia tik 2.4 GHz, ir lemputė supranta tik ją. Įjunkite 2.4 GHz, bet 5 GHz neišjunkite: tegul kompiuteriui šalia „Router“ būna greita.',
        'Kortelėje „Wi-Fi“ pasirinkite „2.4 ir 5 GHz“ ir paspauskite „Išsaugoti“. SSID ir slaptažodžio nekeiskite.',
      ],
      solvedNote:
        'Dabar virtuvę pasiekia 2.4 GHz: telefonas ir lemputė tinkle. Kompiuteris kambaryje liko greitoje 5 GHz juostoje.',
    },
  },
  feedback: {
    OutOfRange: '5 GHz nepasiekia virtuvės.',
    BandUnsupported: 'Lemputė supranta tik 2.4 GHz, o ji išjungta.',
    GoalWifiTooWeak: 'Tinklas atviras visiems. Grąžinkite „Su slaptažodžiu“.',
    WrongSsid:
      'Telefonas, kompiuteris ir lemputė prisimena tinklą „Router-7C21“. Tinklas su nauju SSID jiems svetimas: visus tektų jungti iš naujo. Grąžinkite seną SSID.',
    WrongPassword:
      'Visi įrenginiai prisimena slaptažodį 12345678, su nauju jie neprisijungs. Grąžinkite seną slaptažodį – arba naują tektų vesti kiekviename įrenginyje.',
    WifiPasswordTooShort: 'Wi-Fi slaptažodis – ne trumpesnis nei 8 simboliai.',
  },
  askAi: {
    lead: 'Apie prastą Wi-Fi klauskite išsamiai: kur router, kur įrenginys, kas tarp jų ir kurios juostos įjungtos.',
    template:
      'Router kambaryje, telefonas virtuvėje, tarp jų dvi sienos. Virtuvėje Wi-Fi dingsta. Router nustatymuose įjungta tik 5 GHz. Išmanioji lemputė rašo „Tinklas nerastas“. Ką pakeisti?',
    note: 'Be atstumo, sienų ir juostos DI gali tik spėlioti.',
  },
} satisfies LessonTexts<typeof lesson>
