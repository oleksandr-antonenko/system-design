import { Option } from 'effect'

import type { SimResult } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'
import { budget, reviewOf, serverCapacity } from './review'

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`
const p95 = (sim: SimResult) =>
  Option.match(sim.p95, { onNone: () => '—', onSome: ms => `${n(ms)} ms` })
const incoming = (sim: SimResult, id: string) => sim.nodes[id]?.incoming ?? 0
const usd = (value: number) => `${value.toFixed(2).replace('.', ',')} $`

export default {
  title: 'Baigiamasis projektas: URL shortener',
  summary:
    'Suprojektuokite sistemą nuo nulio: reikalavimai, įverčiai, API, o tada schema, kuri atlaiko piką, išgyvena gedimus ir telpa į biudžetą.',
  steps: {
    requirements: {
      title: 'Reikalavimai',
      body: `Baigiamasis projektas: nuo nulio suprojektuoti **URL shortener** (lietuviškai – nuorodų trumpinimo paslauga), tokią sistemą kaip bit.ly. Naudotojas atsiunčia ilgą nuorodą, **long URL**, ir gauna trumpą, **short URL**, pavyzdžiui, sho.rt/aZ3kP9x. Kas atidarys short URL, bus nukreiptas į pradinį adresą.

Pirmiausia susitarkime, ką sistema turi daryti. **Funkciniai reikalavimai** (functional requirements): sukurti short URL ilgajai nuorodai ir daryti **redirect** (nukreipimą) iš trumposios nuorodos į ilgąją; pageidautina – savas pseudonimas (alias) ir galiojimo terminas. **Nefunkciniai reikalavimai** (non-functional requirements) – tai skaičiai, kuriuos patikrinsime lentoje:

**Apkrova:** iki 2000 rps piko metu, daugiausia nukreipimai. **Greitis:** p95 ne daugiau kaip 150 ms, kad nukreipimas atrodytų akimirksniu. **Patikimumas:** bet kurio vieno bloko – load balancer, server ar database – gedimas kainuoja ne daugiau kaip 1 % užklausų. **Biudžetas:** ne daugiau kaip 4 $ per valandą visai sistemai.

Kol kas lentoje tik [[users|Users]] ir tuščia [[db|database]]. Nėra kam atsakyti, klaidos 100 %.`,
    },
    estimates: {
      title: 'Įverčiai',
      body: `Prieš piešdami apytiksliai įvertinkime skaičius; toks įvertis vadinamas **back-of-the-envelope estimate**. Šiame kurse užklausos į server – tai 80 % skaitymo ir 20 % rašymo, todėl piko metu tai 1600 nukreipimų ir 400 naujų nuorodų per sekundę. Tokiai paslaugai kaip URL shortener tai atsargus įvertis: tikrose paslaugose vienai nuorodai tenka dešimtys paspaudimų, tad mūsų rašymo įvertis – viršutinė riba. Be to, paspaudimai labai netolygūs: nuoroda iš išpopuliarėjusio įrašo per valandą surenka milijoną paspaudimų, o daugumos nuorodų beveik niekas neatidaro.

**Saugykla.** Vidutiniškai srautas maždaug keturis kartus mažesnis už piką: apie 100 naujų nuorodų per sekundę, 8,6 mln. per parą, apie 3 mlrd. per metus. Įrašas (kodas, long URL, savininkas, datos, indeksas) užima apie 500 baitų, todėl [[db|database]] kasmet išauga 1,6 TB. Užklausas viena database atlaikys dar ilgai, bet po kelerių metų pačius duomenis teks skaidyti į dalis: prireiks **sharding** (9 pamoka).

**Kodo ilgis.** Koduose naudojami 62 simboliai: a–z, A–Z ir 0–9, toks užrašas vadinamas **base62**. Šeši simboliai duoda 62⁶ ≈ 57 mlrd. kodų, mūsų tempu to užtektų maždaug 18 metų; septyni – 3,5 trln. Imame septynis.

**Kodų generavimas.** Ilgo URL **hash** (maiša) tam pačiam URL duoda tą patį kodą, bet reikia tikrinti **collisions** (kolizijas: du skirtingi URL gavo tą patį kodą). Atsitiktinis kodas su unikalumo patikra įterpiant yra paprastas, o collisions retos, kol erdvė beveik tuščia. **Counter** (skaitiklis), užrašytas base62, collisions neturi, bet jo kodus lengva atspėti, o vienas counter – **bottleneck** (siauras kaklelis), todėl servers pasiima po tūkstantį numerių iš karto.`,
    },
    api: {
      title: 'API ir duomenų modelis',
      body: `API reikia dviejų kvietimų.

**POST /api/links** su long URL užklausos turinyje, taip pat nebūtinu pseudonimu ir galiojimo terminu, sukuria nuorodą ir atsako 201 su kodu ir visu short URL.

**GET /{code}** grąžina redirect: būsena 301 arba 302 ir long URL antraštėje Location. Nežinomas kodas – 404, pasibaigęs – 410. Atsakymą 301 (moved permanently) naršyklės ir CDN įsimena: apkrovos mažiau, bet prarandate paspaudimų skaičiavimą ir nebegalite pakeisti adreso. Su 302 (found) kiekvienas paspaudimas ateina pas jus. URL shorteners dažniausiai renkasi 302 arba 301 su trumpu TTL.

Duomenys telpa į vieną lentelę **links**: code (**primary key**, pirminis raktas), long_url, owner_id, created_at, expires_at. Kiekviena paieška vyksta pagal kodą, tai prieiga **key-value** („raktas–reikšmė“): tiks ir reliacinė [[db|database]] su primary key, ir key-value saugykla.`,
    },
    design: {
      title: 'Užduotis: schema',
      body: `Jūsų ėjimas. Paletėje – visi kurso blokai: CDN, load balancer, server, cache ir read replica. [[db|Database]] jau lentoje, ir mūsų rašymui pakaks vienos.

Reikalavimai tapo tikslais po lenta. Biudžetas skaičiuojamas iš karto, o visa kita tikrinama simuliacija paspaudus „Tikrinti“. Prieš piešdami suskaičiuokite: kiek servers reikia 2000 rps ir kiek jie kainuoja?`,
    },
    review: {
      title: 'Aptarimas',
      body: ({ sim, doc }) => {
        const review = reviewOf(sim, doc)
        const entry =
          review.edge > 0
            ? `CDN pats atsako į ${n(review.edge)} rps per 12 ms, ir iki servers ateina tik ${n(review.serverLoad)} rps.`
            : `Kiekviena užklausa pasiekia servers: ${n(review.serverLoad)} rps.`
        const failover = Option.match(review.perServerAfterFailure, {
          onNone: () => '',
          onSome: share =>
            `Turite ${n(review.servers)} servers: jei vienas suges, kiekvienas likęs gaus ${n(share)} iš ${n(serverCapacity)} rps.${
              share / serverCapacity > 0.8
                ? ' Klaidų nėra, bet esant tokiai apkrovai užklausos ima laukti viena kitos ir p95 šauna aukštyn. Dar vienas server kainuoja 0,40 $ per valandą, ir tada greitas būtų ir **failover** (persijungimas po gedimo).'
                : ' Atsarga lieka, tad ir gedimo metu atsakymai greiti.'
            } `,
        })
        const entrance =
          review.balancers > 1
            ? `Load balancers yra ${n(review.balancers)}, tad įėjimas turi atsarginį. `
            : review.balancers === 0
              ? 'Load balancer schemoje nėra: CDN pats skirsto užklausas tarp servers ir aplenkia sugedusius. '
              : ''
        const data =
          review.replicas > 0
            ? 'Jei suges [[db|database]], read replica bus paaukštinta (promote) ir perims rašymą; esant asinchroninei replikacijai paskutiniai įrašai gali būti prarasti (11 pamoka).'
            : ''
        const cache =
          review.caches > 0
            ? `Cache atsako į 80 % skaitymo užklausų, todėl iki [[db|database]] ateina tik ${n(incoming(sim, 'db'))} rps.`
            : `Cache už 0,15 $ atsakytų į 80 % skaitymo užklausų ir nuimtų nuo [[db|database]] didžiąją dalį jos ${n(incoming(sim, 'db'))} rps: pigi atsarga augimui.`
        const busiest = Option.match(review.busiest, {
          onNone: () => '',
          onSome: ({ id, utilization }) =>
            ` Labiausiai apkrautas blokas – [[${id}|${id}]], ${percent(utilization)}: augant srautui, jis pirmasis atsirems į lubas.`,
        })
        return `Pereikime per reikalavimus su jūsų lentos skaičiais.

**Apkrova.** Esant 2000 rps, klaidos ${percent(sim.errorRate)}. ${entry}

**Greitis.** p95 yra ${p95(sim)}, o tikslas – 150 ms. Lėčiausios yra užklausos, kurios eina per server: jo delsa auga kartu su apkrova, todėl tikslas pasiekiamas laikant servers gerokai žemiau jų ribos.

**Gedimai.** ${failover}${entrance}${data}

**Biudžetas.** ${usd(sim.costPerHour)} per valandą iš ${usd(budget)}. ${cache}${busiest}`
      },
    },
    next: {
      title: 'Kas toliau',
      body: `Sistema veikia, bet realiame pasaulyje URL shortener greitai sulaukia naujų norų.

**Analitika.** Savininkai nori matyti paspaudimus pagal dienas, šalis ir šaltinius. Nerašykite į database per kiekvieną nukreipimą, kitaip skaitymas virs rašymu. Server paskelbia paspaudimo įvykį į event bus (12 pamoka), o workers atnaujina skaitiklius fone. Paspaudimai, į kuriuos atsakė CDN, servers nepasiekia, todėl jie skaičiuojami iš CDN žurnalų.

**Savi domenai.** Įmonė nori go.brand.com vietoj sho.rt. Tam reikia domenų ir jų savininkų lentelės, automatiškai išduodamo TLS sertifikato kiekvienam domenui ir paieškos pagal porą „domenas ir kodas“.

**Apsauga nuo piktnaudžiavimo.** Short URL slepia tikrąjį adresą, ir tuo naudojasi šlamšto siuntėjai ir sukčiai. Ribokite nuorodų kūrimą paskyrai ir IP adresui naudodami rate limiter (8 pamoka), tikrinkite naujus URL pagal juoduosius sąrašus (blocklists) ir būkite pasirengę greitai užblokuoti nuorodą, taip pat pašalindami jos kopiją iš CDN.

Čia kursas baigiasi. Pradėjote nuo vieno server, o baigėte sistema, suprojektuota pagal reikalavimus. Metodas tinka bet kuriai sistemai: įvertinkite skaičius, raskite bottleneck, pridėkite bloką ir patikrinkite, kiek jis kainuoja.`,
    },
  },
  annotations: {
    noAnswer: sim => `${n(incoming(sim, 'users'))} rps · nėra kam atsakyti`,
    storage: () => '≈1,6 TB per metus',
    schema: () => 'links: kodas → long URL',
    userView: sim => `p95 ${p95(sim)} · klaidos ${percent(sim.errorRate)}`,
    dbLoad: sim => `${n(incoming(sim, 'db'))} rps iš ${n(1500)} galimų`,
  },
  tasks: {
    design: {
      prompt:
        'Suprojektuokite URL shortener: 2000 rps, p95 iki 150 ms, išgyvena bet kurį pavienį gedimą, 4 $ per valandą.',
      goals: {
        'holds-load': 'Atlaiko 2000 rps, kai klaidų mažiau nei 1 %',
        fast: 'p95 ne daugiau kaip 150 ms esant 2000 rps',
        survives:
          'Išgyvena bet kurio vieno bloko (load balancer, server ar database) gedimą, kai klaidų ne daugiau kaip 1 %',
        budget: 'Kainuoja ne daugiau kaip 4 $ per valandą',
      },
      hints: [
        'Pirmiausia suskaičiuokite. Jei kiekviena užklausa pasiektų servers, 2000 rps reikėtų penkių servers ir atsarginio. Tai 2,40 $, o kartu su database, read replica ir dviem load balancers biudžetas jau viršytas. Didžiąją srauto dalį reikia atsakyti dar jai nepasiekus servers.',
        'Pastatykite prie įėjimo CDN: jis pats atsako į populiarius nukreipimus, tai 60 % užklausų, ir iki servers ateina tik 800 rps. Už jo – du load balancers, trys servers (du neša apkrovą, trečias atsarginis) ir read replica. Sujunkite kiekvieną server ir su database, ir su read replica, kad read replica galėtų perimti rašymą.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite blokus ten ir nutieskite pažymėtus ryšius.',
      ],
      solvedNote:
        'Schema atitinka visus reikalavimus: atlaiko piką, atsako greitai, išgyvena bet kurį pavienį gedimą ir telpa į biudžetą.',
    },
  },
} satisfies LessonTexts<typeof lesson>
