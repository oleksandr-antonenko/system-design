import { catalog } from '../../domain/catalog'
import { type SimResult, simulationRules } from '../../domain/simulate'
import { formatNumber } from '../../i18n/format'
import type { LessonTexts } from '../../lesson/dsl'
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
  title: 'Skaidymas į šardus',
  summary:
    'Kaip padalyti duomenis tarp kelių duomenų bazių: skaidymo raktas, karštieji šardai, užklausos per visus šardus ir perskirstymas.',
  steps: {
    'one-primary': {
      title: 'Prekyvietė vienoje bazėje',
      body: ({ sim }) =>
        `Parduotuvė tapo prekyviete su tūkstančiais pardavėjų, ir apkrova dabar matuojama tūkstančiais rps. Kad viskas tilptų lentoje, serverio blokas šioje pamokoje reiškia **šešių serverių grupę** už savo balansuotuvo: nuo [[group1|group1]] iki [[group4|group4]], po ${n(2400)} rps grupei. [[users|Naudotojus]] tarp grupių paskirsto DNS.

Skaitymas eina per [[cache-1|podėlį]] iš 4 pamokos: į ${percent(simulationRules.cacheHitShare)} užklausų jis atsako pats, ir tik nepataikymai pasiekia [[db|bazę]]. Rašymo podėlis neperims: užsakymą, mokėjimą ar likučio sandėlyje pakeitimą reikia išsaugoti bazėje.

Užrašas virš bazės rodo abu srautus. Esant ${n(sim.load)} rps į ją ateina ${n(writesInto(sim, 'db'))} rps rašymo ir tik ${n(missesInto(sim, 'db'))} rps nepataikymų: rašymas jau sudaro didesnę dalį.`,
    },
    'sale-day': {
      title: 'Išpardavimas',
      body: ({ sim }) =>
        `Prasidėjo didelis išpardavimas, ir apkrova padvigubėjo iki **${n(sim.load)} rps**. Serverių grupės apkrautos tik ${percent(utilization(sim, 'group1'))}, podėlis skirtumo beveik nepajuto. Tačiau į [[db|bazę]] ateina ${n(incoming(sim, 'db'))} rps: ${n(writesInto(sim, 'db'))} rps rašymo ir ${n(missesInto(sim, 'db'))} rps nepataikymų, gerokai daugiau nei jos ${n(capacity)}. Prarandama ${n(sim.nodes['db']?.dropped ?? 0)} rps, klaidų ${percent(sim.errorRate)}.

Abu srautai padvigubėjo kartu su apkrova. O jei išpardavimas pavyks, kitais metais jis bus dar didesnis.`,
    },
    'replicas-wont-help': {
      title: 'Kodėl replikos nepadės',
      body: ({ sim }) =>
        `6 pamokoje bazę išgelbėjo skaitymo replikos. Čia jos galėtų perimti tik podėlio nepataikymus. Rašymas vis tiek keliauja į pagrindinę bazę, o kiekviena replika turi jį pakartoti. Kad ir kiek replikų pridėtumėte, [[db|pagrindinei bazei]] liks ${n(writesInto(sim, 'db'))} rps rašymo, ${percent(writesInto(sim, 'db') / capacity)} jos pajėgumo, ir jokios atsargos kitam išpardavimui.

Galingesnė bazė duos šiek tiek laiko, bet jos lubos arti, o galingiausios mašinos kainuoja milžiniškus pinigus. Viena bazė tiesiog negali priimti tiek įrašų. Vadinasi, dalyti teks pačius **duomenis**.`,
    },
    'split-data': {
      title: 'Užduotis: šardai',
      body: `**Skaidymas į šardus** (sharding) padalija duomenis tarp kelių nepriklausomų duomenų bazių – **šardų**. Kiekvienas šardas saugo tik savo duomenų dalį, pavyzdžiui, pusę naudotojų su visais jų užsakymais, krepšeliais ir atsiliepimais, ir gauna skaitymo bei rašymo užklausas tik tai daliai.

Kuriame šarde guli įrašas, lemia **skaidymo raktas** (shard key), pavyzdžiui, naudotojo id. Serverių grupės ir podėlis pagal raktą apskaičiuoja, kur siųsti kiekvieną užklausą, todėl kiekvienam iš jų reikia ryšio su kiekvienu šardu. Lentoje blokas, prijungtas prie kelių bazių, savo rašymą arba nepataikymus dalija joms po lygiai, tarsi raktas naudotojus padalytų po lygiai.

Paletėje yra duomenų bazė: ji taps antruoju šardu.`,
    },
    'shard-key': {
      title: 'Rakto pasirinkimas',
      body: `Dabar kiekvienas naudotojas gyvena viename šarde. Serveris apskaičiuoja naudotojo id maišą (hash) ir dalybos iš dviejų liekaną: viena naudotojų pusė patenka į [[db|db]], kita – į [[db2|db2]]. Visi naudotojo duomenys guli viename šarde, todėl „Mano užsakymai“ ar užsakymo pateikimas kreipiasi į vieną bazę.

Blogas raktas sukuria **karštąjį šardą**: vienas šardas gauna gerokai daugiau nei savo dalį ir yra perkraunamas, kol kiti stovi be darbo. Skaidant pagal šalį, dauguma naudotojų atsidurs didžiausios šalies šarde. Skaidant pagal užsakymo datą, visi nauji užsakymai keliaus į naujausią šardą. Net ir geras raktas gali turėti karštąjį tašką: vieną įrašą, kurio reikia visiems vienu metu, pavyzdžiui, staiga išpopuliarėjusios prekės likutį.

Lenta apkrovą dalija po lygiai, kaip ir esant gerai parinktam raktui. Praktikoje raktas renkamas taip, kad apkrova pasiskirstytų tolygiai, o dauguma užklausų kreiptųsi į vieną šardą.`,
    },
    resharding: {
      title: 'Užklausos per visus šardus ir perskirstymas',
      body: ({ sim }) =>
        `Kai kurios užklausos netinka raktui. Pardavėjas nori matyti visus savo prekių užsakymus, bet tie užsakymai priklauso pirkėjams iš visų šardų. Tokią užklausą tenka išsiųsti **į visus šardus** ir sujungti atsakymus (scatter-gather), o ji veikia tik taip greitai, kaip lėčiausias šardas. JOIN tarp šardų nebepadarysi, o transakcijai, apimančiai du šardus, pavyzdžiui, pinigų pervedimui tarp dviejų naudotojų, reikia specialių protokolų. Tokias užklausas paprastai aptarnauja atskira duomenų kopija, sutvarkyta pagal kitą raktą, pavyzdžiui, paieškos indeksas.

Praėjo metai, apkrova – ${n(sim.load)} rps. ${
          utilization(sim, 'db') > 0.8
            ? `Šardai vėl apkrauti ${percent(utilization(sim, 'db'))}, reikia trečiojo.`
            : `Jūsų šardai dar turi atsargos (${percent(utilization(sim, 'db'))}), bet augimas pasivys ir juos.`
        } Čia ir prasideda **perskirstymo** (resharding) skausmas. Pagal taisyklę „maiša moduliu 2“ perėjus prie „moduliu 3“, maždaug du trečdaliai visų įrašų turi persikelti į kitą šardą: terabaitus tenka kopijuoti nestabdant parduotuvės.

Todėl perskirstymas planuojamas iš anksto. Duomenys dalijami į daug mažų **loginių šardų** (tarkime, 256), išdėstytų keliose bazėse, o nauja bazė perima dalį jų ištisai. Tą pačią problemą sprendžia **nuoseklusis maišymas** (consistent hashing): pridėjus šardą, persikelia tik nedidelė raktų dalis.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Skaidymas į šardus – būdas **plėsti rašymą**: kiekvienas šardas perima savo dalį, ir pajėgumas auga kartu su šardų skaičiumi.

Kaina – sudėtingumas: maršrutizavimas pagal raktą, karštieji šardai, užklausos per visus šardus be JOIN ir transakcijų, skausmingas perskirstymas. Todėl prie šardų pereinama paskiausiai: pirmiausia podėlis, replikos ir galingesnė bazė, o šardai – tik tada, kai rašymas ar duomenų kiekis nebetelpa vienoje mašinoje.

Ir dar vienas dalykas: kiekvienas šardas yra **vienintelė** savo naudotojų duomenų **kopija**. Jei [[db2|db2]] sugenda, pusė naudotojų netenka prieigos prie savo užsakymų, o kita pusė dirba lyg niekur nieko. Praktikoje kiekvienas šardas turi savo replikas, kaip 6 pamokoje. Kaip išgyventi bet kurio bloko gedimą, aptarsime 10 pamokoje.`,
    },
  },
  annotations: {
    writesAndMisses: sim =>
      `rašymas ${n(writesInto(sim, 'db'))} + nepataikymai ${n(missesInto(sim, 'db'))} rps`,
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
      prompt: `Padalykite duomenis tarp šardų taip, kad kiekvienai bazei liktų atsarga esant ${n(6400)} rps.`,
      goals: {
        'servers-use-shards': 'Serverių grupės rašo į du šardus',
        'cache-uses-shards': 'Podėlis nepataikymus skaito iš dviejų šardų',
        'shard-headroom': `Kiekvienas šardas apkrautas ne daugiau kaip 80 % esant ${n(6400)} rps`,
        'holds-load': `Atlaiko ${n(6400)} rps, kai klaidų mažiau nei 1 %`,
      },
      hints: [
        'Nė viena bazė nepriims viso rašymo. Jo srautą reikia padalyti tarp kelių bazių.',
        'Pastatykite antrą bazę šalia pirmosios ir prijunkite prie jos kiekvieną serverių grupę ir podėlį. Senus ryšius palikite: kiekvienas šardas saugo savo duomenų dalį.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite bazę ten ir nutieskite pažymėtus ryšius nuo visų keturių grupių ir nuo podėlio.',
      ],
      solvedNote:
        'Kiekvienas šardas perima pusę rašymo ir pusę podėlio nepataikymų, ir abu apkrauti mažiau nei 80 %.',
    },
  },
} satisfies LessonTexts<typeof lesson>
