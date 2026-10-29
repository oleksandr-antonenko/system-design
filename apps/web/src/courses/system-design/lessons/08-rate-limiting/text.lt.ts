import { Option } from 'effect'

import type { SimResult } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`
const p95 = (sim: SimResult) =>
  Option.match(sim.p95, { onNone: () => '—', onSome: ms => `${n(ms)} ms` })
const incoming = (sim: SimResult, id: string) => sim.nodes[id]?.incoming ?? 0
const utilization = (sim: SimResult, id: string) =>
  sim.nodes[id]?.utilization ?? 0

export default {
  title: 'Apsauga nuo perkrovos',
  summary:
    'Ribotuvas prieš balansuotuvą: greitas atsakymas 429 vietoj perkrovos, limitai kiekvienam klientui, atgalinis slėgis ir pakartojimai be griūties.',
  steps: {
    'normal-day': {
      title: 'Įprasta diena',
      body: `Grįžkime prie parduotuvės su trimis serveriais už balansuotuvo. Kad lenta būtų paprastesnė, podėlį, CDN ir replikas iš ankstesnių pamokų pašalinome.

[[users|Naudotojai]] ateina į [[lb-1|balansuotuvą]], o jis skirsto užklausas serveriams [[app1|app1]], [[app2|app2]] ir [[app3|app3]]. Kiekvienas serveris apdoroja 400 rps, kartu jie atlaiko **1200 rps**.

Įprastą dieną ateina 600 rps. Serveriai apkrauti perpus, p95 mažesnis nei 100 ms, klaidų nėra.`,
    },
    spike: {
      title: 'Šuolis',
      body: `10 valandą prasideda išpardavimas. Nuoroda išsiųsta naujienlaiškiu, o kartu pabudo ir robotai, kurie supirkinėja nukainotas prekes. Per minutę apkrova šokteli iki **2000 rps** – gerokai daugiau nei 1200, kuriuos atlaiko serveriai.

Balansuotuvas sąžiningai daro savo darbą ir viską dalija po lygiai: kiekvienam serveriui tenka 667 rps, 167 % jo pajėgumo. Perkrauti visi iš karto. 40 % užklausų baigiasi 503 klaida, o kitos laukia: p95 beveik pusantros sekundės. Blogai aptarnaujami visi – ir robotai, ir pirkėjai.`,
    },
    cascade: {
      title: 'Grandininė reakcija',
      body: `Perkrova retai laikosi ties lygiais 40 %. Serveris, apkrautas 167 %, išnaudoja atmintį ir gijas, laiku neatsako į sveikatos patikrą, ir balansuotuvas pašalina jį iš skirstymo. Dabar [[app2|app2]] iškrito, ir jo dalis atiteko [[app1|app1]] ir [[app3|app3]]: po 1000 rps, du su puse karto daugiau nei jų pajėgumas. Jie bus kiti. Tai **kaskadinis gedimas**: vieno bloko gedimas perkrauna kitus.

Naudotojai situaciją dar pablogina. Puslapį, kuris kraunasi pusantros sekundės, jie atnaujina, o mobilioji programėlė po skirtojo laiko pabaigos pati pakartoja užklausą. Kiekvienas pakartojimas – dar viena užklausa, kuri prisideda prie šuolio. Net kai antplūdis atslūgsta, sistema gali neatsigauti savaime: paleisti iš naujo serveriai vėl griūva po susikaupusiais pakartojimais.

Išeitis skamba keistai: geriau sąmoningai atsisakyti dalies užklausų, nei bandyti aptarnauti visus ir neaptarnauti nė vieno.`,
    },
    'place-limiter': {
      title: 'Užduotis: ribotuvas',
      body: `[[app2|app2]] paleistas iš naujo, bet šuolis tęsiasi: 2000 rps.

**Ribotuvas** (rate limiter) stovi prie įėjimo ir skaičiuoja užklausas. Jis praleidžia ne daugiau nei savo limitą, o likusioms iš karto atsako **429 Too Many Requests**. Toks atsisakymas beveik nieko nekainuoja: nei serverio, nei bazės, atsakymas per milisekundę. Sąmoningas perteklinės apkrovos numetimas vadinamas **load shedding**.

Mūsų ribotuvas praleidžia 1000 rps. Tai mažiau nei 1200, kuriuos atlaiko serveriai, todėl jiems lieka atsarga ir jie atsako greitai. Ribotuvas jau paletėje: pastatykite jį tarp naudotojų ir [[lb-1|balansuotuvo]].`,
    },
    bots: {
      title: 'Kam atsakyti „ne“',
      body: ({ sim }) =>
        `Prisijungia daugiau robotų, apkrova pasiekia **3000 rps**. Palyginkite su šuoliu be ribotuvo: serveriai kaip ir anksčiau gauna po ${n(incoming(sim, 'app2'))} rps ir yra apkrauti ${percent(utilization(sim, 'app2'))}, o p95 vis dar ${p95(sim)}. Papildomas srautas pridėjo tik atsisakymų: prietaisas „Atmesta“ rodo ${n(sim.rejected)} rps. Už ribotuvo sistema elgiasi vienodai, kad ir koks didelis būtų šuolis. Paties ribotuvo juosta pilna: iš ${n(sim.load)} rps jis praleidžia lygiai savo limitą – ${n(1000)}. Tai ne gedimas: atmesti perteklių – jo darbas.

Bet vienas limitas visiems – grubus įrankis. Ribotuvui nesvarbu, kam atsakyti „ne“, todėl robotas, tūkstantį kartų per sekundę besibeldžiantis į parduotuvę, užima tikrų pirkėjų vietas. Todėl tikri ribotuvai skaičiuoja užklausas **kiekvienam klientui atskirai**: pagal IP adresą, paskyrą ar API raktą. Kiekvienas klientas gauna savo biudžetą, pavyzdžiui, 10 užklausų per sekundę su trumpais šuoliais iki 20 (algoritmas **token bucket**, „žetonų kibiras“). Pirkėjas limito nepastebi, o robotas gauna 429 viskam, kas viršija jo 10.

Mūsų lentoje yra vienas bendras limitas, ir jis saugo serverius. Limitas kiekvienam klientui saugo ir teisingumą.`,
    },
    backpressure: {
      title: '429, 503 ir pakartojimai',
      body: `Atsisakymas turi pasakyti klientui, ką daryti toliau, ir atsakymo kodas čia svarbus. **429 Too Many Requests** reiškia: būtent jūs siunčiate per daug, sulėtinkite. **503 Service Unavailable** reiškia: perkrautas ar sugedęs pats serveris, ir jūs čia niekuo dėti. Abu paprastai ateina su antrašte **Retry-After**: po kiek sekundžių galima bandyti vėl.

Mandagus klientas nekartoja užklausos iš karto. Po kiekvieno atsisakymo jis laukia vis ilgiau (1 s, 2 s, 4 s ir taip toliau – **eksponentinis atidėjimas**) ir prideda atsitiktinę sklaidą, **jitter**, kad tūkstančiai klientų negrįžtų tą pačią sekundę. Tai **atgalinis slėgis** (backpressure): signalas „lėčiau“ keliauja atgal tam, kas kuria apkrovą, ir tas jo paklauso.

Lentoje robotai atsirėmė į savo limitus, o pirkėjų programėlės sulėtino tempą. Apkrova prie įėjimo nukrito iki 1500 rps, ir ribotuvas atmeta tik 500. Be tokio atidėjimo kiekvienas atsisakymas sugrįžtų nauja užklausa, ir šuolis tik augtų.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Išpardavimas baigėsi, apkrova grįžo iki 600 rps. [[limiter-1|Ribotuvas]] praleidžia viską: įprastą dieną jo nesimato. Jis kainuoja 0,05 $ per valandą.

Palyginkite su kitu keliu – nusipirkti serverių piko apkrovai. Kad priimtumėte 2000 rps su atsarga, prireiktų septynių serverių vietoj trijų, 2,80 $ per valandą vietoj 1,20 $, ir visą likusį laiką jie stovėtų be darbo. Ir tai neišgelbėtų: [[db|bazė]] atlaiko 1500 rps, o esant 2000 pati ims prarasti užklausas. Limitas saugo ne tik serverius, bet ir viską, kas yra už jų.

Praktikoje ribotuvas gyvena **API šliuze** (API gateway) arba pačiame balansuotuve ir dirba kartu su automatiniu plėtimu: šis prideda serverių, kai apkrova auga tolygiai, o ribotuvas atlaiko staigių šuolių ir godžių klientų smūgį. 9 pamokoje aptarsime apkrovą, kuri yra ne šuolis, o tolygus rašymo augimas, su kuriuo viena bazė nebesusidoroja.`,
    },
  },
  annotations: {
    headroom: sim => `${n(sim.load)} rps · serveriai atlaiko ${n(1200)}`,
    overloaded: sim =>
      `${n(incoming(sim, 'app2'))} rps · ${percent(utilization(sim, 'app2'))} · klaidos ${percent(sim.errorRate)}`,
    crashed: sim => `nulūžo · klaidos ${percent(sim.errorRate)}`,
    survivor: sim =>
      `${n(incoming(sim, 'app1'))} rps · ${percent(utilization(sim, 'app1'))}`,
    rejecting: sim =>
      `praleidžia ${n(sim.load - sim.rejected)} · atmeta ${n(sim.rejected)} rps`,
    steady: sim =>
      `${n(incoming(sim, 'app2'))} rps · ${percent(utilization(sim, 'app2'))} · p95 ${p95(sim)}`,
    backingOff: sim => `${n(sim.load)} rps · klientai sulėtino tempą`,
    limiterCost: sim => `atmeta ${n(sim.rejected)} rps · 0,05 $/val.`,
    databaseLimit: sim => `${n(sim.databaseLoad)} rps iš ${n(1500)} galimų`,
  },
  tasks: {
    'place-limiter': {
      prompt:
        'Apsaugokite serverius nuo šuolio: įleiskite naudotojus per ribotuvą, kad praleistos užklausos sulauktų greito atsakymo.',
      goals: {
        'limiter-exists': 'Lentoje yra ribotuvas',
        'only-through-limiter':
          'Naudotojai pasiekia balansuotuvą tik per ribotuvą',
        'fast-answers': 'Esant 2000 rps, p95 ne didesnis nei 250 ms',
        'servers-headroom':
          'Esant 2000 rps, serveriai apkrauti ne daugiau nei 90 %',
      },
      hints: [
        'Serveriai neatlaiko 2000 rps. Prieš juos turi stovėti kažkas, kas sprendžia, kiek užklausų įleisti.',
        'Pastatykite ribotuvą tarp naudotojų ir balansuotuvo: Naudotojai → Ribotuvas → Balansuotuvas. Tiesioginį ryšį „Naudotojai → Balansuotuvas“ ištrinkite, kitaip pusė srauto eis aplink ribotuvą.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite ribotuvą ten ir nutieskite pažymėtus ryšius. Raudonai pažymėtas ryšys, kurį reikia ištrinti.',
      ],
      solvedNote:
        'Ribotuvas praleidžia į serverius 1000 rps, o likusioms greitai atsako 429 dar prie įėjimo.',
    },
  },
} satisfies LessonTexts<typeof lesson>
