import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Svetainės vardas ir adresas',
  summary:
    'DNS paverčia svetainės vardą adresu, kaip kontaktai telefone. Sutaisykite svetainę, kuri „neatsidaro“.',
  labels: {
    phone: { name: 'Phone', note: 'jūsų rankoje' },
    laptop: { name: 'Laptop', note: 'ant stalo' },
    router: {
      name: 'Router',
      note: 'jūsų namų paštas: išduoda adresus ir praneša, kur informacijos tarnyba',
    },
    internet: { name: 'Internet', note: 'daug tinklų' },
    dns: {
      name: 'DNS server',
      note: 'tiekėjo informacijos tarnyba: pagal svetainės vardą pasako adresą',
    },
    shop: { name: 'Parduotuvės svetainė', note: 'kažkur toli' },
  },
  steps: {
    names: {
      title: 'Vardas ir numeris',
      body: `Naršyklėje rašote shop.example, o ne 198.51.100.10. Žmonėms patogūs vardai. O tinklui reikia numerio: voko laukelyje „kam“ turi būti adresas. Paspauskite „Paleisti“ ir pažiūrėkite į voką [[shop|parduotuvės svetainei]].

Taip pat veikia ir jūsų telefonas. Skambinate „Mamai“, o ne renkate numerį: telefonas pats randa numerį kontaktuose. Svetainių tokie „kontaktai“ vadinami **DNS** (lietuviškai – vardų sistema): pagal svetainės vardą DNS randa jos adresą.`,
    },
    'ask-first': {
      title: 'Pirmiausia – klausimas informacijos tarnybai',
      body: `Iš kur telefonas gavo svetainės numerį? Prieš voką svetainei buvo dar vienas, ir jo kol kas nerodėme. Telefonas pirmą kartą atidaro shop.example, ir jo kontaktuose tuščia. Todėl pirmasis vokas keliauja į [[dns|informacijos tarnybą]] – tai **DNS server** (lietuviškai – vardų serveris). Jame klausimas: „Koks shop.example adresas?“

Informacijos tarnyba atsako: „198.51.100.10“. Telefonas įrašo atsakymą į savo [[phone|kontaktus]] (tai DNS cache) ir tik tada rašo [[shop|svetainei]]. Kitą kartą klausti nereikės: numeris jau įrašytas. Paspauskite „Paleisti“.`,
      more: {
        title: 'Plačiau: kodėl antrą kartą greičiau',
        body: `Telefonas kurį laiką prisimena informacijos tarnybos atsakymus, todėl antrą kartą svetainė atsidaro šiek tiek greičiau: klausti nereikia. Bet prisimena ne amžinai. Kiekvienas atsakymas turi galiojimo laiką, po jo telefonas paklaus vėl. Jei svetainė persikėlė į naują adresą, senas atsakymas dar kurį laiką gali trukdyti.

Informacijos tarnybos galima paklausti ir be naršyklės: komanda nslookup shop.example terminale. Terminalas atsiras 4 pamokoje, o nslookup – 10 pamokoje. Ten pat išsiaiškinsime, kaip nukreipti savo svetainės vardą (domain) į savo serverį.

Informacijos tarnyba irgi ne viską žino pati. Jei atsakymo neturi, ji grandine klausia kitų informacijos tarnybų. Tai irgi 10 pamoka.`,
      },
    },
    'who-first': {
      title: 'Klausimas: kam pirmasis vokas',
      body: 'Telefonas pirmą kartą atidaro parduotuvės svetainę, jo kontaktuose tuščia. Kam jis išsiųs patį pirmą voką? Paspauskite įrenginį lentoje.',
    },
    'no-dns': {
      title: 'Užduotis: svetainė nerandama',
      body: `Wi-Fi veikia, o parduotuvės svetainė neatsidaro. Naršyklė telefono ekrane rašo „Nepavyksta pasiekti svetainės“ ir kodą ERR_NAME_NOT_RESOLVED. Taip naršyklė sako: „nepavyko sužinoti adreso pagal vardą“.

Išsiaiškinkite, ko telefonas klausia adresų. Atidarykite telefono Wi-Fi nustatymus ir paspauskite „i“ prie savo tinklo – atsidarys tinklo informacija. Pažiūrėkite į eilutę DNS.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Matėte, kaip vardas virsta adresu.

- Žmonėms patogūs vardai, tinklams reikia adresų. **DNS** paverčia svetainės vardą adresu, kaip kontaktai telefone paverčia „Mamą“ numeriu.
- Jei adreso kontaktuose (DNS cache) nėra, telefonas klausia informacijos tarnybos – tai DNS server – ir įsimena atsakymą.
- Informacijos tarnybos adresą telefonui praneša router. Jei telefonui nėra ko paklausti, naršyklė rašo ERR_NAME_NOT_RESOLVED.

Toliau, 4 pamoka: vokas keliauja per kelis pašto skyrius. Sužinosime, kiek skyrių (router) yra tarp jūsų ir svetainės ir kaip rasti vietą, kur dingo ryšys.`,
    },
  },
  annotations: {
    siteName: () => 'shop.example',
    notAsked: () => 'neklausta: adresą jau žino DNS cache',
  },
  quizzes: {
    'who-first': {
      question:
        'Kam telefonas išsiųs patį pirmą voką, kai pirmą kartą atidaro parduotuvės svetainę?',
      wrong: {
        router:
          'Per router vokas praeis: tai jūsų namų pašto skyrius. Bet pirmojo voko laukelyje „kam“ – informacijos tarnyba.',
        shop: 'Parduotuvės adreso telefonas dar nežino: laukelyje „kam“ nėra ką parašyti. Pirmiausia reikia paklausti informacijos tarnybos.',
      },
      tags: {
        router: 'perduoda, bet ne gavėjas',
        dns: 'pirmasis gavėjas',
        shop: 'adresas dar nežinomas',
      },
      explain:
        'Pirmiausia vardas virsta adresu: telefonas klausia informacijos tarnybos, tai yra DNS server. Ir tik turėdamas adresą rašo svetainei.',
    },
  },
  tasks: {
    'no-dns': {
      prompt: 'Padarykite taip, kad parduotuvės svetainė atsidarytų telefone.',
      goals: {
        'knows-dns': 'Telefonas žino, ko klausti adresų',
        resolves: 'Vardas shop.example virsta adresu',
        opens: 'Parduotuvės svetainė atsidarė telefone',
      },
      hints: [
        'ERR_NAME_NOT_RESOLVED reiškia: telefonas nesužinojo adreso pagal vardą. Ko jis klausia adresų? Pažiūrėkite į eilutę DNS tinklo informacijoje.',
        'Eilutė DNS tuščia, o šalia parašyta „Rankiniu būdu“: telefonui nėra ko paklausti. Tegul informacijos tarnybos adresą praneša router – taip pat, kaip jis išduoda telefonui numerį.',
        'Paspauskite „Nustatyti DNS“, pasirinkite „Automatiškai (suteikia router)“ ir įkelkite puslapį naršyklėje iš naujo.',
      ],
      solvedNote:
        'Telefonas vėl žino, ko klausti adresų: informacijos tarnybos adresą jam praneša router. Vardas virto adresu, ir puslapis atsidarė.',
    },
  },
  feedback: {
    NoDnsServer: 'Telefonui nėra ko paklausti adreso: eilutė DNS tuščia.',
    InvalidIp:
      'Į laukelį „IP address“ rašomas informacijos tarnybos adresas – keturi skaičiai, o ne svetainės vardas.',
    PortClosed: ({ device }) =>
      device === 'router'
        ? 'Supaprastinta: šis mokomasis router į klausimus apie vardus pats neatsako, jis tik praneša telefonui informacijos tarnybos adresą. Daug tikrų modelių moka tokius klausimus persiųsti. Pasirinkite „Automatiškai (suteikia router)“.'
        : device === 'shop'
          ? 'Šiuo adresu gyvena parduotuvės svetainė, o ne informacijos tarnyba: į klausimus apie vardus ji neatsako. Paprasčiausia pasirinkti „Automatiškai (suteikia router)“.'
          : 'Šiuo adresu niekas neatsako į klausimus apie vardus. Paprasčiausia pasirinkti „Automatiškai (suteikia router)“.',
  },
  askAi: {
    lead: 'Jei svetainė „nerandama“, pridėkite klaidos kodą ir tinklo informaciją:',
    template:
      'Telefone yra Wi-Fi, bet shop.example neatsidaro: naršyklė rašo ERR_NAME_NOT_RESOLVED. Tinklo informacijoje: IP address 192.168.1.100, Router 192.168.1.1, DNS – tuščia, nustatyta rankiniu būdu. Kitos svetainės irgi neatsidaro. Ką patikrinti?',
    note: 'Klaidos kodas iš karto pasakys DI, kad sugedo ne Wi-Fi, o vardo pavertimas adresu.',
  },
} satisfies LessonTexts<typeof lesson>
