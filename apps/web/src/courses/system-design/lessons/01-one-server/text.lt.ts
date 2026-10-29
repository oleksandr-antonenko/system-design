import { Option } from 'effect'

import type { SimResult } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`
const p95 = (sim: SimResult) =>
  Option.match(sim.p95, { onNone: () => '—', onSome: ms => `${n(ms)} ms` })
const utilization = (sim: SimResult) => sim.nodes['app1']?.utilization ?? 0

export default {
  title: 'Vienas serveris',
  summary:
    'Užklausa ir atsakymas, RPS, delsa, vieno serverio pajėgumo riba ir vienintelis gedimo taškas.',
  steps: {
    'no-answer': {
      title: 'Užklausos be atsakymo',
      body: `Šalia šio teksto yra **lenta** su sistemos schema. Schema gyva: ryšiais tarp blokų keliauja užklausos, o prietaisai po lenta matuoja, kas vyksta. Kol kas lenta seka tekstą, o užduotyse ji bus jūsų.

Dabar lentoje yra vienas **blokas**: [[users|naudotojai]]. Tai žmonės, kurie atidaro jūsų svetainę. Kiekvienas veiksmas naršyklėje per internetą siunčia **užklausą**, ir žmogus laukia **atsakymo**. Užklausų skaičius per sekundę vadinamas **apkrova**, trumpai rps (requests per second). Dabar ateina 100 rps.

Nėra kam atsakyti, todėl visos užklausos prarandamos. Raudoni taškai po bloku – tai prarastos užklausos, o prietaisas „Klaidos“ rodo 100 %.`,
    },
    'place-server': {
      title: 'Užduotis: serveris',
      body: `Į užklausas atsakys **serveris**: kompiuteris, kuriame veikia jūsų programos kodas. Jis priima užklausą, atlieka darbą (suranda prekę, išsaugo užsakymą) ir išsiunčia atsakymą.

Nuvilkite serverį iš paletės į lentą. Tada sujunkite blokus: tempkite nuo apskritimo dešiniajame [[users|naudotojų bloko]] krašte ir atleiskite virš serverio. Rodyklė rodo, kur keliauja užklausos, o atsakymas grįžta tuo pačiu ryšiu.

Kai schema bus paruošta, spauskite „Tikrinti“. Jei įstrigsite, padės užuominos.`,
    },
    'reading-the-board': {
      title: 'Kaip skaityti lentą',
      body: ({ sim, doc }) => {
        const busy = doc.nodes.filter(
          node =>
            node.kind === 'server' && (sim.nodes[node.id]?.incoming ?? 0) > 0,
        )
        return `Svetainė auga: apkrova pakilo iki 200 rps. Žali taškai ant ryšio – tai užklausos, kurias serveris apdorojo. Kuo tankesnis srautas, tuo daugiau taškų.

Po [[app1|serverio]] pavadinimu yra du skaičiai: kiek užklausų į jį ateina ir kokią savo **pajėgumo** dalį jis naudoja. Šiame kurse serveris apdoroja apie 400 rps, todėl 200 rps – tai 50 %. Tą pačią dalį rodo apkrovos juosta bloko apačioje.

Prietaisai po lenta rodo visą sistemą. „Apkrova“ – kiek užklausų atėjo, „Klaidos“ – kokia jų dalis prarasta. **p95** – laikas, per kurį atsakymą gauna 95 % užklausų. Vidurkis paslepia lėtus atsakymus, o p95 parodo, ką mato beveik visi naudotojai. „Kaina“ – kiek kainuoja visų blokų darbo valanda; serveris kainuoja 0,40 $ per valandą.${
          busy.length > 1
            ? `

Jūsų lentoje srautą gauna keli serveriai, todėl apkrova pasiskirsto tarp jų. Toliau pamokoje kalbama apie vieną serverį, tad jūsų skaičiai bus geresni nei tekste. Kaip paskirstyti užklausas keliems serveriams, aptarsime 3 pamokoje.`
            : ''
        }`
      },
    },
    'near-limit': {
      title: 'Beveik ties riba',
      body: `Apkrova išaugo iki 360 rps. Klaidų dar nėra: [[app1|serveris]] apkrautas 90 % ir spėja. Bet pažiūrėkite į p95: palyginti su ankstesniu žingsniu, jis išaugo kelis kartus, nors apkrova net nepadvigubėjo. Taškai ant ryšio pageltonavo: blokas beveik ties riba.

Užklausos ateina netolygiai. Kol serveris užimtas viena užklausa, kita laukia **eilėje**. Kai serveris apkrautas 50 %, eilė susidaro retai, o kai 90 % – beveik kiekviena užklausa ko nors laukia. Todėl delsa pradeda augti gerokai anksčiau, nei apkrova pasiekia 100 %, ir serveriai laikomi su **atsarga**: piko metu apkrova paprastai neviršija 70–80 %.`,
    },
    overload: {
      title: 'Perkrova',
      body: `Prasidėjo reklamos kampanija, ir apkrova šoktelėjo iki **600 rps**. [[app1|Serveris]] spėja apdoroti savo 400 užklausų per sekundę, o likusias 200 atmeta: naudotojas gauna 503 klaidą (Service Unavailable). Raudoni taškai ant ryšio ir po serveriu – tai prarastos užklausos, trečdalis visų.

Tie, kuriems pasisekė, atsakymo laukia ilgiau nei sekundę, nes eilė pilna. Naudotojui tai beveik taip pat blogai kaip klaida.`,
    },
    'single-point': {
      title: 'Vienintelis gedimo taškas',
      body: `Kampanija baigėsi, ir apkrova vėl 200 rps. Bet serveris gali sugesti ir be perkrovos: sugenda diskas, naujoje versijoje pasitaiko klaida, serveris paleidžiamas iš naujo po atnaujinimo. Dabar [[app1|serveris]] nepasiekiamas, ir svetainė neatsako niekam: klaidos 100 %.

Blokas, be kurio neveikia visa sistema, vadinamas **vieninteliu gedimo tašku** (single point of failure). Vienas serveris kaip tik toks blokas: atsarginio nėra.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Serveris vėl veikia. Sukūrėte paprasčiausią sistemą: naudotojai siunčia užklausas, serveris atsako. Taip prasideda beveik kiekvienas projektas, ir ilgai to pakanka.

Ji turi dvi ribas. Pirmoji – **pajėgumo lubos**: apie 400 rps, o delsa pablogėja dar anksčiau. Galima nusipirkti galingesnį serverį, bet ir jis turi lubas, o kaina auga greičiau nei galia. Antroji – **vienintelis gedimo taškas**: sugedo serveris – neveikia visa svetainė.

Abi problemos išsprendžiamos, kai serverių yra keli. Bet dabar duomenis (naudotojus, užsakymus) saugo pats [[app1|serveris]], ir kopijos keliuose serveriuose imtų skirtis. Todėl 2 pamokoje perkelsime duomenis į atskirą **duomenų bazę**, o 3 pamokoje pastatysime kelis serverius už balansuotuvo.`,
    },
  },
  annotations: {
    noAnswer: sim => `atsakymo nėra · klaidos ${percent(sim.errorRate)}`,
    responseTime: sim => `p95 atsakas ${p95(sim)}`,
    nearLimit: sim => `apkrova ${percent(utilization(sim))} · p95 ${p95(sim)}`,
    overload: sim =>
      `apkrova ${percent(utilization(sim))} · klaidos ${percent(sim.errorRate)}`,
    down: sim => `svetainė neveikia · klaidos ${percent(sim.errorRate)}`,
    ceiling: () => 'riba 400 rps · atsarginio nėra',
  },
  tasks: {
    'place-server': {
      prompt: 'Pastatykite serverį lentoje ir prijunkite prie jo naudotojus.',
      goals: {
        'server-exists': 'Lentoje yra serveris',
        'users-connected': 'Naudotojai prijungti prie serverio',
        answers: 'Atsako į 100 rps, kai klaidų mažiau nei 1 %',
      },
      hints: [
        'Naudotojų užklausos turi kur nors patekti. Reikia bloko, kuris į jas atsakytų.',
        'Nuvilkite „Serveris“ iš paletės į lentą, tada nutieskite ryšį nuo apskritimo dešiniajame bloko „Naudotojai“ krašte iki serverio.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite serverį ten ir nutieskite pažymėtą ryšį nuo naudotojų iki serverio.',
      ],
      solvedNote: 'Serveris atsako į visas naudotojų užklausas, klaidų nebėra.',
    },
  },
} satisfies LessonTexts<typeof lesson>
