import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`

export default {
  title: 'Load balancer',
  summary:
    'Horizontalus plėtimas: keli „Server“ blokai už vieno įėjimo taško, health check ir N+1 taisyklė.',
  steps: {
    'one-server': {
      title: 'Vienas server',
      body: `Internetinė parduotuvė prasideda paprastai. [[users|Users]] siunčia užklausas į vieną [[app1|server]], o jis skaito ir rašo duomenis į [[db|database]].

M dydžio server apdoroja apie **400 užklausų per sekundę**, trumpai rps. Dabar ateina 300. Apkrovos juosta bloko apačioje žalia, ir visi taškai pasiekia tikslą.`,
    },
    overload: {
      title: 'Išpardavimas',
      body: `Prasidėjo išpardavimas, ir apkrova išaugo iki **900 rps**. [[app1|Server]] spėja apdoroti savo 400 užklausų, o likusias atmeta. Raudoni taškai – tai naudotojai, gavę 503 klaidą.

Atsako laikas pablogėja dar prieš apkrovai pasiekiant 100 %. Jau virš 80 % užklausos laukia eilėje, ir rodiklis p95 (laikas, per kurį atsakoma į 95 % užklausų) auga greičiau nei apkrova.`,
    },
    'scale-out': {
      title: 'Aukštyn ar į plotį',
      body: `Galima nusipirkti galingesnį server. Tai **vertikalus plėtimas** (vertical scaling). Jis paprastas, bet turi lubas, kaina auga greičiau nei galia, o server lieka single point of failure.

Kitas kelias – **horizontalus plėtimas** (horizontal scaling): paleisti kelis vienodus „Server“ blokus. Pridėjome [[app2|app2]] ir [[app3|app3]]. Jie prijungti prie database, bet stovi be darbo, nes users žino tik [[app1|app1]] adresą.`,
    },
    'place-lb': {
      title: 'Užduotis: load balancer',
      body: '**Load balancer** (lietuviškai – apkrovos balansavimo priemonė) – tarpininkas su vienu adresu: priima visas užklausas ir skirsto jas tarp server. Būtent tokios priemonės dabar reikia, ir blokas „Load balancer“ jau atsirado paletėje kairėje nuo lentos.',
    },
    'server-down': {
      title: 'Kai server sugenda',
      body: ({ sim, doc }) => {
        const alive = doc.nodes.filter(
          node =>
            node.kind === 'server' &&
            !doc.failed.includes(node.id) &&
            (sim.nodes[node.id]?.incoming ?? 0) > 0,
        )
        const share = alive.length > 0 ? sim.load / alive.length : 0
        return `Load balancer skirsto užklausas **paeiliui** (round-robin): pirma užklausa keliauja į vieną server, antra – į kitą ir taip toliau.

Dabar [[app2|app2]] sugedo. Load balancer kas kelias sekundes apklausia kiekvieną server. Tai **health check** (lietuviškai – sveikatos patikra): neatsakęs server pašalinamas iš skirstymo. Jo dalį perima likę server, ir dabar kiekvienas gauna ${n(share)} rps. ${share > 400 ? 'Tai daugiau nei jų 400 rps, todėl dalis užklausų vėl prarandama.' : 'Jie susitvarko, nes turite atsarginį server.'}

Iš čia **N+1** taisyklė: blokų „Server“ turi užtekti didžiausiai apkrovai net sugedus vienam iš jų.`
      },
    },
    summary: {
      title: 'Santrauka',
      body: `Stateless server kartu su load balancer suteikia horizontalų plėtimą. Norint atlaikyti didesnę apkrovą, pakanka pridėti dar vieną server už load balancer.

Tačiau visi „Server“ blokai kreipiasi į tą pačią [[db|database]], ir ji taps kitu siauru kakleliu. 4 pamokoje prieš ją pastatysime **cache** (lietuviškai – podėlis, greita atmintis dažnai skaitomiems duomenims).`,
    },
  },
  annotations: {
    app1Load: sim => `${n(sim.nodes['app1']?.incoming ?? 0)} rps iš 400 galimų`,
    app1Overload: sim =>
      `apkrova ${percent(sim.nodes['app1']?.utilization ?? 0)} · klaidos ${percent(sim.errorRate)}`,
    idle: () => '0 rps · stovi be darbo',
    excluded: () => 'app2 neatsako → pašalintas',
    survivorLoad: sim =>
      `${n(sim.nodes['app1']?.incoming ?? 0)} rps · ${percent(sim.nodes['app1']?.utilization ?? 0)}`,
    databaseLoad: sim => `${n(sim.databaseLoad)} rps iš visų „Server“ blokų`,
  },
  tasks: {
    'place-lb': {
      prompt:
        'Padarykite taip, kad visos užklausos iš „Users“ būtų paskirstomos tarp trijų blokų „Server“.',
      goals: {
        'lb-exists': 'Lentoje yra blokas „Load balancer“',
        'lb-fans-out': 'Blokas „Load balancer“ veda į tris „Server“',
        'only-through-lb': '„Users“ kreipiasi tik per „Load balancer“',
        'holds-load': 'Atlaiko 900 rps, kai klaidų mažiau nei 1 %',
      },
      hints: [
        '„Users“ turi kreiptis ne į server, o į vieną „įėjimą“ į sistemą.',
        'Pastatykite bloką „Load balancer“ tarp „Users“ ir blokų „Server“. Senas ryšys „Users → app1“ turi išnykti.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite ten bloką „Load balancer“ ir nutieskite pažymėtus ryšius. Raudonai pažymėtas ryšys, kurį reikia ištrinti.',
      ],
      solvedNote:
        'Visos užklausos eina per load balancer, nė vienas server neperkrautas.',
    },
  },
} satisfies LessonTexts<typeof lesson>
