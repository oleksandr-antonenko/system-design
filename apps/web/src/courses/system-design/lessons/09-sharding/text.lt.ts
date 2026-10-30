import { catalog } from '../../../../domain/catalog'
import { type SimResult, simulationRules } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`
const capacity = catalog.db.capacity
const incoming = (sim: SimResult, id: string) => sim.nodes[id]?.incoming ?? 0
const utilization = (sim: SimResult, id: string) =>
  sim.nodes[id]?.utilization ?? 0
const edge = (sim: SimResult, from: string, to: string) =>
  sim.edges[`${from}>${to}`] ?? 0
const writesInto = (sim: SimResult, id: string) =>
  ['group1', 'group2', 'group3', 'group4'].reduce(
    (sum, group) => sum + edge(sim, group, id),
    0,
  )
const missesInto = (sim: SimResult, id: string) => edge(sim, 'cache-1', id)

export default {
  title: 'Sharding. Duomenys dalimis',
  summary:
    'Kaip padalyti duomenis tarp nepriklausomų databases: shard key, hot shards, užklausos per visus shards ir resharding.',
  preview: {
    alt: 'Schema: sharding padalija didelę database į shards, router pagal shard key siunčia užklausą į reikiamą shard, o hot shard apkrautas labiausiai.',
  },
  steps: {
    'one-primary': {
      title: 'Prekyvietė su viena database',
      body: ({ sim }) =>
        `Parduotuvė tapo prekyviete su tūkstančiais pardavėjų, ir apkrova dabar matuojama tūkstančiais rps. Kad viskas tilptų lentoje, blokas „Server“ šioje pamokoje reiškia **servers grupę** (jų – šeši) už savo load balancer: nuo [[group1|group1]] iki [[group4|group4]], po ${n(2400)} rps grupei. Užklausas iš [[users|Users]] tarp grupių paskirsto DNS.

Skaitymas eina per [[cache-1|cache]] iš 4 pamokos: į ${percent(simulationRules.cacheHitShare)} užklausų jis atsako pats, ir tik **cache misses** (nepataikymai į podėlį) pasiekia [[db|database]]. Rašymo cache neperims: užsakymą, mokėjimą ar likučio sandėlyje pakeitimą turi išsaugoti pati database.

Užrašas virš bloko „Database“ rodo abu srautus. Esant ${n(sim.load)} rps į ją ateina ${n(writesInto(sim, 'db'))} rps rašymo ir tik ${n(missesInto(sim, 'db'))} rps cache misses: rašymas jau sudaro didesnę dalį.`,
    },
    'sale-day': {
      title: 'Išpardavimas',
      body: ({ sim }) =>
        `Prasidėjo didelis išpardavimas, ir apkrova padvigubėjo iki **${n(sim.load)} rps**. Servers grupės apkrautos tik ${percent(utilization(sim, 'group1'))}, cache skirtumo beveik nepajuto. Tačiau į [[db|database]] ateina ${n(incoming(sim, 'db'))} rps: ${n(writesInto(sim, 'db'))} rps rašymo ir ${n(missesInto(sim, 'db'))} rps cache misses, gerokai daugiau nei jos ${n(capacity)}. Prarandama ${n(sim.nodes['db']?.dropped ?? 0)} rps, klaidų ${percent(sim.errorRate)}.

Abu srautai padvigubėjo kartu su apkrova. O jei išpardavimas pavyks, kitais metais jis bus dar didesnis.`,
    },
    'replicas-wont-help': {
      title: 'Kodėl read replicas nepadės',
      body: ({ sim }) =>
        `6 pamokoje read replicas perėmė skaitymą ir taip išgelbėjo database. Čia jos galėtų perimti tik cache misses. Rašymas vis tiek keliauja į primary, o kiekviena read replica turi jį pakartoti. Pridėkite read replicas kiek norite: ant [[db|primary]] vis tiek liks ${n(writesInto(sim, 'db'))} rps rašymo, ${percent(writesInto(sim, 'db') / capacity)} jos pajėgumo, ir jokios atsargos kitam išpardavimui.

Galingesnė database duos šiek tiek laiko, bet jos lubos arti, o galingiausios mašinos kainuoja milžiniškus pinigus. Viena database tiesiog negali priimti tiek įrašų. Vadinasi, dalyti teks pačius **duomenis**.`,
    },
    'split-data': {
      title: 'Užduotis: shards',
      body: `**Sharding** (lietuviškai – skaidymas į šardus) padalija duomenis tarp nepriklausomų databases – **shards** (šardų). Kiekvienas shard saugo tik savo duomenų dalį, pavyzdžiui, pusę naudotojų su visais jų užsakymais, krepšeliais ir atsiliepimais, ir gauna skaitymo bei rašymo užklausas tik tai daliai.

Kuris shard saugo įrašą, lemia **shard key** (skaidymo raktas), pavyzdžiui, naudotojo id. Servers grupės ir cache pagal raktą apskaičiuoja, kur siųsti kiekvieną užklausą, todėl kiekvienam iš jų reikia ryšio su kiekvienu shard. Lentoje blokas, sujungtas su keliais „Database“ blokais, savo rašymą arba cache misses dalija joms po lygiai, tarsi raktas naudotojus padalytų po lygiai.

Paletėje yra database: ji taps antruoju shard.`,
    },
    'shard-key': {
      title: 'Shard key pasirinkimas',
      body: `Dabar kiekvienas naudotojas gyvena viename shard. Server apskaičiuoja naudotojo id maišą (hash) ir dalybos iš dviejų liekaną: viena naudotojų pusė patenka į [[db|db]], kita – į [[db2|db2]]. Visi naudotojo duomenys guli viename shard, todėl „Mano užsakymai“ ar užsakymo pateikimas kreipiasi į vieną database.

Blogas raktas sukuria **hot shard** (karštąjį šardą): vienas shard gauna gerokai daugiau nei savo dalį ir yra perkraunamas, kol kiti stovi be darbo. Skaidant pagal šalį, dauguma naudotojų pateks į didžiausios šalies shard. Skaidant pagal užsakymo datą, visi nauji užsakymai keliaus į naujausią shard. Net ir geras raktas gali turėti **hot spot** (karštąjį tašką): vieną įrašą, kurio reikia visiems vienu metu, pavyzdžiui, staiga išpopuliarėjusios prekės likutį.

Lenta apkrovą dalija po lygiai, kaip ir esant gerai parinktam raktui. Praktikoje raktas renkamas taip, kad apkrova pasiskirstytų tolygiai, o dauguma užklausų kreiptųsi į vieną shard.`,
    },
    resharding: {
      title: 'Užklausos per visus shards ir resharding',
      body: ({ sim }) =>
        `Kai kurios užklausos netinka raktui. Pardavėjas nori matyti visus savo prekių užsakymus, bet tie užsakymai priklauso pirkėjams iš visų shards. Tokią užklausą tenka išsiųsti **į visus shards** ir sujungti atsakymus (**scatter-gather**, „išsiųsti ir surinkti“), o ji veikia tik taip greitai, kaip lėčiausias shard. JOIN tarp shards nebepadarysi, o transakcijai, apimančiai daugiau nei vieną shard, pavyzdžiui, pinigų pervedimui tarp dviejų naudotojų, reikia specialių protokolų. Tokias užklausas paprastai aptarnauja atskira duomenų kopija, sutvarkyta pagal kitą raktą, pavyzdžiui, **search index** (lietuviškai – paieškos indeksas; plačiau apie jį 12 pamokoje).

Praėjo metai, apkrova – ${n(sim.load)} rps. ${
          utilization(sim, 'db') > 0.8
            ? `Shards vėl apkrauti ${percent(utilization(sim, 'db'))}, reikia trečiojo.`
            : `Jūsų shards dar turi atsargos (${percent(utilization(sim, 'db'))}), bet augimas pasivys ir juos.`
        } Čia ir prasideda **resharding** (duomenų perskirstymo) skausmas. Pagal taisyklę „maiša moduliu 2“ perėjus prie „moduliu 3“, maždaug du trečdaliai visų įrašų turi persikelti į kitą shard: terabaitus tenka kopijuoti nestabdant parduotuvės.

Todėl resharding planuojamas iš anksto. Duomenys dalijami į mažus **logical shards** (loginius šardus), tarkime, į 256, ir išdėstomi po esamas databases, o nauja database perima dalį jų ištisai. Tą pačią problemą sprendžia **consistent hashing** (nuoseklusis maišymas): pridėjus shard, persikelia tik nedidelė raktų dalis.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Sharding – būdas **plėsti rašymą**: kiekvienas shard perima savo dalį, ir pajėgumas auga kartu su shards skaičiumi.

Kaina – sudėtingumas: maršrutizavimas pagal raktą, hot shards, užklausos per visus shards be JOIN ir transakcijų, skausmingas resharding. Todėl prie sharding pereinama paskiausiai: pirmiausia cache, read replicas ir galingesnė database, o shards – tik tada, kai rašymas ar duomenų kiekis nebetelpa vienoje mašinoje.

Ir dar vienas dalykas: kiekvienas shard yra **vienintelė** savo naudotojų duomenų **kopija**. Jei [[db2|db2]] sugenda, pusė naudotojų netenka prieigos prie savo užsakymų, o kita pusė dirba lyg niekur nieko. Praktikoje kiekvienas shard turi savo read replicas, kaip 6 pamokoje. Kaip išgyventi bet kurio bloko gedimą, aptarsime 10 pamokoje.`,
    },
  },
  annotations: {
    writesAndMisses: sim =>
      `rašymas ${n(writesInto(sim, 'db'))} + misses ${n(missesInto(sim, 'db'))} rps`,
    dbOverload: sim =>
      `${n(incoming(sim, 'db'))} rps iš ${n(capacity)} · klaidos ${percent(sim.errorRate)}`,
    writesAlone: sim =>
      `vien rašymas: ${n(writesInto(sim, 'db'))} rps · ${percent(writesInto(sim, 'db') / capacity)}`,
    shardOne: sim => `hash(user_id) % 2 = 0 · ${n(incoming(sim, 'db'))} rps`,
    shardTwo: sim => `hash(user_id) % 2 = 1 · ${n(incoming(sim, 'db2'))} rps`,
    shardOneGrowth: sim =>
      `${n(incoming(sim, 'db'))} rps iš ${n(capacity)} · ${percent(utilization(sim, 'db'))}`,
    shardTwoGrowth: sim =>
      `${n(incoming(sim, 'db2'))} rps iš ${n(capacity)} · ${percent(utilization(sim, 'db2'))}`,
    onlyCopyOne: sim => `${n(incoming(sim, 'db'))} rps · vienintelė kopija`,
    onlyCopyTwo: sim => `${n(incoming(sim, 'db2'))} rps · vienintelė kopija`,
  },
  tasks: {
    'split-data': {
      prompt: `Padalykite duomenis tarp shards taip, kad kiekvienai database liktų atsarga esant ${n(6400)} rps.`,
      goals: {
        'servers-use-shards': 'Servers grupės rašo į du „Database“ blokus',
        'cache-uses-shards':
          'Cache savo misses skaito iš dviejų „Database“ blokų',
        'shard-headroom': `Kiekvienas shard apkrautas ne daugiau kaip 80 % esant ${n(6400)} rps`,
        'holds-load': `Atlaiko ${n(6400)} rps, kai klaidų mažiau nei 1 %`,
      },
      hints: [
        'Nė viena database nepriims viso rašymo. Jo srautą reikia padalyti tarp kelių „Database“ blokų.',
        'Pastatykite antrą database šalia pirmosios ir prijunkite prie jos kiekvieną servers grupę ir cache. Senus ryšius palikite: kiekvienas shard saugo savo duomenų dalį.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite database ten ir nutieskite pažymėtus ryšius nuo visų keturių grupių ir nuo cache.',
      ],
      solvedNote:
        'Kiekvienas shard perima pusę rašymo ir pusę cache misses, ir abu apkrauti mažiau nei 80 %.',
    },
  },
} satisfies LessonTexts<typeof lesson>
