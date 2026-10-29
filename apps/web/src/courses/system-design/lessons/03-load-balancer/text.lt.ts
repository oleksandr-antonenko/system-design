import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`

export default {
  title: 'Apkrovos balansavimas',
  summary:
    'Horizontalus plėtimas: keli serveriai už vieno įėjimo taško, sveikatos patikra ir N+1 taisyklė.',
  steps: {
    'one-server': {
      title: 'Vienas serveris',
      body: `Internetinė parduotuvė prasideda paprastai. [[users|Naudotojai]] siunčia užklausas į vieną [[app1|programos serverį]], o jis skaito ir rašo duomenis į [[db|duomenų bazę]].

M dydžio serveris apdoroja apie **400 užklausų per sekundę**, trumpai rps. Dabar ateina 300. Apkrovos juosta po serveriu žalia, ir visi taškai pasiekia tikslą.`,
    },
    overload: {
      title: 'Išpardavimas',
      body: `Prasidėjo išpardavimas, ir apkrova išaugo iki **900 rps**. [[app1|Serveris]] spėja apdoroti savo 400 užklausų, o likusias atmeta. Raudoni taškai – tai naudotojai, gavę 503 klaidą.

Atsako laikas pablogėja dar prieš apkrovai pasiekiant 100 %. Jau virš 80 % užklausos laukia eilėje, ir rodiklis p95 (laikas, per kurį atsakoma į 95 % užklausų) auga greičiau nei apkrova.`,
    },
    'scale-out': {
      title: 'Aukštyn ar į plotį',
      body: `Galima nusipirkti galingesnį serverį. Tai **vertikalus plėtimas**. Jis paprastas, bet turi lubas, kaina auga greičiau nei galia, o serveris lieka vienintelis gedimo taškas.

Kitas kelias – **horizontalus plėtimas**: paleisti kelis vienodus serverius. Pridėjome [[app2|app2]] ir [[app3|app3]]. Jie prijungti prie bazės, bet stovi be darbo, nes naudotojai žino tik [[app1|app1]] adresą.`,
    },
    'place-lb': {
      title: 'Užduotis: balansuotuvas',
      body: 'Reikia tarpininko su vienu adresu, kuris priima visas užklausas ir skirsto jas serveriams. Tai **apkrovos balansuotuvas**, ir jis jau atsirado paletėje kairėje nuo lentos.',
    },
    'server-down': {
      title: 'Kai serveris sugenda',
      body: ({ sim, doc }) => {
        const alive = doc.nodes.filter(
          node =>
            node.kind === 'server' &&
            !doc.failed.includes(node.id) &&
            (sim.nodes[node.id]?.incoming ?? 0) > 0,
        )
        const share = alive.length > 0 ? sim.load / alive.length : 0
        return `Balansuotuvas skirsto užklausas **paeiliui** (round-robin): pirma užklausa keliauja į vieną serverį, antra – į kitą ir taip toliau.

Dabar [[app2|app2]] sugedo. Balansuotuvas kas kelias sekundes apklausia serverius. Tai **sveikatos patikra** (health check): neatsakęs serveris pašalinamas iš skirstymo. Jo dalį perima likę serveriai, ir dabar kiekvienas gauna ${n(share)} rps. ${share > 400 ? 'Tai daugiau nei jų 400 rps, todėl dalis užklausų vėl prarandama.' : 'Jie susitvarko, nes turite atsarginį serverį.'}

Iš čia **N+1** taisyklė: serverių turi užtekti didžiausiai apkrovai net be vieno iš jų.`
      },
    },
    summary: {
      title: 'Santrauka',
      body: `Serveriai be būsenos kartu su balansuotuvu suteikia horizontalų plėtimą. Norint atlaikyti didesnę apkrovą, pakanka pridėti dar vieną serverį už balansuotuvo.

Tačiau visi serveriai kreipiasi į tą pačią [[db|duomenų bazę]], ir ji taps kitu siauru kakleliu. 4 pamokoje prieš ją pastatysime **podėlį** (cache).`,
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
    databaseLoad: sim => `${n(sim.databaseLoad)} rps iš visų serverių`,
  },
  tasks: {
    'place-lb': {
      prompt:
        'Padarykite taip, kad visos naudotojų užklausos būtų paskirstomos trims serveriams.',
      goals: {
        'lb-exists': 'Lentoje yra balansuotuvas',
        'lb-fans-out': 'Balansuotuvas veda į tris serverius',
        'only-through-lb': 'Naudotojai kreipiasi tik per balansuotuvą',
        'holds-load': 'Atlaiko 900 rps, kai klaidų mažiau nei 1 %',
      },
      hints: [
        'Naudotojai turi kreiptis ne į serverį, o į vieną „įėjimą“ į sistemą.',
        'Pastatykite balansuotuvą tarp naudotojų ir serverių. Senas ryšys „Naudotojai → app1“ turi išnykti.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite balansuotuvą ten ir nutieskite pažymėtus ryšius. Raudonai pažymėtas ryšys, kurį reikia ištrinti.',
      ],
      solvedNote:
        'Visos užklausos eina per balansuotuvą, nė vienas serveris neperkrautas.',
    },
  },
} satisfies LessonTexts<typeof lesson>
