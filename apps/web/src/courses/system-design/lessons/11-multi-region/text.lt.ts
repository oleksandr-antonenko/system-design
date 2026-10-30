import { Option } from 'effect'

import { type SimResult, simulationRules } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`
const p95 = (sim: SimResult) =>
  Option.match(sim.p95, { onNone: () => '—', onSome: ms => `${n(ms)} ms` })
const incoming = (sim: SimResult, id: string) => sim.nodes[id]?.incoming ?? 0
const usd = (value: number) => `${value.toFixed(2).replace('.', ',')} $`
const crossing = simulationRules.regionCrossingMs

export default {
  title: 'Multi-region ir CAP',
  summary:
    'Antrasis regionas tolimiems naudotojams ir duomenų centro praradimo atvejui, asinchroninė replikacija ir pasirinkimas tarp consistency ir availability.',
  steps: {
    'one-region': {
      title: 'Naudotojai už vandenyno',
      body: ({ sim }) =>
        `Paslauga išaugo: prie naudotojų Europoje ([[users-eu|users-eu]]) prisidėjo tiek pat naudotojų Amerikoje ([[users-us|users-us]]). O visa sistema vis dar veikia viename duomenų centre Europoje. Lentoje tai **regionas** (region) „Europa“: jo blokai stovi pažymėtoje zonoje.

Šviesa optiniame kabelyje Atlantą kerta pirmyn ir atgal maždaug per ${crossing} ms. Kiekviena amerikiečių užklausa juos sumoka dar prieš tai, kai server pradeda darbą. Dabar p95 yra ${p95(sim)}: lėčiausios užklausos ateina iš Amerikos, ir ${crossing} ms kiekvienoje iš jų – tai tiesiog kelias.

Puslapis – ne viena užklausa: ryšio užmezgimas, šifravimas, pats puslapis ir jo duomenys reikalauja kelių kelionių pirmyn ir atgal (**round trip**) paeiliui, todėl atstumą naudotojas pajunta kelis kartus.`,
    },
    'region-down': {
      title: 'Sugenda visas regionas',
      body: `Duomenų centrai irgi sugenda ištisai: dingsta elektra, nutraukiamas kabelis, klaidinga konfigūracija iškart paskleidžiama visoms mašinoms. Debesijos paslaugų teikėjai tokius incidentus skelbia kasmet, ir regionas gali neveikti kelias valandas.

Dabar neveikia visa Europa: [[lb-1|load balancer]], abu servers ir [[db|database]]. Atsarginis server nepadeda, jei stovi tame pačiame pastate. Klaidos 100 %, ir nukentėjo amerikiečiai: visa paslauga gyveno viename regione.`,
    },
    'second-region': {
      title: 'Antrasis regionas',
      body: `Išeitis – paleisti paslaugą dviejuose regionuose. Tokia schema vadinama **multi-region** (daugiaregione). Artimiausio veikiančio regiono adresą naudotojai gauna iš **DNS** su **health check** (sveikatos patikra): amerikiečiai keliauja į JAV, europiečiai – į Europą, o jei regionas nustoja atsakyti, DNS visus nukreipia į kitą.

Servers JAV pridėti lengva: jie **stateless** (neturi savo būsenos). Su duomenimis sudėtingiau. Ten sukūrėme [[replica-1|read replica]]. [[db|Database]] Europoje lieka **leader** (lyderė, dar vadinama primary): ji priima visus įrašus ir siunčia pakeitimus į read replica. Įrašų tvarka turi būti nustatoma vienoje vietoje, todėl įrašai iš Amerikos vis tiek keliaus per vandenyną. Lentoje server, sujungtas su database ir read replica, rašo tik į leader, o skaitymą dalija tarp jų po lygiai.

Replikacija **asinchroninė** (asynchronous): leader pirmiausia patvirtina įrašą naudotojui, o į read replica jį perduoda šiek tiek vėliau. Read replica atsilieka, dažniausiai milisekundėmis, kartais sekundėmis: tai **replication lag** (replikos atsilikimas).`,
    },
    'build-us': {
      title: 'Užduotis: JAV regionas',
      body: `Sukurkite sistemos kopiją JAV: load balancer ir servers, kurie dirba su read replica. Statykite blokus zonos „JAV“ viduje: blokas gauna tos zonos regioną, kurioje jį atleidžiate.

Tada praneškite naudotojams apie naują įėjimą. Amerikiečiai jį rinksis, nes jis arčiau. Europiečiams jis reikalingas kaip atsarginis išėjimas tai dienai, kai Europa suges.`,
    },
    failover: {
      title: 'Europa vėl sugedo',
      body: ({ sim }) =>
        `Europa vėl neveikia. Šįkart DNS nukreipė europiečius ([[users-eu|users-eu]]) į JAV. Jie aptarnaujami, bet kiekviena jų užklausa dabar sumoka ${crossing} ms už vandenyną: p95 ${p95(sim)}, klaidos ${percent(sim.errorRate)}.

Visą database darbą perėmė [[replica-1|read replica]]. JAV servers aptiko, kad leader nebeveikia, ir read replica buvo **paaukštinta** (promote): dabar ji priima ir įrašus, ir skaitymą. Tai ir yra **failover** (perjungimas į rezervą). Lentoje tai įvyksta akimirksniu. Realybėje tai trunka sekundes ar minutes: kažkas turi pastebėti gedimą ir nuspręsti, kad Europa tikrai prarasta.

Išliko ne viskas. Replikacija buvo asinchroninė, todėl paskutiniai įrašai prieš gedimą naudotojams buvo patvirtinti, bet Amerikos nepasiekė. Jie prarasti arba geriausiu atveju įstrigo Europoje, kol ji sugrįš. Kiek duomenų leidžiama prarasti per gedimą, vadinama **RPO** (recovery point objective). Esant asinchroninei replikacijai jis didesnis už nulį.`,
    },
    cap: {
      title: 'CAP: consistency ar availability',
      body: `Europa sugrįžo, ir lentoje jos [[db|database]] iškart vėl tapo leader. Realybėje tai sunkiausia akimirka: database Europoje nieko nežino apie įrašus, kuriuos Amerika priėmė per gedimą, o Amerikos nepasiekė paskutiniai Europos įrašai. Prieš vėl priimant įrašus kažkas turi nuspręsti, kuri kopija teisinga.

Dar blogiau – **network partition** (tinklo atskyrimas): ryšys tarp regionų nutrūksta, bet abu veikia. **CAP teorema** (CAP theorem) teigia: per partition sistema su duomenų kopijomis negali kartu išlaikyti **consistency** (suderinamumo: kiekvienas skaitymas mato naujausią įrašą) ir **availability** (prieinamumo: kiekviena užklausa gauna atsakymą). Tenka rinktis.

**Consistency:** Amerika atsisako priimti įrašus, kol ryšys grįš. Amerikiečiai mato klaidas, užtat kopijos nesiskiria. Taip elgiasi bankai ir biržos. **Availability:** abu regionai toliau priima įrašus, o kopijos vėliau suderinamos: laimi naujausias įrašas arba kopijos sujungiamos pagal dalykinės srities taisykles. Du krepšelius galima sujungti, dviejų nurašymų iš vienos sąskaitos – ne. Taip elgiasi socialiniai tinklai ir parduotuvės.

Todėl automatiškai paaukštinti read replica pavojinga. Jei Amerika partition palaikys gedimu, abu regionai taps leader: tai **split brain** („suskilusios smegenys“). Tikros sistemos read replica paaukština tik tada, kai už tai balsuoja stebėtojų dauguma, o stebėtojai dažnai statomi trečiame regione.`,
    },
    summary: {
      title: 'Santrauka',
      body: ({ sim }) =>
        `Antrasis regionas davė du dalykus: tolimi naudotojai aptarnaujami arti jų, o paslauga išgyvena viso regiono praradimą. p95 sumažėjo iki ${p95(sim)}. Lėčiausios užklausos dabar – įrašai iš Amerikos, keliaujantys pas leader, į [[db|database]] Europoje, ir ta skaitymo dalis, kurią JAV servers siunčia ten pat.

Kaina: sistema kainuoja ${usd(sim.costPerHour)} per valandą vietoj 1,90 $, įrašai vis dar kerta vandenyną, o kiekviena duomenų kopija atneša pasirinkimą tarp consistency ir availability. Kad ir įrašai taptų vietiniai, reikia leader kiekviename regione ir konfliktų sprendimo (conflict resolution) arba duomenis reikia padalyti pagal geografiją: europiečių paskyros gyvena Europoje, amerikiečių – JAV. Tai sharding (9 pamoka), pritaikytas geografijai.

12 pamokoje vienas įvykių srautas maitins paiešką ir analitiką.`,
    },
  },
  annotations: {
    nearTrip: sim => `${n(incoming(sim, 'users-eu'))} rps · arti`,
    farTrip: sim =>
      `${n(incoming(sim, 'users-us'))} rps · +${crossing} ms už vandenyno`,
    noAnswer: sim => `atsakymo nėra · klaidos ${percent(sim.errorRate)}`,
    leader: sim => `leader · ${n(incoming(sim, 'db'))} rps`,
    replicaIdle: sim => `database kopija · ${n(incoming(sim, 'replica-1'))} rps`,
    promoted: sim => `paaukštinta · ${n(incoming(sim, 'replica-1'))} rps`,
    detour: sim =>
      `→ JAV · +${crossing} ms · klaidos ${percent(sim.errorRate)}`,
    oldLeader: () => 'grįžo · be JAV įrašų',
    lag: sim => `${n(incoming(sim, 'replica-1'))} rps · atsilieka`,
    writesHere: () => 'leader · čia keliauja kiekvienas įrašas',
  },
  tasks: {
    'build-us': {
      prompt:
        'Sukurkite sistemos kopiją JAV: amerikiečiai turi būti aptarnaujami namie, o paslauga turi išgyventi Europos praradimą.',
      goals: {
        'two-entrances': 'Users sujungti su dviem load balancers',
        'reads-replica': 'Server sujungtas su read replica',
        'holds-load': 'Atlaiko 500 rps, kai klaidų mažiau nei 1 %',
        fast: 'p95 ne daugiau kaip 160 ms esant 500 rps',
        'survives-eu':
          'Išgyvena Europos praradimą esant 500 rps, kai klaidų ne daugiau kaip 1 %',
      },
      hints: [
        'Amerikiečiams viskas reikalinga arti: įėjimas, servers ir duomenys. Duomenys jau yra: read replica zonoje „JAV“.',
        'Pastatykite zonoje „JAV“ load balancer ir du servers: kai Europa suges, jie priims visus 500 rps. Sujunkite load balancer su abiem servers, o kiekvieną server – su database (įrašai) ir su read replica. Tada sujunkite abu blokus „Users“ su naujuoju load balancer.',
        'Zonoje „JAV“ atsirado punktyrinis kontūras. Pastatykite blokus ten ir nutieskite pažymėtus ryšius.',
      ],
      solvedNote:
        'Amerikiečiai aptarnaujami namie. Kai Europa sugenda, JAV pusė priima visus, o read replica perima įrašus.',
    },
  },
} satisfies LessonTexts<typeof lesson>
