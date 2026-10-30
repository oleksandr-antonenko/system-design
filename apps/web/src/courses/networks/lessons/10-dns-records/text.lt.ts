import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'DNS records ir savas domain',
  summary:
    'Domain nukreipiamas į serverį per DNS records, o informacijos tarnybos prisimena seną atsakymą, kol nesibaigia jo TTL. Nukreipkite savo domain į savo serverį.',
  labels: {
    phone: { name: 'Phone', note: 'jūsų rankoje' },
    laptop: { name: 'Laptop', note: 'ant stalo' },
    router: { name: 'Router', note: 'jūsų namų paštas' },
    internet: { name: 'Internet', note: 'daug tinklų' },
    dns: { name: 'DNS server', note: 'jūsų tiekėjo informacijos tarnyba' },
    ns: {
      name: 'DNS tiekėjas',
      note: 'ns1.dns.example: saugo DNS records',
    },
    vps: { name: 'VPS', note: 'jūsų serveris, skirtas myapp.example' },
    parking: {
      name: 'Laikinas puslapis',
      note: '„Domenas myapp.example užregistruotas“',
    },
    'friend-router': { name: 'Router', note: 'draugo namų paštas' },
    friend: { name: 'Laptop', note: 'draugo' },
    cf: { name: 'DNS server', note: 'draugo informacijos tarnyba' },
    'zone:friend-router': { name: 'Draugo namai' },
  },
  steps: {
    'own-domain': {
      title: 'Savas domain',
      body: `Paleidote programėlę [[vps|nuomojamame serveryje]] adresu 198.51.100.20 (toks serveris vadinamas VPS) ir nusipirkote jai vardą – domain (lietuviškai – domenas) myapp.example. Paspauskite „Paleisti“: pagal vardą atsidaro ne jūsų serveris, o [[parking|laikinas puslapis]] „Domenas užregistruotas“.

Informacijos tarnybos iš 3 pamokos (DNS server) adresą sužino iš [[ns|DNS tiekėjo]] – įmonės, kurioje saugoma myapp.example kortelė. Kiekviena jos eilutė – **DNS record** (lietuviškai – DNS įrašas): vardas, tipas ir reikšmė. Kaip eilutės kontakto kortelėje: numeris, antras numeris, pastaba. A tipo DNS record – tai adresas. Dabar myapp.example A veda į laikiną puslapį.`,
    },
    ttl: {
      title: 'Informacijos tarnyba prisimena atsakymą',
      body: `Nusiuntėte nuorodą [[friend|draugui]]. Paspauskite „Paleisti“: jo nešiojamasis kompiuteris klausia savo informacijos tarnybos, [[cf|1.1.1.1]]. Ji atsakymo nežino, klausia DNS tiekėjo ir įsimena atsakymą kartu su galiojimo laiku. Šis laikas vadinamas **TTL** (time to live, lietuviškai – „gyvavimo laikas“), jis nurodomas pačiame DNS record: laikino puslapio – 3600 sekundžių, tai yra valanda.

Kol laikas nesibaigė, informacijos tarnyba atsako iš atminties (DNS cache) ir DNS tiekėjo neklausia: taip greičiau. Kaip pienas šaldytuve: kol galiojimo laikas nepasibaigė, naujo neina pirkti. Draugo informacijos tarnybos kortelėje šalia atsakymo – laikmatis: liko 60 minučių.`,
      more: {
        title: 'Plačiau: kaip informacijos tarnyba randa DNS tiekėją',
        body: `Lentoje informacijos tarnyba iškart žino, ko klausti. Iš tikrųjų ji eina grandine: pirma šakniniai DNS serveriai (root servers: „už .example atsako štai šie“), tada .example zonos serveriai („už myapp.example atsako ns1.dns.example“), ir tik tada DNS tiekėjas. Kiekvieną atsakymą ji irgi įsimena jo TTL laikui.

DNS pasaulyje informacijos tarnyba vadinama žodžiu resolver, o jos atmintis – DNS cache. DNS tiekėjo atsakymas pažymėtas kaip „autoritetingas“ (vėliavėlė aa dig išvestyje). Atsakymą iš informacijos tarnybos atminties nslookup sąžiningai pažymi: „Non-authoritative answer“.

Kiti dažni DNS records: AAAA – IPv6 adresas, MX – kur pristatyti paštą, skirtą myapp.example. TXT prašo daugelis paslaugų, kad patikrintų, ar domain jūsų: talpinimo paslaugos, pašto paslaugos, paieškos sistemos. Trumpą išvestį be smulkmenų duoda dig +short myapp.example.`,
      },
    },
    'point-domain': {
      title: 'Užduotis: nukreipkite domain į serverį',
      body: `Atidarykite DNS tiekėjo skydelį ir nukreipkite domain į [[vps|savo serverį]], 198.51.100.20. Pats domain skydeliuose žymimas ženklu @.

Reikia trijų tipų DNS records. A ties @ – serverio adresas. CNAME ties www – „tas pats, kas myapp.example“: tada www.myapp.example visada veda ten pat, o persikeliant adresas keičiamas vienoje vietoje. TXT ties @ su tekstu myapp-verify=4f9c2a – jo prašo jūsų serverio skydelis, kad įsitikintų, jog domain jūsų.

Tada patikrinkite vardą nešiojamojo kompiuterio terminale: dig myapp.example arba nslookup myapp.example. Abi komandos klausia informacijos tarnybos ir išspausdina jos atsakymą.`,
    },
    'friend-sees-old': {
      title: 'Klausimas: kodėl draugas mato seną svetainę',
      body: 'Praėjo pusvalandis. Viską išsaugojote, ir jūsų dig rodo 198.51.100.20. O [[friend|draugas]] rašo: „Man vis dar laikinas puslapis“. Jis net perkrovė nešiojamąjį kompiuterį. Kur įstrigo senas adresas? Paspauskite tą įrenginį.',
    },
    summary: {
      title: 'Santrauka',
      body: `Praėjo dar pusvalandis: seno atsakymo galiojimo laikas baigėsi, draugo informacijos tarnybos kortelėje jis pažymėtas „pasenę“. Paspauskite „Paleisti“: draugo informacijos tarnyba vėl klausia DNS tiekėjo, ir draugas patenka į [[vps|jūsų serverį]].

- Domain nukreipiamas į serverį per **DNS records** pas DNS tiekėją: A – adresas, CNAME – „tas pats, kas kitas vardas“, TXT – pastaba patikrinimams.
- Informacijos tarnybos prisimena atsakymą, kol nesibaigia jo **TTL**. Jei po pakeitimo kas nors dar mato seną adresą, tai ne klaida, o laukimas.
- Ruošiatės persikelti – prieš dieną sumažinkite TTL iki 300 sekundžių, tai yra 5 minučių. Patikrinti DNS record be svetimos atminties galima pas patį DNS tiekėją: dig @ns1.dns.example myapp.example.

Toliau, 11 pamoka: svetainė atsidaro pagal vardą, bet naršyklė rašo „Nesaugu“. Išsiaiškinsime, kuo HTTPS skiriasi nuo atviruko ir kam svetainei pasas.`,
    },
  },
  annotations: {
    parked: () => '„Domenas myapp.example užregistruotas“',
  },
  quizzes: {
    'stale-where': {
      question:
        'Draugas vis dar mato laikiną puslapį, nors perkrovė nešiojamąjį kompiuterį. Kur įstrigo senas adresas?',
      wrong: {
        friend:
          'Draugas perkrovė nešiojamąjį kompiuterį, savo atminties jis dabar neturi. Jis sąžiningai klausia informacijos tarnybos 1.1.1.1.',
        dns: 'Tai jūsų tiekėjo informacijos tarnyba. Ji paklausė DNS tiekėjo po pakeitimo ir žino naują adresą. Bet draugas ja nesinaudoja.',
        ns: 'DNS tiekėjas jau turi naują DNS record: jūs jį išsaugojote, ir jūsų dig tai patvirtino.',
        vps: 'Serveris nieko nežino apie vardus. Jis laukia vokų savo adresu, o draugo vokai iki jo tiesiog nenueina.',
      },
      tags: {
        friend: 'atmintis tuščia',
        cf: 'prisimena laikiną puslapį',
        dns: 'draugas jos neklausia',
        ns: 'jau naujas adresas',
        vps: 'vokai nenueina',
      },
      explain:
        'Senas adresas įstrigo informacijos tarnybos 1.1.1.1 atmintyje. Prieš pusvalandį ji paklausė DNS tiekėjo ir įsiminė atsakymą valandai: laikino puslapio TTL – 3600 sekundžių. Kol laikas nesibaigė, ji atsako iš atminties. Po pusvalandžio laikmatis pasieks nulį, ir draugas pamatys jūsų serverį.',
    },
  },
  tasks: {
    'point-domain': {
      prompt:
        'Nukreipkite myapp.example į savo serverį ir patikrinkite vardą terminale.',
      goals: {
        'a-record': 'myapp.example veda į jūsų serverį 198.51.100.20',
        'www-cname': 'www.myapp.example – myapp.example pseudonimas (CNAME)',
        txt: 'Yra TXT domain patvirtinimui',
        checked:
          'Patikrinote vardą su dig arba nslookup ir pamatėte naują adresą',
      },
      hints: [
        'Domain adresas saugomas pas DNS tiekėją. Atidarykite skydelį: koks adresas A eilutėje ties @, tai yra paties domain?',
        'A eilutėje ties @ pakeiskite Value į 198.51.100.20. Pridėkite CNAME eilutę: Name – www, Value – myapp.example. Pridėkite TXT eilutę: Name – @, Value – myapp-verify=4f9c2a. Išsaugokite ir terminale surinkite dig myapp.example. Jei ten senas adresas – tai informacijos tarnybos atmintis: paklauskite DNS tiekėjo tiesiogiai, dig @ns1.dns.example myapp.example.',
        'Reikalingos vietos skydelyje apvestos punktyru: A reikšmė ir naujos eilutės. Terminale pasiūlyta komanda.',
      ],
      solvedNote:
        'myapp.example veda į jūsų serverį, www.myapp.example – ten pat, o TXT patvirtina, kad domain jūsų. Komanda dig parodė naują adresą.',
    },
  },
  feedback: {
    SeveralAddresses: ({ name, ips }) =>
      `${name} turi kelis adresus: ${ips.join(' ir ')}. Informacijos tarnybos juos dalins paeiliui, ir dalis lankytojų pateks į laikiną puslapį. Ištrinkite seną A eilutę.`,
    GoalResolvesElsewhere: ({ name, have, want }) =>
      `${name} veda į ${have}, o jūsų serveris – ${want}.`,
    GoalNoRecord: ({ rtype }) =>
      rtype === 'CNAME'
        ? 'www kol kas neturi CNAME. Paverskite www pseudonimu: CNAME su reikšme myapp.example. Tada serverio adresas įrašytas vienoje vietoje, ir persikeliant jo nepamirš pakeisti.'
        : 'TXT ties @ kol kas nėra: pridėkite TXT eilutę su reikšme myapp-verify=4f9c2a.',
    GoalRecordValue: ({ rtype, want }) =>
      rtype === 'TXT'
        ? `TXT tekstas nesutampa: reikia ${want}.`
        : `CNAME ties www turi rodyti į ${want}.`,
    GoalCommandNotRun: () =>
      'Patikrinkite vardą nešiojamojo kompiuterio terminale: dig myapp.example arba nslookup myapp.example. Komanda ping irgi sužino adresą, bet neparodo, iš kur jis ir kuriam laikui.',
    GoalCommandSawOther: ({ saw }) =>
      saw.length === 0
        ? 'Komanda nerado myapp.example adreso. Patikrinkite A eilutę ties @ ir paklauskite dar kartą.'
        : `Komanda parodė ${saw.join(', ')} iš tiekėjo informacijos tarnybos atminties: klausėte prieš pakeitimą. Paklauskite DNS tiekėjo tiesiogiai: dig @ns1.dns.example myapp.example.`,
  },
  askAi: {
    lead: 'Jei domain „veda ne ten“, pridėkite DNS records ir dvi dig išvestis: per savo informacijos tarnybą ir tiesiogiai pas DNS tiekėją. Iš jų matyti, ar tai klaida, ar TTL laukimas.',
    template: `Nukreipiau domain myapp.example į serverį 198.51.100.20,
bet daliai žmonių atsidaro sena svetainė.

DNS records DNS tiekėjo skydelyje (Type, Name, Value, TTL – po eilutę):
<…>

dig myapp.example išvestis:
<įklijuokite išvestį>

dig @<jūsų DNS tiekėjo DNS server> myapp.example išvestis:
<įklijuokite išvestį>

DNS record pakeičiau <laikas>. Tai klaida DNS records ar TTL laukimas?
Kiek dar laukti?`,
  },
} satisfies LessonTexts<typeof lesson>
