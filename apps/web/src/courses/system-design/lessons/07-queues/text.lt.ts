import { Option } from 'effect'

import type { SimResult } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`
const p95 = (sim: SimResult) =>
  Option.match(sim.p95, { onNone: () => '—', onSome: ms => `${n(ms)} ms` })
const app1In = (sim: SimResult) => sim.nodes['app1']?.incoming ?? 0
const app1Load = (sim: SimResult) => sim.nodes['app1']?.utilization ?? 0

const queuePoint = `Tokia queue prasmė: workers skaičiuojami įprastai apkrovai, o ne šuoliui, o šuolį išlygina queue. Bet tik tada, jei tarp šuolių ji spėja ištuštėti. Jei apkrova ilgai viršija tai, ką spėja workers, queue auga be galo, ir padės tik nauji workers.`

export default {
  title: 'Queue ir foninis apdorojimas',
  summary:
    'Kaip iškelti lėtą darbą iš užklausos: queue, workers, queue augimas, apkrovos šuoliai ir pristatymas at-least-once.',
  steps: {
    'in-request': {
      title: 'Viskas užklausos viduje',
      body: `Internetinė parduotuvė paaugo. Užklausas iš [[users|Users]] priima du programos servers, [[app1|app1]] ir [[app2|app2]], o duomenis saugo [[db|database]]. Load balancer iš 3 pamokos lentoje nenupieštas, kad užtektų vietos: blokas „Users“ pats po lygiai paskirsto užklausas tarp servers, kaip tai darytų load balancer.

Kai pirkėjas pateikia užsakymą, server jį išsaugo, išsiunčia patvirtinimo laišką, sugeneruoja PDF sąskaitą ir tik tada atsako. Pašto paslauga atsako maždaug per sekundę, PDF generavimas apkrauna procesorių, o pirkėjas visą tą laiką žiūri į besisukantį ratuką. Toks pat darbas slepiasi nuotraukų įkėlime, registracijoje, slaptažodžio atkūrime. Šios pamokos modelyje kiekviena užklausa, kurią apdoroja server, palieka vieną tokį foninį **darbą** (job).

Kol užklausa juo užsiėmusi, server negali imti kitų, todėl spėja apie **150 rps** vietoj įprastų 400. Dabar ateina 240 rps, ir servers jau apkrauti 80 %.`,
    },
    sale: {
      title: 'Išpardavimas',
      body: `Prasidėjo išpardavimas, ir apkrova išaugo iki **500 rps**. Kiekvienas [[app1|server]] spėja savo 150 užklausų per sekundę, o likusias 100 atmeta: **40 %** pirkėjų gauna klaidą, o tiems, kuriems pasisekė, atsakymo tenka laukti ilgiau nei sekundę.

Labiausiai apmaudu, kad paspaudus mygtuką pirkėjui laiško nereikia. Jam svarbu viena: užsakymas išsaugotas. Tačiau lėtas darbas laiko užklausą, ir jam ištempti reikėtų dvigubai daugiau servers: keturių vietoj dviejų.`,
    },
    background: {
      title: 'Vėliau, fone',
      body: `Darbą, kurio naudotojas nelaukia, galima atlikti **vėliau**, fone. Perrašėme užsakymo pateikimo kodą: server išsaugo užsakymą, užrašo darbą, pavyzdžiui, „išsiųsti laišką dėl užsakymo 1042“, ir iškart atsako.

Be lėto darbo server vėl atlaiko savo 400 rps. Esant tiems patiems 500 rps, [[app1|app1]] ir [[app2|app2]] apkrauti 63 %, klaidų nėra, o p95 nukrito nuo daugiau nei sekundės iki maždaug 100 ms.

Tik darbams kol kas nėra kur dėtis: laiškų niekas nesiunčia. Reikia dar dviejų sistemos elementų.

**Queue** (lietuviškai – pranešimų eilė) – buferis, į kurį server padeda darbą ir eina toliau. Tas, kuris deda darbus į queue, vadinamas **producer** (gamintojas).

**Worker** (lietuviškai – foninis vykdytojas) – atskiras procesas, kuris ima darbus iš queue po vieną ir atlieka juos savo tempu. Tas, kuris ima darbus iš queue, vadinamas **consumer** (vartotojas): worker ir yra consumer.`,
    },
    'add-queue': {
      title: 'Užduotis: queue ir workers',
      body: `Queue ir worker jau yra paletėje kairėje nuo lentos. Worker atlieka apie **200 darbų per sekundę**, o kiekviena užklausa dabar palieka vieną darbą, tad esant 500 rps darbų irgi 500 per sekundę.

Jei workers atlieka mažiau, nei ateina, queue **auga**: užrašas ant bloko „Queue“ ir queue augimo prietaisas parodys, kiek per sekundę. Tai dar ne klaida, bet be galo auganti queue reiškia laiškus, ateinančius po kelių valandų.`,
    },
    burst: {
      title: 'Apkrovos šuolis',
      body: ({ sim }) => {
        const growth = sim.backlog
        const opening = `„Juodojo penktadienio“ rytas: dešimčiai minučių apkrova šokteli iki **700 rps**. Servers susitvarko: [[app1|app1]] apkrautas ${percent(app1Load(sim))}, klaidų nėra, o p95 išaugo tik iki ${p95(sim)}.`
        if (growth < 1) {
          return `${opening}

Jūsų workers spėja net per šuolį: kartu jie gali atlikti daugiau nei 700 darbų per sekundę, ir queue neauga. Trys workers, kurių pakanka 500 rps, atliktų 600 darbų per sekundę: queue augtų po 100 kas sekundę, ir per dešimt minučių susikauptų ${n(60000)} laiškų. Po šuolio jie juos apdorotų per dešimt minučių.

${queuePoint}`
        }
        const done = sim.load - growth
        const spare = done - 500
        const pile = growth * 600
        const drain =
          spare >= 1
            ? `Kai šuolis praeis ir apkrova grįš į 500 rps, workers turės ${n(spare)} darbų per sekundę atsargą ir susikaupusius darbus apdoros maždaug per ${n(pile / spare / 60)} min.`
            : 'Net po šuolio workers neturės atsargos, ir susikaupę darbai niekada nebus apdoroti.'
        return `${opening}

Workers atlieka ${n(done)} darbų per sekundę, o kas sekundę ateina ${n(growth)} daugiau, nei jie spėja. Queue **auga**: per dešimt minučių joje susikaups ${n(pile)} laiškų. Tai ne klaidos: nė vienas darbas neprarastas, jis tiesiog laukia, kol jį paims.

${drain} ${queuePoint}`
      },
    },
    'worker-crash': {
      title: 'Worker sugenda',
      body: ({ sim }) => {
        const growth = sim.backlog
        const meanwhile =
          growth >= 1
            ? ` Tuo metu likę workers atlieka ${n(sim.load - growth)} darbų per sekundę, o ateina ${n(sim.load)}, tad queue auga po ${n(growth)} kas sekundę. Pirkėjai to nepastebi: svetainė atsako taip pat greitai.`
            : ` Likę workers vis tiek spėja visus ${n(sim.load)} darbų per sekundę: turite atsarginį.`
        return `Šuolis praėjo, apkrova grįžo į 500 rps. Ir tada [[worker-2|worker-2]] sugenda darbo viduryje: jis paėmė užsakymą, išsiuntė laišką, bet nespėjo atsiskaityti.

Queue neištrina darbo, kai jį atiduoda. Ji laukia, kol worker atsiųs patvirtinimą, **ack** (nuo acknowledgement). Jei ack laiku neateina, darbas grįžta į queue, ir jį paima kitas worker. Tai **retry** (pakartojimas), todėl gedimas nepraranda nė vieno laiško.${meanwhile}

Pakartojimų kaina – dublikatai. Laiškas jau išsiųstas, bet be ack darbas bus atliktas antrą kartą. Queue žada pristatymą **at-least-once** („bent kartą“): kiekvienas darbas bus atliktas mažiausiai vieną kartą, o kartais du. Todėl darbas turi būti **idempotentiškas** (idempotent): pakartotinis paleidimas nieko nepakeičia. Pavyzdžiui, worker perduoda pašto paslaugai užsakymo numerį kaip **idempotency key** (idempotentiškumo raktą), ir paslauga vienam raktui išsiunčia vieną laišką, kad ir kiek kartų jos prašytų. Darbas, kuris vėl ir vėl baigiasi klaida (tarkime, tokio adreso nėra), po kelių bandymų perkeliamas į atskirą **dead-letter queue** (nepristatytų pranešimų eilę), kad netrukdytų kitiems.`
      },
    },
    summary: {
      title: 'Santrauka',
      body: `[[worker-2|worker-2]] vėl veikia, ir queue nebeauga. Jūs iškėlėte lėtą darbą iš užklausos: server išsaugo užsakymą, padeda darbą į queue ir iškart atsako, o workers fone siunčia laiškus ir generuoja sąskaitas.

Queue duoda tris dalykus. **Greitį**: naudotojas nelaukia darbo, kurio jam dabar nereikia. **Išlyginimą**: šuolis kaupiasi queue viduje, o ne perkrauna workers ir pašto paslaugą, ir po šuolio jie jį apdoroja. **Izoliaciją**: lėta pašto paslauga ar sugedęs worker neužgriauna svetainės, o darbas bus pakartotas.

Taisyklės trumpos. Workers skaičiuojami įprastai apkrovai, ir stebimas queue augimas. Darbai daromi idempotentiški, nes pristatymas – at-least-once. Queue kiekvieną darbą atiduoda **vienam** worker; 12 pamokoje sutiksime jos giminaitę – **event bus** (lietuviškai – įvykių magistralė), kuri kiekvieno pranešimo kopiją išdalija visiems prenumeratoriams. O pirmiau, 8 pamokoje, aptarsime šuolį, kuris smogia patiems servers.`,
    },
  },
  annotations: {
    slowServer: sim => `${n(app1In(sim))} iš 150 rps · laiškas ir PDF viduje`,
    saleOverload: sim =>
      `apkrova ${percent(app1Load(sim))} · klaidos ${percent(sim.errorRate)}`,
    lightServer: sim => `${n(app1In(sim))} iš 400 rps · atsako iškart`,
    burstServer: sim =>
      `${n(app1In(sim))} rps · ${percent(app1Load(sim))} · klaidos ${percent(sim.errorRate)}`,
    burstQueue: sim =>
      sim.backlog >= 1
        ? `+${n(sim.backlog)} darbų/s laukia, kol juos paims`
        : 'spėja net per šuolį',
    crashed: () => 'sugedo · jo darbas grįš į queue',
    redelivered: sim =>
      sim.backlog >= 1
        ? `+${n(sim.backlog)}/s · nė vienas darbas neprarastas`
        : 'gelbsti atsarginis worker',
    steady: sim =>
      sim.backlog >= 1
        ? `auga +${n(sim.backlog)}/s`
        : `${n(sim.load)} darbų/s · neauga`,
  },
  tasks: {
    'add-queue': {
      prompt:
        'Iškelkite lėtą darbą į queue ir pastatykite tiek workers, kad esant 500 rps queue neaugtų.',
      goals: {
        'queue-exists': 'Lentoje yra queue',
        'servers-enqueue': 'Kiekvienas server deda darbus į queue',
        'queue-has-workers': 'Queue atiduoda darbus workers',
        'no-backlog': 'Esant 500 rps queue neauga',
        'site-answers': 'Atlaiko 500 rps, kai klaidų mažiau nei 1 %',
      },
      hints: [
        'Darbams reikia vietos, kur jie palauktų, ir kažko, kas juos atliktų. Server turi tik palikti darbą ir atsakyti.',
        'Pastatykite queue dešinėje nuo servers ir sujunkite su ja app1 ir app2. Tada prijunkite prie queue blokus „Worker“: per sekundę ateina 500 darbų, o worker atlieka 200. Suskaičiuokite, kiek jų reikia.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite ten queue ir tris blokus „Worker“ ir nutieskite pažymėtus ryšius: nuo app1 ir app2 iki queue ir nuo queue iki kiekvieno worker.',
      ],
      solvedNote:
        'Servers atsako iškart, o workers spėja visus 500 darbų per sekundę: queue neauga.',
    },
  },
} satisfies LessonTexts<typeof lesson>
