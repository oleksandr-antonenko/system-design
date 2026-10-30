import { Option } from 'effect'

import { type SimResult, simulationRules } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`
const p95 = (sim: SimResult) =>
  Option.match(sim.p95, { onNone: () => '—', onSome: ms => `${n(ms)} ms` })
const incoming = (sim: SimResult, id: string) => sim.nodes[id]?.incoming ?? 0
const { cdnStaticShare, cdnMs } = simulationRules

export default {
  title: 'CDN ir statiniai failai',
  summary:
    'Statinis ir dinaminis turinys, edge location ir cache antraštės: kaip pateikti paveikslėlius ir skriptus arčiau naudotojo.',
  steps: {
    'shop-front': {
      title: 'Įėjimas į parduotuvę',
      body: `Grįžkime prie internetinės parduotuvės. [[users|Users]] per [[lb|load balancer]] patenka į tris server – [[app1|app1]], [[app2|app2]] ir [[app3|app3]], o server blokai dirba su [[db|database]]. Kad prie įėjimo liktų vietos, cache iš 4 pamokos šioje lentoje nerodomas.

Dabar ateina 900 rps, po 300 kiekvienam server. Tai 75 % pajėgumo: atsarga nedidelė, bet klaidų nėra.`,
    },
    'photo-catalog': {
      title: 'Katalogas su nuotraukomis',
      body: `Parduotuvė paleidžia naują katalogą: didelės prekių nuotraukos, galerija kiekviename puslapyje, naujas dizainas su sunkiais skriptais. Kartu su reklamos kampanija apkrova išauga iki **2400 rps**.

Kiekvienas [[app2|server]] gauna 800 rps – dvigubai daugiau, nei pajėgia. Pusė užklausų prarandama: tai raudoni taškai ant ryšių ir 50 % prietaise „Klaidos“. Tie, kuriems pasisekė, atsakymo laukia ilgiau nei sekundę.`,
    },
    'static-files': {
      title: 'Kuo užsiėmę server blokai',
      body: `Atidarykite bet kurį puslapį ir pažiūrėkite, ką atsisiunčia naršyklė. Viena užklausa grąžina HTML su preke ir kaina. Po jos – dar dešimtys: nuotraukos, šriftai, skriptai, stiliai. Tai **statiniai failai** (static content): jie vienodi visiems lankytojams ir retai keičiasi. Puslapis su jūsų krepšeliu, jūsų kaina ir dabartiniu likučiu yra **dinaminis** (dynamic content): jis sudaromas iš naujo kiekvienai užklausai.

Šiame kurse ${percent(cdnStaticShare)} užklausų – statiniai failai. Vadinasi, iš 800 rps, kuriuos gauna kiekvienas [[app2|server]], 480 tik dalija paruoštus failus. Didžiąją dalį jėgų server blokai eikvoja veikdami kaip failų saugykla.

Statiniams failams programos visai nereikia. Juos gali pateikti **CDN** (Content Delivery Network, lietuviškai – turinio pristatymo tinklas) – šimtuose miestų išdėstytas tinklas, kurio server laiko failų kopijas, kaip cache. CDN stovi prieš jūsų sistemą, statinius failus atiduoda iš savo kopijų, o toliau praleidžia tik dinamines užklausas.`,
    },
    'place-cdn': {
      title: 'Užduotis: CDN',
      body: 'CDN statomas pačiame įėjime, prieš [[lb|load balancer]]. „Users“ kreipiasi tik į CDN, o jis toliau perduoda tai, į ką negali atsakyti pats. Blokas „CDN“ jau yra paletėje kairėje nuo lentos.',
    },
    'edge-locations': {
      title: 'Arčiau naudotojo',
      body: ({ sim }) =>
        `[[cdn-1|CDN]] pats pateikia ${n(incoming(sim, 'cdn-1') * cdnStaticShare)} rps statinių failų, o iki [[lb|load balancer]] nueina tik ${n(incoming(sim, 'lb'))} rps. Kiekvienas [[app2|server]] dabar gauna ${n(incoming(sim, 'app2'))} rps vietoj 800, klaidų nebeliko, o p95 nukrito nuo daugiau nei sekundės iki ${p95(sim)}.

CDN turi server duomenų centruose visame pasaulyje. Tos vietos vadinamos **edge location** (lietuviškai – krašto vietos), arba PoP (point of presence, buvimo taškas). Naudotojas Vilniuje nuotrauką gauna iš server Vilniuje ar Varšuvoje, o ne iš jūsų duomenų centro Frankfurte ar Virdžinijoje. Atstumas kainuoja laiką: kelionė per vandenyną ir atgal net šviesolaidžiu trunka apie 100 ms, o puslapyje failų – dešimtys. Čia failas iš CDN atkeliauja per ${cdnMs} ms.

Kai mieste failo prašo pirmasis lankytojas, edge location jo dar neturi. CDN pasiims failą iš jūsų server – iš **origin** (lietuviškai – šaltinis) – ir išsaugos kopiją. Visi kiti gaus kopiją.`,
    },
    'cache-headers': {
      title: 'Cache antraštės',
      body: ({ sim }) =>
        `Iš kur CDN žino, ką galima laikyti ir kiek laiko? Tai nurodo server atsakymo antraštėje **Cache-Control**. „Cache-Control: max-age=31536000“ leidžia laikyti failą metus, „no-store“ draudžia atsakymą kur nors išsaugoti.

Kad pakeistumėte metams išsaugotą failą, suteikite jam naują vardą: surenkant projektą (build) prie failo vardo pridedama turinio maiša (hash), app.3f9c2a.js. Nauja versija – naujas vardas, o senos kopijos tiesiog niekas nebeprašo. Tai paprasčiau ir patikimiau nei prašyti CDN ištrinti failą (purge), nors ir taip galima.

Į CDN cache negalima dėti nieko, kas priklauso nuo naudotojo: krepšelio, asmeninės paskyros, kainų su asmenine nuolaida, užsakymo pateikimo ir jokių rašančių užklausų. Tokie atsakymai žymimi private arba no-store, ir CDN praleidžia juos į [[lb|load balancer]]: šioje lentoje tai likę ${percent(1 - cdnStaticShare)}, ${n(incoming(sim, 'lb'))} rps. Asmeninis puslapis bendrame cache yra blogiau nei klaida. Tai duomenų nutekėjimas: vienas naudotojas pamatytų svetimą paskyrą.`,
    },
    summary: {
      title: 'Santrauka',
      body: ({ sim }) =>
        `CDN nuima nuo sistemos statinius failus: ${percent(cdnStaticShare)} užklausų apskritai nepasiekia server blokų, o naudotojai failus gauna iš kaimyninio miesto per milisekundes. Lentoje CDN kainuoja 0,20 $ per valandą – perpus pigiau nei vienas server. Tikri CDN ima mokestį už srautą, bet pateikti failus per juos vis tiek gerokai pigiau nei iš savo server.

Dinaminėms užklausoms CDN nepadeda. Kiekviena tokia užklausa vis tiek nueina iki [[db|database]], ir ji gauna ${n(sim.databaseLoad)} rps iš 1500 galimų. Didžiąją dalį skaitymų nuo jos nuima cache iš 4 pamokos. Kai neužtenka ir jo, kitas žingsnis – **read replicas** (lietuviškai – skaitymo replikos): database kopijos, aptarnaujančios skaitymą. Tai 6 pamoka.`,
    },
  },
  annotations: {
    serverLoad: sim => `${n(incoming(sim, 'app2'))} rps iš 400 galimų`,
    serverOverload: sim =>
      `${n(incoming(sim, 'app2'))} rps · klaidos ${percent(sim.errorRate)}`,
    staticShare: sim =>
      `statiniai: ${n(incoming(sim, 'app2') * cdnStaticShare)} iš ${n(incoming(sim, 'app2'))} rps`,
    cdnServed: sim =>
      `${n(incoming(sim, 'cdn-1') * cdnStaticShare)} rps iš edge · ${cdnMs} ms`,
    serverAfter: sim => `${n(incoming(sim, 'app2'))} rps iš 400 galimų`,
    dynamicOnly: sim => `${n(incoming(sim, 'lb'))} rps · tik dinaminės`,
    dbLoad: sim => `${n(sim.databaseLoad)} rps iš ${n(1500)} galimų`,
  },
  tasks: {
    'place-cdn': {
      prompt:
        'Nuimkite statinius failus nuo server blokų: pastatykite CDN prieš load balancer.',
      goals: {
        'cdn-exists': 'Lentoje yra blokas „CDN“',
        'only-through-cdn': '„Users“ pasiekia „Load balancer“ tik per „CDN“',
        'cdn-to-lb': '„CDN“ perduoda užklausas į „Load balancer“',
        'holds-load': 'Atlaiko 2400 rps, kai klaidų mažiau nei 1 %',
        fast: 'p95 atsakas ne ilgesnis nei 250 ms, kai ateina 2400 rps',
      },
      hints: [
        'Daugiau nei pusė užklausų prašo failų, vienodų visiems. Juos galėtų pateikti kažkas prie įėjimo vietoj server blokų.',
        'Pastatykite bloką „CDN“ tarp „Users“ ir „Load balancer“. Prijunkite „Users“ prie CDN, o CDN – prie load balancer. Senas ryšys „Users → Load balancer“ turi išnykti.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite ten bloką „CDN“ ir nutieskite pažymėtus ryšius. Raudonai pažymėtas ryšys, kurį reikia ištrinti.',
      ],
      solvedNote:
        'CDN pats pateikia statinius failus, o iki server blokų nueina tik dinaminės užklausos.',
    },
  },
} satisfies LessonTexts<typeof lesson>
