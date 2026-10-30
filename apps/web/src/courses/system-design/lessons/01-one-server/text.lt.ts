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
  title: 'Single server. Viskas vienoje mašinoje',
  summary:
    'Užklausa ir atsakymas, RPS, delsa, pajėgumo riba, kai server tik vienas, ir single point of failure (SPOF).',
  steps: {
    'no-answer': {
      title: 'Užklausos be atsakymo',
      body: `Šalia šio teksto yra **lenta** su sistemos schema. Schema gyva: ryšiais tarp blokų keliauja užklausos, o prietaisai po lenta matuoja, kas vyksta. Kol kas lenta seka tekstą, o užduotyse ji bus jūsų.

Blokai lentoje pavadinti angliškai – taip, kaip dokumentacijoje, debesijos konsolėse, stebėsenos sistemose ir darbo pokalbiuose. Taip iš karto priprasite prie žodžių, kuriuos sutiksite darbe. Kiekvienas naujas terminas pirmą kartą paaiškinamas lietuviškai, o toliau rašomas angliškai.

Dabar lentoje yra vienas **blokas**: [[users|Users]]. **Users** (lietuviškai – naudotojai) – tai žmonės, kurie atidaro jūsų svetainę. Kiekvienas veiksmas naršyklėje per internetą siunčia **užklausą**, ir žmogus laukia **atsakymo**. Užklausų skaičius per sekundę vadinamas **apkrova**, trumpai rps (requests per second). Dabar ateina 100 rps.

Nėra kam atsakyti, todėl visos užklausos prarandamos. Raudoni taškai po bloku – tai prarastos užklausos, o prietaisas „Klaidos“ rodo 100 %.`,
    },
    'place-server': {
      title: 'Užduotis: server',
      body: `**Server** (lietuviškai – serveris) – kompiuteris, kuriame veikia jūsų programos kodas. Būtent jis atsakys į užklausas: priima užklausą, atlieka darbą (suranda prekę, išsaugo užsakymą) ir išsiunčia atsakymą.

Nuvilkite bloką „Server“ iš paletės į lentą. Tada sujunkite blokus: tempkite nuo apskritimo dešiniajame bloko [[users|Users]] krašte ir atleiskite virš bloko „Server“. Rodyklė rodo, kur keliauja užklausos, o atsakymas grįžta tuo pačiu ryšiu.

Kai schema bus paruošta, spauskite „Tikrinti“. Jei įstrigsite, padės užuominos.`,
    },
    'reading-the-board': {
      title: 'Kaip skaityti lentą',
      body: ({ sim, doc }) => {
        const busy = doc.nodes.filter(
          node =>
            node.kind === 'server' && (sim.nodes[node.id]?.incoming ?? 0) > 0,
        )
        return `Svetainė auga: apkrova pakilo iki 200 rps. Žali taškai ant ryšio – tai užklausos, kurias server apdorojo. Kuo tankesnis srautas, tuo daugiau taškų.

Bloke [[app1|app1]] po pavadinimu yra du skaičiai: kiek užklausų į jį ateina ir kokią savo **pajėgumo** (capacity) dalį jis naudoja. Šiame kurse server apdoroja apie 400 rps, todėl 200 rps – tai 50 %. Tą pačią dalį rodo apkrovos juosta bloko apačioje.

Prietaisai po lenta rodo visą sistemą. „Apkrova“ – kiek užklausų atėjo, „Klaidos“ – kokia jų dalis prarasta. **p95** – laikas, per kurį atsakymą gauna 95 % užklausų. Vidurkis paslepia lėtus atsakymus, o p95 parodo, ką mato beveik visi naudotojai. „Kaina“ – kiek kainuoja visų blokų darbo valanda; vienas server kainuoja 0,40 $ per valandą.${
          busy.length > 1
            ? `

Jūsų lentoje srautą gauna keli blokai „Server“, todėl apkrova pasiskirsto tarp jų. Toliau pamokoje kalbama apie atvejį, kai server tik vienas, tad jūsų skaičiai bus geresni nei tekste. Kaip paskirstyti užklausas keliems blokams „Server“, aptarsime 3 pamokoje.`
            : ''
        }`
      },
    },
    'near-limit': {
      title: 'Beveik ties riba',
      body: `Apkrova išaugo iki 360 rps. Klaidų dar nėra: [[app1|server]] apkrautas 90 % ir spėja. Bet pažiūrėkite į p95: palyginti su ankstesniu žingsniu, jis išaugo kelis kartus, nors apkrova net nepadvigubėjo. Taškai ant ryšio pageltonavo: blokas beveik ties riba.

Užklausos ateina netolygiai. Kol server užimtas viena užklausa, kita laukia **eilėje**. Kai server apkrautas 50 %, eilė susidaro retai, o kai 90 % – beveik kiekviena užklausa ko nors laukia. Todėl delsa (latency) pradeda augti gerokai anksčiau, nei apkrova pasiekia 100 %, ir paliekama **atsarga** (headroom): piko metu server apkrova paprastai neviršija 70–80 %.`,
    },
    overload: {
      title: 'Perkrova',
      body: `Prasidėjo reklamos kampanija, ir apkrova šoktelėjo iki **600 rps**. [[app1|Server]] spėja apdoroti savo 400 užklausų per sekundę, o likusias 200 atmeta: naudotojas gauna 503 klaidą (Service Unavailable). Raudoni taškai ant ryšio ir po bloku – tai prarastos užklausos, trečdalis visų.

Tie, kuriems pasisekė, atsakymo laukia ilgiau nei sekundę, nes eilė pilna. Naudotojui tai beveik taip pat blogai kaip klaida.`,
    },
    'single-point': {
      title: 'Single point of failure',
      body: `Kampanija baigėsi, ir apkrova vėl 200 rps. Bet server gali sugesti ir be perkrovos: sugenda diskas, naujoje versijoje pasitaiko klaida, server paleidžiamas iš naujo po atnaujinimo. Dabar [[app1|server]] nepasiekiamas, ir svetainė neatsako niekam: klaidos 100 %.

Blokas, be kurio neveikia visa sistema, vadinamas **single point of failure**, arba SPOF (lietuviškai – vienintelis gedimo taškas). Vienas server kaip tik toks blokas: atsarginio nėra.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Server vėl veikia. Sukūrėte paprasčiausią sistemą: naudotojai siunčia užklausas, server atsako. Taip prasideda beveik kiekvienas projektas, ir ilgai to pakanka.

Ji turi dvi ribas. Pirmoji – **pajėgumo lubos**: apie 400 rps, o delsa pablogėja dar anksčiau. Galima nusipirkti galingesnį server, bet ir jis turi lubas, o kaina auga greičiau nei galia. Antroji – **single point of failure**: sugedo server – neveikia visa svetainė.

Abi problemos išsprendžiamos, kai blokų „Server“ yra keli. Bet dabar duomenis (naudotojus, užsakymus) saugo pats [[app1|server]], o jei server bus keli, jų kopijos imtų skirtis. Todėl 2 pamokoje perkelsime duomenis į atskirą **database** (lietuviškai – duomenų bazė), o 3 pamokoje kelis blokus „Server“ pastatysime už load balancer (lietuviškai – apkrovos balansavimo priemonė, kuri paskirsto užklausas serveriams).`,
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
      prompt:
        'Pastatykite lentoje bloką „Server“ ir prijunkite prie jo bloką „Users“.',
      goals: {
        'server-exists': 'Lentoje yra blokas „Server“',
        'users-connected': 'Blokas „Users“ prijungtas prie „Server“',
        answers: 'Atsako į 100 rps, kai klaidų mažiau nei 1 %',
      },
      hints: [
        'Naudotojų užklausos turi kur nors patekti. Reikia bloko, kuris į jas atsakytų.',
        'Nuvilkite „Server“ iš paletės į lentą, tada nutieskite ryšį nuo apskritimo dešiniajame bloko „Users“ krašte iki bloko „Server“.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite ten bloką „Server“ ir nutieskite pažymėtą ryšį nuo „Users“ iki „Server“.',
      ],
      solvedNote: 'Server atsako į visas naudotojų užklausas, klaidų nebėra.',
    },
  },
} satisfies LessonTexts<typeof lesson>
