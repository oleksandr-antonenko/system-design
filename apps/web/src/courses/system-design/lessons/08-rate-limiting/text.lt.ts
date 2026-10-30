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
  title: 'Rate limiter. Apsauga nuo perkrovos',
  summary:
    'Rate limiter prieš load balancer: greitas atsakymas 429 vietoj perkrovos, limitai kiekvienam klientui, backpressure ir retries be griūties.',
  steps: {
    'normal-day': {
      title: 'Įprasta diena',
      body: `Grįžkime prie parduotuvės, kurioje už load balancer stovi trys „Server“ blokai. Kad lenta būtų paprastesnė, cache, CDN ir read replicas iš ankstesnių pamokų pašalinome.

[[users|Users]] ateina į [[lb-1|load balancer]], o jis skirsto užklausas į [[app1|app1]], [[app2|app2]] ir [[app3|app3]]. Kiekvienas server apdoroja 400 rps, kartu jie atlaiko **1200 rps**.

Įprastą dieną ateina 600 rps. Servers apkrauti perpus, p95 mažesnis nei 100 ms, klaidų nėra.`,
    },
    spike: {
      title: 'Šuolis',
      body: `10 valandą prasideda išpardavimas. Nuoroda išsiųsta naujienlaiškiu, o kartu pabudo ir robotai, kurie supirkinėja nukainotas prekes. Per minutę apkrova šokteli iki **2000 rps** – gerokai daugiau nei 1200, kuriuos atlaiko servers.

Load balancer sąžiningai daro savo darbą ir viską dalija po lygiai: kiekvienam server tenka 667 rps, 167 % jo pajėgumo. Perkrauti visi iš karto. 40 % užklausų baigiasi 503 klaida, o kitos laukia: p95 beveik pusantros sekundės. Blogai aptarnaujami visi – ir robotai, ir pirkėjai.`,
    },
    cascade: {
      title: 'Grandininė reakcija',
      body: `Perkrova retai laikosi ties lygiais 40 %. Server, apkrautas 167 %, išnaudoja atmintį ir gijas, laiku neatsako į health check, ir load balancer pašalina jį iš skirstymo. Dabar [[app2|app2]] iškrito, ir jo dalis atiteko [[app1|app1]] ir [[app3|app3]]: po 1000 rps, du su puse karto daugiau nei jų pajėgumas. Jie bus kiti. Tai **kaskadinis gedimas** (cascading failure): vieno bloko gedimas perkrauna kitus.

Naudotojai situaciją dar pablogina. Puslapį, kuris kraunasi pusantros sekundės, jie atnaujina, o mobilioji programėlė po skirtojo laiko pabaigos pati pakartoja užklausą. Kiekvienas toks **retry** (pakartojimas) – dar viena užklausa, kuri prisideda prie šuolio. Net kai antplūdis atslūgsta, sistema gali neatsigauti savaime: paleisti iš naujo servers vėl griūva, kai juos užgriūva susikaupę retries.

Išeitis skamba keistai: geriau sąmoningai atsisakyti dalies užklausų, nei bandyti aptarnauti visus ir neaptarnauti nė vieno.`,
    },
    'place-limiter': {
      title: 'Užduotis: rate limiter',
      body: `[[app2|app2]] paleistas iš naujo, bet šuolis tęsiasi: 2000 rps.

**Rate limiter** (lietuviškai – užklausų dažnio ribotuvas) – blokas prie įėjimo, kuris skaičiuoja užklausas. Jis praleidžia ne daugiau nei savo limitą, **rate limit**, o likusioms iš karto atsako **429 Too Many Requests** („per daug užklausų“). Toks atsisakymas beveik nieko nekainuoja: nereikia nei server, nei database, atsakymas per milisekundę. Sąmoningas perteklinės apkrovos numetimas vadinamas **load shedding**.

Mūsų rate limiter praleidžia 1000 rps. Tai mažiau nei 1200, kuriuos atlaiko servers, todėl jiems lieka atsarga ir jie atsako greitai. Rate limiter jau paletėje: pastatykite jį tarp [[users|Users]] ir [[lb-1|load balancer]].`,
    },
    bots: {
      title: 'Kam atsakyti „ne“',
      body: ({ sim }) =>
        `Prisijungia daugiau robotų, apkrova pasiekia **3000 rps**. Palyginkite su šuoliu be rate limiter: servers kaip ir anksčiau gauna po ${n(incoming(sim, 'app2'))} rps ir yra apkrauti ${percent(utilization(sim, 'app2'))}, o p95 vis dar ${p95(sim)}. Papildomas srautas pridėjo tik atsisakymų: atmestų užklausų prietaisas rodo ${n(sim.rejected)} rps. Už rate limiter sistema elgiasi vienodai, kad ir koks didelis būtų šuolis. Bloko „Rate limiter“ juosta pilna: iš ${n(sim.load)} rps jis praleidžia lygiai savo limitą – ${n(1000)}. Tai ne gedimas: atmesti perteklių – jo darbas.

Bet vienas limitas visiems – grubus įrankis. Rate limiter nesirenka, kam atsakyti „ne“, todėl robotas, tūkstantį kartų per sekundę besibeldžiantis į parduotuvę, užima tikrų pirkėjų vietas. Todėl tikri rate limiters skaičiuoja užklausas **kiekvienam klientui atskirai** (per client): pagal IP adresą, paskyrą ar API raktą. Kiekvienas klientas gauna savo biudžetą, pavyzdžiui, 10 užklausų per sekundę su trumpais šuoliais iki 20 (algoritmas **token bucket**, „žetonų kibiras“). Pirkėjas limito nepastebi, o robotas gauna 429 viskam, kas viršija jo 10.

Mūsų lentoje yra vienas bendras limitas, ir jis saugo servers. Limitas kiekvienam klientui saugo ir teisingumą.`,
    },
    backpressure: {
      title: '429, 503 ir retries',
      body: `Atsisakymas turi pasakyti klientui, ką daryti toliau, ir atsakymo kodas čia svarbus. **429 Too Many Requests** reiškia: būtent jūs siunčiate per daug, sulėtinkite. **503 Service Unavailable** („paslauga nepasiekiama“) reiškia: perkrautas ar sugedęs pats server, ir jūs čia niekuo dėti. Abu paprastai ateina su antrašte **Retry-After**: po kiek sekundžių galima bandyti vėl.

Mandagus klientas nedaro retry iš karto. Po kiekvieno atsisakymo jis laukia vis ilgiau (1 s, 2 s, 4 s ir taip toliau – **exponential backoff**, eksponentinis atidėjimas) ir prideda atsitiktinę sklaidą, **jitter**, kad tūkstančiai klientų negrįžtų tą pačią sekundę. Tai **backpressure** (atgalinis slėgis): signalas „lėčiau“ keliauja atgal tam, kas kuria apkrovą, ir tas jo paklauso.

Lentoje robotai atsirėmė į savo limitus, o pirkėjų programėlės sulėtino tempą. Apkrova prie įėjimo nukrito iki 1500 rps, ir rate limiter atmeta tik 500. Be backoff kiekvienas atsisakymas sugrįžtų nauja užklausa, ir šuolis tik augtų.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Išpardavimas baigėsi, apkrova grįžo iki 600 rps. [[limiter-1|Rate limiter]] praleidžia viską: įprastą dieną jo nesimato. Jis kainuoja 0,05 $ per valandą.

Palyginkite su kitu keliu – nusipirkti servers piko apkrovai. Kad priimtumėte 2000 rps su atsarga, prireiktų septynių „Server“ blokų vietoj trijų, 2,80 $ per valandą vietoj 1,20 $, ir visą likusį laiką jie stovėtų be darbo. Ir tai neišgelbėtų: [[db|database]] atlaiko 1500 rps, o esant 2000 pati ims prarasti užklausas. Limitas saugo ne tik servers, bet ir viską, kas yra už jų.

Praktikoje rate limiter būna **API gateway** (API šliuzo) dalis arba jį turi pats load balancer, ir jis dirba kartu su **autoscaling** (automatiniu plėtimu): autoscaling prideda servers, kai apkrova auga tolygiai, o rate limiter atlaiko staigių šuolių ir godžių klientų smūgį. 9 pamokoje aptarsime apkrovą, kuri yra ne šuolis, o tolygus rašymo augimas, su kuriuo viena database nebesusidoroja.`,
    },
  },
  annotations: {
    headroom: sim => `${n(sim.load)} rps · servers atlaiko ${n(1200)}`,
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
        'Apsaugokite servers nuo šuolio: įleiskite Users per rate limiter, kad praleistos užklausos sulauktų greito atsakymo.',
      goals: {
        'limiter-exists': 'Lentoje yra rate limiter',
        'only-through-limiter':
          'Users pasiekia load balancer tik per rate limiter',
        'fast-answers': 'Esant 2000 rps, p95 ne didesnis nei 250 ms',
        'servers-headroom':
          'Esant 2000 rps, servers apkrauti ne daugiau nei 90 %',
      },
      hints: [
        'Servers neatlaiko 2000 rps. Prieš juos turi stovėti kažkas, kas sprendžia, kiek užklausų įleisti.',
        'Pastatykite rate limiter tarp Users ir load balancer: Users → Rate limiter → Load balancer. Tiesioginį ryšį „Users → Load balancer“ ištrinkite, kitaip pusė srauto eis aplink rate limiter.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite rate limiter ten ir nutieskite pažymėtus ryšius. Raudonai pažymėtas ryšys, kurį reikia ištrinti.',
      ],
      solvedNote:
        'Rate limiter praleidžia į servers 1000 rps, o likusioms greitai atsako 429 dar prie įėjimo.',
    },
  },
} satisfies LessonTexts<typeof lesson>
