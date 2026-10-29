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
    'Statinis ir dinaminis turinys, krašto serveriai ir podėliavimo antraštės: kaip pateikti paveikslėlius ir skriptus arčiau naudotojo.',
  steps: {
    'shop-front': {
      title: 'Įėjimas į parduotuvę',
      body: `Grįžkime prie internetinės parduotuvės. [[users|Naudotojai]] per [[lb|balansuotuvą]] patenka į tris serverius – [[app1|app1]], [[app2|app2]] ir [[app3|app3]], o serveriai dirba su [[db|duomenų baze]]. Kad prie įėjimo liktų vietos, podėlis iš 4 pamokos šioje lentoje nerodomas.

Dabar ateina 900 rps, po 300 kiekvienam serveriui. Tai 75 % pajėgumo: atsarga nedidelė, bet klaidų nėra.`,
    },
    'photo-catalog': {
      title: 'Katalogas su nuotraukomis',
      body: `Parduotuvė paleidžia naują katalogą: didelės prekių nuotraukos, galerija kiekviename puslapyje, naujas dizainas su sunkiais skriptais. Kartu su reklamos kampanija apkrova išauga iki **2400 rps**.

Kiekvienas [[app2|serveris]] gauna 800 rps – dvigubai daugiau, nei pajėgia. Pusė užklausų prarandama: tai raudoni taškai ant ryšių ir 50 % prietaise „Klaidos“. Tie, kuriems pasisekė, atsakymo laukia ilgiau nei sekundę.`,
    },
    'static-files': {
      title: 'Kuo užsiėmę serveriai',
      body: `Atidarykite bet kurį puslapį ir pažiūrėkite, ką atsisiunčia naršyklė. Viena užklausa grąžina HTML su preke ir kaina. Po jos – dar dešimtys: nuotraukos, šriftai, skriptai, stiliai. Tai **statiniai failai**: jie vienodi visiems lankytojams ir retai keičiasi. Puslapis su jūsų krepšeliu, jūsų kaina ir dabartiniu likučiu yra **dinaminis**: jis sudaromas iš naujo kiekvienai užklausai.

Šiame kurse ${percent(cdnStaticShare)} užklausų – statiniai failai. Vadinasi, iš 800 rps [[app2|kiekviename serveryje]] 480 tik dalija paruoštus failus. Didžiąją dalį jėgų serveriai eikvoja veikdami kaip failų saugykla.

Statiniams failams programos visai nereikia. Juos gali pateikti **CDN** (content delivery network, turinio pristatymo tinklas): podėliuojančių serverių tinklas šimtuose miestų. CDN stovi prieš jūsų sistemą, statinius failus atiduoda iš savo kopijų, o toliau praleidžia tik dinamines užklausas.`,
    },
    'place-cdn': {
      title: 'Užduotis: CDN',
      body: 'CDN statomas pačiame įėjime, prieš [[lb|balansuotuvą]]. Naudotojai kreipiasi tik į CDN, o jis toliau perduoda tai, į ką negali atsakyti pats. CDN jau yra paletėje kairėje nuo lentos.',
    },
    'edge-locations': {
      title: 'Arčiau naudotojo',
      body: ({ sim }) =>
        `[[cdn-1|CDN]] pats pateikia ${n(incoming(sim, 'cdn-1') * cdnStaticShare)} rps statinių failų, ir [[lb|balansuotuvą]] pasiekia tik ${n(incoming(sim, 'lb'))} rps. Kiekvienas [[app2|serveris]] dabar gauna ${n(incoming(sim, 'app2'))} rps vietoj 800, klaidų nebeliko, o p95 nukrito nuo daugiau nei sekundės iki ${p95(sim)}.

CDN serveriai stovi duomenų centruose visame pasaulyje. Jie vadinami **krašto serveriais** (edge), arba buvimo taškais (PoP). Naudotojas Vilniuje nuotrauką gauna iš serverio Vilniuje ar Varšuvoje, o ne iš jūsų duomenų centro Frankfurte ar Virdžinijoje. Atstumas kainuoja laiką: kelionė per vandenyną ir atgal net šviesolaidžiu trunka apie 100 ms, o puslapyje failų – dešimtys. Čia failas iš CDN atkeliauja per ${cdnMs} ms.

Pirmasis lankytojas mieste failo krašto serveryje dar neras. CDN pasiims jį iš jūsų serverių, iš **šaltinio** (origin), ir išsaugos kopiją. Visi kiti gaus kopiją.`,
    },
    'cache-headers': {
      title: 'Podėliavimo antraštės',
      body: ({ sim }) =>
        `Iš kur CDN žino, ką galima laikyti ir kiek laiko? Tai nurodo serveris atsakymo antraštėje **Cache-Control**. „Cache-Control: max-age=31536000“ leidžia laikyti failą metus, „no-store“ draudžia atsakymą kur nors išsaugoti.

Kad pakeistumėte metams išsaugotą failą, suteikite jam naują vardą: surenkant projektą (build) prie failo vardo pridedama turinio maiša (hash), app.3f9c2a.js. Nauja versija – naujas vardas, o senos kopijos tiesiog niekas nebeprašo. Tai paprasčiau ir patikimiau nei prašyti CDN ištrinti failą, nors ir taip galima.

Į CDN podėlį negalima dėti nieko, kas priklauso nuo naudotojo: krepšelio, asmeninės paskyros, kainų su asmenine nuolaida, užsakymo pateikimo ir jokių rašančių užklausų. Tokie atsakymai žymimi private arba no-store, ir CDN praleidžia juos į [[lb|balansuotuvą]]: šioje lentoje tai likę ${percent(1 - cdnStaticShare)}, ${n(incoming(sim, 'lb'))} rps. Asmeninis puslapis bendrame podėlyje yra blogiau nei klaida. Tai duomenų nutekėjimas: vienas naudotojas pamatytų svetimą paskyrą.`,
    },
    summary: {
      title: 'Santrauka',
      body: ({ sim }) =>
        `CDN nuima nuo sistemos statinius failus: ${percent(cdnStaticShare)} užklausų apskritai nepasiekia serverių, o naudotojai failus gauna iš kaimyninio miesto per milisekundes. Lentoje CDN kainuoja 0,20 $ per valandą – perpus pigiau nei vienas serveris. Tikri CDN ima mokestį už srautą, bet pateikti failus per juos vis tiek gerokai pigiau nei iš savo serverių.

Dinaminėms užklausoms CDN nepadeda. Kiekviena tokia užklausa vis tiek pasiekia [[db|bazę]], ir ji gauna ${n(sim.databaseLoad)} rps iš 1500 galimų. Didžiąją dalį skaitymų nuo jos nuima podėlis iš 4 pamokos. Kai neužtenka ir jo, kitas žingsnis – **replikos**: bazės kopijos, aptarnaujančios skaitymą. Tai 6 pamoka.`,
    },
  },
  annotations: {
    serverLoad: sim => `${n(incoming(sim, 'app2'))} rps iš 400 galimų`,
    serverOverload: sim =>
      `${n(incoming(sim, 'app2'))} rps · klaidos ${percent(sim.errorRate)}`,
    staticShare: sim =>
      `statiniai: ${n(incoming(sim, 'app2') * cdnStaticShare)} iš ${n(incoming(sim, 'app2'))} rps`,
    cdnServed: sim =>
      `${n(incoming(sim, 'cdn-1') * cdnStaticShare)} rps iš krašto · ${cdnMs} ms`,
    serverAfter: sim => `${n(incoming(sim, 'app2'))} rps iš 400 galimų`,
    dynamicOnly: sim => `${n(incoming(sim, 'lb'))} rps · tik dinaminės`,
    dbLoad: sim => `${n(sim.databaseLoad)} rps iš ${n(1500)} galimų`,
  },
  tasks: {
    'place-cdn': {
      prompt:
        'Nuimkite statinius failus nuo serverių: pastatykite CDN prieš balansuotuvą.',
      goals: {
        'cdn-exists': 'Lentoje yra CDN',
        'only-through-cdn': 'Naudotojai pasiekia balansuotuvą tik per CDN',
        'cdn-to-lb': 'CDN perduoda užklausas balansuotuvui',
        'holds-load': 'Atlaiko 2400 rps, kai klaidų mažiau nei 1 %',
        fast: 'p95 atsakas ne ilgesnis nei 250 ms, kai ateina 2400 rps',
      },
      hints: [
        'Daugiau nei pusė užklausų prašo failų, vienodų visiems. Juos galėtų pateikti kažkas prie įėjimo vietoj serverių.',
        'Pastatykite CDN tarp naudotojų ir balansuotuvo. Prijunkite naudotojus prie CDN, o CDN – prie balansuotuvo. Senas ryšys „Naudotojai → Balansuotuvas“ turi išnykti.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite CDN ten ir nutieskite pažymėtus ryšius. Raudonai pažymėtas ryšys, kurį reikia ištrinti.',
      ],
      solvedNote:
        'CDN pats pateikia statinius failus, o serverius pasiekia tik dinaminės užklausos.',
    },
  },
} satisfies LessonTexts<typeof lesson>
