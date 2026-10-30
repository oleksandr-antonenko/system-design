import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Kiekvienas turi savo adresą',
  summary:
    'Kiekvienas tinklo įrenginys turi savo adresą – IP address, – ir jį suteikia router. Raskite nešiojamojo kompiuterio adresą ir prijunkite spausdintuvą.',
  labels: {
    phone: { name: 'Phone', note: 'jūsų rankoje' },
    laptop: { name: 'Laptop', note: 'ant stalo' },
    router: { name: 'Router', note: 'jūsų namų paštas: dalija adresus' },
    internet: { name: 'Internet', note: 'daug tinklų' },
    shop: { name: 'Parduotuvės svetainė', note: 'kažkur toli' },
    printer: { name: 'Printer', note: 'tik kabelis, be Wi-Fi' },
  },
  steps: {
    'house-numbers': {
      title: 'Numeris ant voko',
      body: `1 pamokoje ant vokų buvo vardai: „nuo: telefonas“, „kam: parduotuvės svetainė“. Bet router vardų neskaito. Laiškininkui reikia namo numerio, o tinklui – įrenginio numerio. Toks numeris vadinamas **IP address** (lietuviškai – IP adresas).

Dabar adresas užrašytas po kiekvienu įrenginiu. [[phone|Telefono]] – 192.168.1.100, [[laptop|nešiojamojo kompiuterio]] – 192.168.1.42, paties [[router|router]] – 192.168.1.1. Adresas – tai keturi skaičiai, atskirti taškais. [[shop|Parduotuvės svetainė]] taip pat turi savo: 198.51.100.10. Paspauskite „Paleisti“: telefonas nusiųs nuotrauką į nešiojamąjį kompiuterį.`,
    },
    'router-gives': {
      title: 'Adresą suteikia router',
      body: `Iš kur telefonas gavo adresą? Jį suteikė router. Kai įrenginys jungiasi prie Wi-Fi, jis klausia visų namuose: „Koks bus mano numeris?“ Router randa laisvą numerį ir atsako: „Jūsų – 192.168.1.100.“

Router atsimena, kurie numeriai jau užimti, todėl tuose pačiuose namuose adresai nesikartoja. Paspauskite „Paleisti“: telefonas iš naujo prisijungs prie Wi-Fi ir gaus adresą.`,
      more: {
        title: 'Plačiau: kodėl kaimynai turi tokius pat adresus',
        body: `Adresai, prasidedantys 192.168.…, – namų adresai. Tokie patys numeriai naudojami tūkstančiuose kitų butų: kaimynas irgi gali turėti savo 192.168.1.100. Vienas kitam jie netrukdo, nes namų adresas veikia tik savo namuose. Kaip namai su tokiais adresais išeina į internetą, aptarsime 9 pamokoje.

Adresas gali pasikeisti. Router suteikia numerį laikinai ir pažįstamam įrenginiui paprastai duoda tą patį: nešiojamajam kompiuteriui jis saugo 192.168.1.42. Bet jei router perkrausite, numeris gali tapti kitu. Kaip visam laikui priskirti adresą įrenginiui, taip pat parodysime 9 pamokoje.

Adresų dalijimas tinkluose vadinamas **DHCP**. Kaip jis veikia žingsnis po žingsnio, aptarsime 7 pamokoje „Po gaubtu“.`,
      },
    },
    'who-gave': {
      title: 'Klausimas: kas suteikė adresą',
      body: 'Telefonas prisijungė prie Wi-Fi ir gavo adresą 192.168.1.100. Kas jam suteikė šį adresą? Paspauskite įrenginį lentoje.',
    },
    'photo-and-printer': {
      title: 'Užduotis: nuotrauka ir spausdintuvas',
      body: `Pirmiausia nusiųskite nuotrauką iš telefono į nešiojamąjį kompiuterį. Tam reikia kompiuterio adreso: paspauskite [[laptop|nešiojamąjį kompiuterį]] lentoje, ir atsidarys jo kortelė. Tada paspauskite [[phone|telefoną]] ir jo kortelėje, skiltyje „Siųsti nuotrauką“, įrašykite šį adresą.

Paskui prijunkite naują [[printer|spausdintuvą]]. Wi-Fi jis neturi, tik kabelį: nutieskite kabelį nuo spausdintuvo iki router. Router suteiks spausdintuvui adresą, ir iš nešiojamojo kompiuterio bus galima išspausdinti dokumentą.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Dabar ant vokų adresai, o ne vardai. Paspauskite „Paleisti“: nešiojamasis kompiuteris dar kartą nusiųs dokumentą į spausdintuvą.

- **IP address** – įrenginio numeris tinkle, kaip namo numeris ant voko. Jis užrašomas keturiais skaičiais, atskirtais taškais: 192.168.1.42.
- Adresą suteikia router, kai įrenginys prisijungia, ir prižiūri, kad numeriai nesikartotų.
- Norint ką nors nusiųsti įrenginiui, reikia jo adreso. Jis parašytas įrenginio kortelėje.

Toliau, 3 pamoka: svetainės vardas ir jos adresas. Naršyklėje rašote shop.example, o ne 198.51.100.10. Sužinosime, kas paverčia vardą adresu.`,
    },
  },
  annotations: {
    gotAddress: () => 'adresas iš router',
    printing: () => 'spausdina',
  },
  quizzes: {
    'who-gave': {
      question: 'Kas suteikė telefonui adresą 192.168.1.100?',
      wrong: {
        laptop:
          'Nešiojamasis kompiuteris – toks pat namų gyventojas kaip telefonas. Jis pats gavo adresą iš router ir numerių nedalija.',
        internet:
          'Internetas apie jūsų namus nieko nežino. Namų numerius dalija router, ir jie veikia tik namuose.',
      },
      tags: {
        laptop: 'numerių nedalija',
        router: 'suteikė adresą',
        internet: 'apie jūsų namus nežino',
      },
      explain:
        'Router – jūsų namų pašto skyrius. Jis suteikia numerius visiems, kas prisijungia, ir prižiūri, kad jie nesikartotų.',
    },
  },
  tasks: {
    'photo-and-printer': {
      prompt:
        'Nusiųskite nuotrauką į nešiojamąjį kompiuterį ir prijunkite spausdintuvą.',
      goals: {
        photo: 'Nuotrauka pasiekė nešiojamąjį kompiuterį',
        'printer-address': 'Spausdintuvas turi adresą',
        printed: 'Dokumentas išspausdintas',
      },
      hints: [
        'Įrenginio adresas parašytas jo kortelėje. Paspauskite nešiojamąjį kompiuterį lentoje ir raskite eilutę su adresu.',
        'Nuotrauka: telefono kortelėje, skiltyje „Siųsti nuotrauką“, įveskite nešiojamojo kompiuterio adresą – visus keturis skaičius – ir paspauskite „Siųsti“. Spausdintuvas: nutieskite kabelį nuo spausdintuvo iki router, adresą spausdintuvas gaus pats. Jo naujas adresas atsiras spausdintuvo kortelėje.',
        'Lentoje punktyru parodytas kabelis nuo spausdintuvo iki router. Telefono ir nešiojamojo kompiuterio kortelėse apvesti laukai, kur įrašyti adresą.',
      ],
      solvedNote:
        'Kiekvienas įrenginys namuose turi savo adresą. Router suteikė spausdintuvui laisvą numerį, ir nešiojamasis kompiuteris rado spausdintuvą pagal šį numerį.',
    },
  },
  feedback: {
    GoalNotPerformed: ({ from }) =>
      from === 'phone'
        ? 'Nuotrauka dar nepasiekė nešiojamojo kompiuterio. Patikrinkite adresą pagal kompiuterio kortelę: reikia visų keturių skaičių.'
        : 'Dokumentas dar nepasiekė spausdintuvo. Spausdintuvo adresas – spausdintuvo kortelėje.',
    NoLink:
      'Spausdintuvas dar ne tinkle: jis neturi adreso. Pirmiausia nutieskite kabelį nuo spausdintuvo iki router.',
    NoDhcpServer:
      'Adresą spausdintuvui suteikia jūsų namų router. Prijunkite spausdintuvą prie router.',
    PortBusy: ({ device }) =>
      device === 'printer'
        ? 'Spausdintuvas turi vieną lizdą, ir jis jau užimtas. Paspauskite seną kabelį, kad jį ištrauktumėte, ir prijunkite spausdintuvą prie router.'
        : device === 'laptop' || device === 'phone'
          ? 'Nešiojamasis kompiuteris ir telefonas adresų nedalija ir svetimų vokų neperduoda. Prijunkite spausdintuvą prie router.'
          : 'Adresą spausdintuvui suteikia jūsų namų router. Prijunkite spausdintuvą prie router.',
  },
  askAi: {
    lead: 'Kai namų tinkle kas nors neveikia, pradėkite klausimą nuo adresų. Pavyzdžiui:',
    template:
      'Spausdintuvas prijungtas kabeliu prie router, jo adresas 192.168.1.101. Nešiojamasis kompiuteris Wi-Fi tinkle, jo adresas 192.168.1.42, router adresas 192.168.1.1. Spausdinimas iš kompiuterio nepasiekia spausdintuvo. Ką patikrinti?',
    note: 'Iš adresų DI supras, ar įrenginiai tuose pačiuose namuose ir kas jiems suteikė numerius.',
  },
} satisfies LessonTexts<typeof lesson>
