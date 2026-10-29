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

const queuePoint = `Tokia eilės prasmė: vykdytojų laikoma tiek, kiek reikia įprastai apkrovai, o ne šuoliui, o šuolį eilė išlygina. Bet tik tada, jei tarp šuolių ji spėja ištuštėti. Jei apkrova ilgai viršija tai, ką spėja vykdytojai, eilė auga be galo, ir padės tik nauji vykdytojai.`

export default {
  title: 'Eilės ir foninis apdorojimas',
  summary:
    'Kaip iškelti lėtą darbą iš užklausos: eilė, vykdytojai, eilės augimas, apkrovos šuoliai ir pristatymas „bent kartą“.',
  steps: {
    'in-request': {
      title: 'Viskas užklausos viduje',
      body: `Internetinė parduotuvė paaugo. [[users|Naudotojai]] siunčia užklausas į du programos serverius, [[app1|app1]] ir [[app2|app2]], o duomenys gyvena [[db|duomenų bazėje]]. 3 pamokos balansuotuvas lentoje nenupieštas, kad užtektų vietos: blokas „Naudotojai“ pats po lygiai paskirsto užklausas serveriams, kaip tai darytų balansuotuvas.

Kai pirkėjas pateikia užsakymą, serveris jį išsaugo, išsiunčia patvirtinimo laišką, sugeneruoja PDF sąskaitą ir tik tada atsako. Pašto paslauga atsako maždaug per sekundę, PDF generavimas apkrauna procesorių, o pirkėjas visą tą laiką žiūri į besisukantį ratuką. Toks pat darbas slepiasi nuotraukų įkėlime, registracijoje, slaptažodžio atkūrime. Šios pamokos modelyje kiekviena serverio apdorota užklausa palieka vieną tokį foninį **darbą** (job).

Kol užklausa juo užsiėmusi, serveris negali imti kitų, todėl spėja apie **150 rps** vietoj įprastų 400. Dabar ateina 240 rps, ir serveriai jau apkrauti 80 %.`,
    },
    sale: {
      title: 'Išpardavimas',
      body: `Prasidėjo išpardavimas, ir apkrova išaugo iki **500 rps**. Kiekvienas [[app1|serveris]] spėja savo 150 užklausų per sekundę, o likusias 100 atmeta: **40 %** pirkėjų gauna klaidą, o tiems, kuriems pasisekė, atsakymo tenka laukti ilgiau nei sekundę.

Labiausiai apmaudu, kad paspaudus mygtuką pirkėjui laiško nereikia. Jam svarbu viena: užsakymas išsaugotas. Tačiau lėtas darbas laiko užklausą, ir jam ištempti reikėtų keturių serverių vietoj dviejų.`,
    },
    background: {
      title: 'Vėliau, fone',
      body: `Darbą, kurio naudotojas nelaukia, galima atlikti **vėliau**, fone. Perrašėme užsakymo apdorojimą: serveris išsaugo užsakymą, užrašo darbą, pavyzdžiui, „išsiųsti laišką dėl užsakymo 1042“, ir iškart atsako.

Be lėto darbo serveris vėl atlaiko savo 400 rps. Esant tiems patiems 500 rps, [[app1|app1]] ir [[app2|app2]] apkrauti 63 %, klaidų nėra, o p95 nukrito nuo daugiau nei sekundės iki maždaug 100 ms.

Tik darbams kol kas nėra kur dėtis: laiškų niekas nesiunčia. Reikia **eilės** – buferio, į kurį serveris (**gamintojas**, producer) padeda darbą ir eina toliau. Atskiri procesai, **vykdytojai** (**vartotojai**, consumers), ima darbus iš eilės po vieną ir atlieka juos savo tempu.`,
    },
    'add-queue': {
      title: 'Užduotis: eilė ir vykdytojai',
      body: `Eilė ir vykdytojas jau yra paletėje kairėje nuo lentos. Vykdytojas atlieka apie **200 darbų per sekundę**, o kiekviena užklausa dabar palieka vieną darbą, tad esant 500 rps darbų irgi 500 per sekundę.

Jei vykdytojai atlieka mažiau, nei ateina, eilė **auga**: užrašas ant eilės bloko ir prietaisas „Eilė auga“ parodys, kiek per sekundę. Tai dar ne klaida, bet be galo auganti eilė reiškia laiškus, ateinančius po kelių valandų.`,
    },
    burst: {
      title: 'Apkrovos šuolis',
      body: ({ sim }) => {
        const growth = sim.backlog
        const opening = `„Juodojo penktadienio“ rytas: dešimčiai minučių apkrova šokteli iki **700 rps**. Serveriai susitvarko: [[app1|app1]] apkrautas ${percent(app1Load(sim))}, klaidų nėra, o p95 išaugo tik iki ${p95(sim)}.`
        if (growth < 1) {
          return `${opening}

Jūsų vykdytojai spėja net per šuolį: jie gali atlikti daugiau nei 700 darbų per sekundę, ir eilė neauga. Trys vykdytojai, kurių pakanka 500 rps, atliktų 600 darbų per sekundę: eilė augtų po 100 kas sekundę, ir per dešimt minučių susikauptų ${n(60000)} laiškų. Po šuolio jie juos apdorotų per dešimt minučių.

${queuePoint}`
        }
        const done = sim.load - growth
        const spare = done - 500
        const pile = growth * 600
        const drain =
          spare >= 1
            ? `Kai šuolis praeis ir apkrova grįš į 500 rps, vykdytojai turės ${n(spare)} darbų per sekundę atsargą ir susikaupusius darbus apdoros maždaug per ${n(pile / spare / 60)} min.`
            : 'Net po šuolio vykdytojai neturės atsargos, ir susikaupę darbai niekada nebus apdoroti.'
        return `${opening}

Vykdytojai atlieka ${n(done)} darbų per sekundę, o kas sekundę ateina ${n(growth)} daugiau, nei jie spėja. Eilė **auga**: per dešimt minučių joje susikaups ${n(pile)} laiškų. Tai ne klaidos: nė vienas darbas neprarastas, jis tiesiog laukia savo eilės.

${drain} ${queuePoint}`
      },
    },
    'worker-crash': {
      title: 'Vykdytojas sugenda',
      body: ({ sim }) => {
        const growth = sim.backlog
        const meanwhile =
          growth >= 1
            ? ` Tuo metu likę vykdytojai atlieka ${n(sim.load - growth)} darbų per sekundę, o ateina ${n(sim.load)}, tad eilė auga po ${n(growth)} kas sekundę. Pirkėjai to nepastebi: svetainė atsako taip pat greitai.`
            : ` Likę vykdytojai vis tiek spėja visus ${n(sim.load)} darbų per sekundę: turite atsarginį.`
        return `Šuolis praėjo, apkrova grįžo į 500 rps. Ir tada [[worker-2|worker-2]] sugenda darbo viduryje: jis paėmė užsakymą, išsiuntė laišką, bet nespėjo atsiskaityti.

Eilė neištrina darbo, kai jį atiduoda. Ji laukia vykdytojo **patvirtinimo** (ack). Jei patvirtinimas laiku neateina, darbas grįžta į eilę, ir jį paima kitas vykdytojas. Tai **pakartojimas** (retry), todėl gedimas nepraranda nė vieno laiško.${meanwhile}

Pakartojimų kaina – dublikatai. Laiškas jau išsiųstas, bet be patvirtinimo darbas bus atliktas antrą kartą. Eilės žada pristatymą **bent kartą** (at-least-once): kiekvienas darbas bus atliktas mažiausiai vieną kartą, o kartais du. Todėl darbas turi būti **idempotentiškas**: pakartotinis paleidimas nieko nepakeičia. Pavyzdžiui, vykdytojas perduoda pašto paslaugai užsakymo numerį kaip idempotentiškumo raktą, ir paslauga vienam raktui išsiunčia vieną laišką, kad ir kiek kartų jos prašytų. Darbas, kuris vėl ir vėl baigiasi klaida (tarkime, tokio adreso nėra), po kelių bandymų perkeliamas į atskirą **nepristatytų pranešimų eilę** (dead-letter queue), kad netrukdytų kitiems.`
      },
    },
    summary: {
      title: 'Santrauka',
      body: `[[worker-2|worker-2]] vėl veikia, ir eilė nebeauga. Jūs iškėlėte lėtą darbą iš užklausos: serveris išsaugo užsakymą, padeda darbą į eilę ir iškart atsako, o vykdytojai fone siunčia laiškus ir generuoja sąskaitas.

Eilė duoda tris dalykus. **Greitį**: naudotojas nelaukia darbo, kurio jam dabar nereikia. **Išlyginimą**: šuolis kaupiasi eilėje, o ne perkrauna vykdytojus ir pašto paslaugą, ir po šuolio jie jį apdoroja. **Izoliaciją**: lėta pašto paslauga ar sugedęs vykdytojas neužgriauna svetainės, o darbas bus pakartotas.

Taisyklės trumpos. Vykdytojų laikoma tiek, kiek reikia įprastai apkrovai, ir stebimas eilės augimas. Darbai daromi idempotentiški, nes pristatymas – bent kartą. Eilė kiekvieną darbą atiduoda **vienam** vykdytojui; 12 pamokoje sutiksime jos giminaitę – **įvykių magistralę**, kuri kiekvieno pranešimo kopiją išdalija visiems prenumeratoriams. O pirmiau, 8 pamokoje, aptarsime šuolį, kuris smogia patiems serveriams.`,
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
        ? `+${n(sim.backlog)} darbų/s laukia savo eilės`
        : 'spėja net per šuolį',
    crashed: () => 'sugedo · jo darbas grįš į eilę',
    redelivered: sim =>
      sim.backlog >= 1
        ? `+${n(sim.backlog)}/s · nė vienas darbas neprarastas`
        : 'gelbsti atsarginis vykdytojas',
    steady: sim =>
      sim.backlog >= 1
        ? `auga +${n(sim.backlog)}/s`
        : `${n(sim.load)} darbų/s · neauga`,
  },
  tasks: {
    'add-queue': {
      prompt:
        'Iškelkite lėtą darbą į eilę ir pastatykite tiek vykdytojų, kad esant 500 rps eilė neaugtų.',
      goals: {
        'queue-exists': 'Lentoje yra eilė',
        'servers-enqueue': 'Abu serveriai deda darbus į eilę',
        'queue-has-workers': 'Eilė atiduoda darbus vykdytojams',
        'no-backlog': 'Esant 500 rps eilė neauga',
        'site-answers': 'Atlaiko 500 rps, kai klaidų mažiau nei 1 %',
      },
      hints: [
        'Darbams reikia vietos, kur jie palauktų, ir kažko, kas juos atliktų. Serveris turi tik palikti darbą ir atsakyti.',
        'Pastatykite eilę dešinėje nuo serverių ir sujunkite su ja app1 ir app2. Tada prijunkite prie eilės vykdytojus: per sekundę ateina 500 darbų, o vykdytojas atlieka 200. Suskaičiuokite, kiek jų reikia.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite ten eilę ir tris vykdytojus ir nutieskite pažymėtus ryšius: nuo abiejų serverių iki eilės ir nuo eilės iki kiekvieno vykdytojo.',
      ],
      solvedNote:
        'Serveriai atsako iškart, o vykdytojai spėja visus 500 darbų per sekundę: eilė neauga.',
    },
  },
} satisfies LessonTexts<typeof lesson>
