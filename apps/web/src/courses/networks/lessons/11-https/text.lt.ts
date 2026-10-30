import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

/** Pasas išduotas vardui be `www.`, o naršyklė klausia `www.` vardo. */
const missesWww = (name: string, names: ReadonlyArray<string>): boolean =>
  name.startsWith('www.') && names.includes(name.slice('www.'.length))

export default {
  title: 'HTTPS ir certificates. Spynelė adreso juostoje',
  summary:
    'Ką saugo spynelė naršyklėje ir kodėl certificate gali būti negaliojantis.',
  labels: {
    phone: { name: 'Phone', note: 'jūsų rankoje, kavinėje' },
    laptop: { name: 'Laptop', note: 'namie ant stalo' },
    printer: { name: 'Printer', note: 'gretimame kambaryje' },
    router: { name: 'Router', note: 'jūsų namų paštas' },
    cafe: { name: 'Kavinės Wi-Fi', note: 'atviras tinklas, be slaptažodžio' },
    stranger: { name: 'Kaimynas', note: 'nešiojamasis prie gretimo staliuko' },
    internet: { name: 'Internet', note: 'daug tinklų' },
    dns: { name: 'DNS server', note: 'tiekėjo informacijos tarnyba' },
    vps: { name: 'VPS', note: 'jūsų serveris, skirtas myapp.example' },
    shop: { name: 'Parduotuvės svetainė', note: 'shop.example' },
    ca: {
      name: 'Certificate authority',
      note: 'svetainių pasų skyrius',
    },
    'zone:cafe': { name: 'Kavinė „Utro“' },
  },
  steps: {
    postcard: {
      title: 'HTTP – atvirlaiškis',
      body: `Esate kavinėje „Utro“, [[phone|telefonas]] prisijungęs prie atviro [[cafe|kavinės]] tinklo. Atidarote savo svetainės iš 10 pamokos administravimo puslapį, http://myapp.example/login, ir įvedate slaptažodį. Paspauskite „Paleisti“: prie kavinės Wi-Fi vokas sustos ir atsivers. Viduje matyti ir puslapio adresas, ir slaptažodis. Paprastas http:// – tai atvirlaiškis: jį gali perskaityti kiekvienas, per kurį jis keliauja. Atvirame kavinės tinkle – net [[stranger|nešiojamasis prie gretimo staliuko]].

Naršyklė apie tai įspėja: kairėje nuo adreso ji rašo „Nesaugu“.`,
    },
    sealed: {
      title: 'HTTPS – užantspauduotas vokas',
      body: `Dabar prisijunkime prie [[shop|parduotuvės svetainės]]: https://shop.example/login. Paspauskite „Paleisti“. Pačioje pradžioje telefonas ir svetainė susitaria dėl šifro – tarsi dėl spynos, kurios raktą turi tik jie abu. Toliau visas turinys keliauja užantspauduotas: pakeliui matyti, kur vokas keliauja, bet ne kas viduje.

Tai **HTTPS**: tas pats HTTP, tik užantspauduotame voke. Jis turi savo port, 443, o adreso juostoje vietoj „Nesaugu“ – spynelė.`,
    },
    passport: {
      title: 'Certificate – svetainės pasas',
      body: `Bet kaip telefonas įsitikins, kad užantspaudavo voką būtent su parduotuvės svetaine, o ne su [[stranger|kaimynu kavinėje]], kuris ja apsimetė? Susitikus svetainė parodo **certificate** (lietuviškai – sertifikatas): svetainės pasą. Jame parašytas svetainės vardas, iki kada jis galioja ir kas jį išdavė. Tokius pasus išduoda [[ca|sertifikavimo centrai]] (certificate authority) – svetainių pasų skyriai, ir naršyklė iš anksto žino, kuriais iš jų pasitikėti.

Naršyklė tikrina tris dalykus: vardas pase sutampa su adreso juosta, galiojimas nepasibaigęs, pasą išdavė centras, kuriuo naršyklė pasitiki. Jei bent kas nors negerai, vietoj svetainės bus raudonas ekranas. Svetainės shop.example pasas – po lenta. Paspauskite „Paleisti“: telefonas jį gaus, kol susitars dėl šifro.`,
      more: {
        title: 'Išsamiau: kaip susitariama dėl šifro ir kokių būna klaidų',
        body: `Susitarimas dėl šifro vadinamas TLS handshake (TLS rankos paspaudimas). Svetainė atsiunčia certificate ir atvirąją rakto pusę; telefonas patikrina pasą, ir kartu jie gauna bendrą slaptą raktą, kurio niekas pakeliui nematė. Raidė S žodyje HTTPS – tai ir yra TLS.

Sertifikavimo centrai (CA) sudaro grandinę: svetainės pasą pasirašo tarpinis centras, o jį – šakninis, įmontuotas į naršyklę ir sistemą. Nemokamus pasus 90 dienų išduoda, pavyzdžiui, Let’s Encrypt; programa certbot arba web server Caddy juos atnaujina patys. Tikrinimas per failą per http:// vadinamas HTTP-01. Jei port 80 atidaryti negalima, yra būdas DNS-01: centras paprašo pridėti TXT record, kaip 10 pamokoje.

Kitos dažnos klaidos: NET::ERR_CERT_DATE_INVALID – pasas pasibaigęs (arba kompiuteryje neteisinga data); NET::ERR_CERT_AUTHORITY_INVALID – pasą išdavė centras, kuriuo naršyklė nepasitiki, pavyzdžiui, „pačių pasirašytas“, nupieštas namie; ERR_SSL_PROTOCOL_ERROR – ant port 443 apskritai nėra HTTPS.`,
      },
    },
    'cafe-sees': {
      title: 'Klausimas: ką mato kavinė',
      body: `Vėl esate kavinėje ir jungiatės prie https://shop.example/login. Ką apie jūsų voką sužino [[cafe|kavinės tinklas]] ir [[stranger|kaimynas prie staliuko]]?`,
    },
    'get-certificate': {
      title: 'Užduotis: spynelė jūsų svetainei',
      body: `Laikas perkelti į HTTPS ir [[vps|jūsų svetainę]]. Talpinimo paslauga įjungė serveryje HTTPS, bet certificate ten išduotas techniniam talpinimo vardui. O HTTP jūs išjungėte, perskaitę, kad jis nesaugus. Telefone atidarytas https://myapp.example – raudonas ekranas su klaida NET::ERR_CERT_COMMON_NAME_INVALID: vardas pase nesutampa su adresu.

Serverio skydelyje išduokite certificate vardams myapp.example ir www.myapp.example ir įjunkite nukreipimą (redirect) iš http:// į https://. Sertifikavimo centras išduoda pasą tik įsitikinęs, kad svetainė jūsų: jis paprašys serverio padėti failą-slaptažodį ir pasiims jį per http://. Patikrinti galima ir iš nešiojamojo kompiuterio terminalo: curl -v https://myapp.example/.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Jūsų svetainė dabar turi spynelę, o http:// pats veda į https://. Paspauskite „Paleisti“: prisijungimas iš kavinės keliauja užantspauduotas.

- HTTP – atvirlaiškis: jį skaito kiekvienas pakeliui, atvirame Wi-Fi – net kaimynas prie staliuko.
- **HTTPS** užantspauduoja turinį. Iš išorės matyti tik, kur vokas keliauja: adresas, port ir svetainės vardas.
- **Certificate** – svetainės pasas: vardas, galiojimas ir centro, kuriuo pasitiki naršyklė, parašas. Raudonas ekranas reiškia, kad vienas iš trijų patikrinimų nepavyko, o klaidos kodas sako, kuris.
- Kad išduotų pasą, sertifikavimo centras užeina į svetainę per http://, todėl port 80 laikomas atviras ir jame įjungiamas nukreipimas į https://.

Toliau – 3 modulis, 12 pamoka: firewall. Kaip serveryje atidaryti tik reikalingus ports, net jei programa klauso visų.`,
    },
  },
  annotations: {
    seesPassword: () => 'mato: password=kotik2024',
    seesName: () => 'mato: shop.example, port 443',
    seesMyapp: () => 'mato: myapp.example, port 443',
  },
  quizzes: {
    'cafe-sees': {
      question:
        'Kavinėje jungiatės prie https://shop.example/login. Ką apie jūsų voką sužino kavinės tinklas ir kaimynas prie staliuko?',
      options: {
        nothing: 'Nieko: HTTPS paslepia viską',
        'address-only': 'Tik serverio IP address, 198.51.100.10',
        'address-port-name':
          'Serverio IP address, port 443 ir vardą shop.example',
        everything: 'Viską, net puslapį /login ir slaptažodį',
      },
      wrong: {
        nothing:
          'Vokas užantspauduotas, bet adresą ant jo rašyti tenka, kitaip jo nepristatys. Kavinė mato, kur jis keliauja.',
        'address-only':
          'Dar port 443 ir svetainės vardą: telefonas pačioje pradžioje pasako vardą atvirai, kad serveris parinktų tinkamą pasą.',
        everything:
          'Taip būtų su http://. Su https:// puslapis ir slaptažodis keliauja užantspauduoto voko viduje.',
      },
      explain:
        'Kavinė žino, kad užėjote į shop.example, bet nežino, į kurį puslapį ir ką įvedėte. Todėl svetimame Wi-Fi slaptažodžius įveskite tik svetainėse su spynele.',
    },
  },
  tasks: {
    'get-certificate': {
      prompt:
        'Išduokite certificate vardams myapp.example ir www.myapp.example ir įjunkite nukreipimą iš http:// į https://.',
      goals: {
        lock: 'https://myapp.example atsidaro su spynele',
        'lock-www': 'https://www.myapp.example – irgi su spynele',
        redirect: 'http://myapp.example nukreipia į https://',
        'only-web':
          'Iš išorės atviri tik port 80 ir port 443: programa ir duomenų bazė nėra matomos',
      },
      hints: [
        'Raudoname ekrane paspauskite „Išsamiau“: naršyklė rašo, kokiam vardui dabar išduotas pasas. Jis nesutampa su myapp.example.',
        'Reikia naujo certificate vardams myapp.example ir www.myapp.example. Sertifikavimo centras tikrina, kad svetainė jūsų, užeidamas į ją per http://. Todėl pirmiausia atidarykite port 80 skirtuke „Svetainė“, tada skirtuke „Certificate“ išduokite certificate, o pabaigoje įjunkite nukreipimą.',
        'Reikalingos vietos skydelyje apvestos punktyru. Pabaigoje atnaujinkite puslapį telefone.',
      ],
      solvedNote:
        'Certificate išduotas abiem vardams: svetainė atsidaro su spynele, o http:// nukreipia į https://.',
    },
  },
  feedback: {
    CertNameMismatch: ({ name, names }) =>
      missesWww(name, names)
        ? `https://${name}: NET::ERR_CERT_COMMON_NAME_INVALID. Pase nėra vardo ${name}. Išduokite certificate abiem vardams.`
        : `Nepavyko patvirtinti, kad tai serveris ${name}: jo certificate išduotas vardui ${names.join(', ')}. Galbūt serveris sukonfigūruotas neteisingai arba kažkas bando perimti jūsų duomenis.`,
    GoalExtraOpenPort: ({ port }) =>
      port === 5432
        ? 'Iš išorės atviras port 5432 – duomenų bazė matoma iš kavinės. Grąžinkite jai „Tik localhost“.'
        : port === 3000
          ? 'Iš išorės atviras port 3000 – programą galima pasiekti atvirlaiškiu, apeinant HTTPS. Grąžinkite jai „Tik localhost“.'
          : `Iš išorės atviras perteklinis port ${port}. Uždarykite jį skirtuke „Svetainė“.`,
    PortClosed: ({ port }) =>
      port === 80
        ? 'http://myapp.example — ERR_CONNECTION_REFUSED: port 80 uždarytas. Kas surinks adresą be https, pamatys klaidą. O sertifikavimo centras negalės patikrinti svetainės: jam reikia port 80.'
        : `Port ${port} uždarytas: jo niekas neklauso.`,
    GoalNotRedirected: () =>
      'Per http:// svetainė atsidaro atvirlaiškiu: prisijungimo formos slaptažodis vėl matomas kavinėje. Įjunkite nukreipimą į https://.',
  },
  askAi: {
    lead: 'Raudonas naršyklės ekranas – tai klaidos kodas ir svetainės pasas. Nukopijuokite abu, ir DI pasakys, kuris iš trijų patikrinimų nepavyko:',
    template: `Naršyklė rašo <klaidos kodas, pvz. NET::ERR_CERT_COMMON_NAME_INVALID>
adresu https://<mano svetainė>.

\`curl -v https://<mano svetainė>/\` išvestis (eilutės su žvaigždutėmis apie certificate):
<įklijuokite išvestį>

Kaip išduodu certificate: <certbot, Caddy, talpinimo skydelis, …>
Ar port 80 atviras iš išorės – \`curl -v http://<mano svetainė>/\` išvestis:
<įklijuokite išvestį>

Kodėl naršyklė nepriima certificate ir kaip jį išduoti taip,
kad veiktų ir <mano svetainė>, ir www.<mano svetainė>?`,
  },
} satisfies LessonTexts<typeof lesson>
