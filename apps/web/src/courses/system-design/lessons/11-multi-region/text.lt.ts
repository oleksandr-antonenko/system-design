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
  title: 'Regionai ir CAP',
  summary:
    'Antrasis regionas tolimiems naudotojams ir duomenų centro praradimo atvejui, asinchroninė replikacija ir pasirinkimas tarp suderinamumo ir prieinamumo.',
  steps: {
    'one-region': {
      title: 'Naudotojai už vandenyno',
      body: ({ sim }) =>
        `Paslauga išaugo: prie [[users-eu|naudotojų]] Europoje prisidėjo tiek pat [[users-us|naudotojų Amerikoje]]. O visa sistema vis dar veikia viename duomenų centre Europoje. Lentoje tai **regionas** „Europa“: jo blokai stovi pažymėtoje zonoje.

Šviesa optiniame kabelyje Atlantą kerta pirmyn ir atgal maždaug per ${crossing} ms. Kiekviena amerikiečių užklausa juos sumoka dar prieš serveriui pradedant darbą. Dabar p95 yra ${p95(sim)}: lėčiausios užklausos ateina iš Amerikos, ir ${crossing} ms kiekvienoje iš jų – tai tiesiog kelias.

Puslapis – ne viena užklausa: ryšio užmezgimas, šifravimas, pats puslapis ir jo duomenys reikalauja kelių kelionių pirmyn ir atgal paeiliui, todėl atstumą naudotojas pajunta kelis kartus.`,
    },
    'region-down': {
      title: 'Sugenda visas regionas',
      body: `Duomenų centrai irgi sugenda ištisai: dingsta elektra, nutraukiamas kabelis, klaidinga konfigūracija iškart paskleidžiama visoms mašinoms. Debesijos paslaugų teikėjai tokius incidentus skelbia kasmet, ir regionas gali neveikti kelias valandas.

Dabar neveikia visa Europa: [[lb-1|balansuotuvas]], abu serveriai ir [[db|duomenų bazė]]. Atsarginis serveris nepadeda, jei stovi tame pačiame pastate. Klaidos 100 %, ir nukentėjo amerikiečiai: visa paslauga gyveno viename regione.`,
    },
    'second-region': {
      title: 'Antrasis regionas',
      body: `Išeitis – paleisti paslaugą dviejuose regionuose. Artimiausio veikiančio regiono adresą naudotojai gauna iš **DNS** su sveikatos patikra: amerikiečiai keliauja į JAV, europiečiai – į Europą, o jei regionas nustoja atsakyti, DNS visus nukreipia į kitą.

Serverius JAV pridėti lengva: jie neturi būsenos. Su duomenimis sudėtingiau. Ten sukūrėme bazės [[replica-1|repliką]]. [[db|Duomenų bazė]] Europoje lieka **lyderė** (leader): ji priima visus įrašus ir siunčia pakeitimus replikai. Įrašų tvarka turi būti nustatoma vienoje vietoje, todėl įrašai iš Amerikos vis tiek keliaus per vandenyną. Lentoje serveris, sujungtas su baze ir replika, rašo tik į lyderę, o skaitymą dalija tarp jų po lygiai.

Replikacija **asinchroninė**: lyderė pirmiausia patvirtina įrašą naudotojui, o replikai jį perduoda šiek tiek vėliau. Replika atsilieka, dažniausiai milisekundėmis, kartais sekundėmis.`,
    },
    'build-us': {
      title: 'Užduotis: JAV regionas',
      body: `Sukurkite sistemos kopiją JAV: balansuotuvą ir serverius, kurie dirba su replika. Statykite blokus zonos „JAV“ viduje: blokas gauna tos zonos regioną, kurioje jį atleidžiate.

Tada praneškite naudotojams apie naują įėjimą. Amerikiečiai jį rinksis, nes jis arčiau. Europiečiams jis reikalingas kaip atsarginis išėjimas tai dienai, kai Europa suges.`,
    },
    failover: {
      title: 'Europa vėl sugedo',
      body: ({ sim }) =>
        `Europa vėl neveikia. Šįkart DNS nukreipė [[users-eu|europiečius]] į JAV. Jie aptarnaujami, bet kiekviena jų užklausa dabar sumoka ${crossing} ms už vandenyną: p95 ${p95(sim)}, klaidos ${percent(sim.errorRate)}.

Visas bazės darbas perėjo [[replica-1|replikai]]. JAV serveriai aptiko, kad lyderė nebeveikia, ir replika buvo **paaukštinta** (promoted): dabar ji priima ir įrašus, ir skaitymą. Lentoje tai įvyksta akimirksniu. Realybėje tai trunka sekundes ar minutes: kažkas turi pastebėti gedimą ir nuspręsti, kad Europa tikrai prarasta.

Išliko ne viskas. Replikacija buvo asinchroninė, todėl paskutiniai įrašai prieš gedimą naudotojams buvo patvirtinti, bet Amerikos nepasiekė. Jie prarasti arba geriausiu atveju įstrigo Europoje, kol ji sugrįš. Kiek duomenų leidžiama prarasti per gedimą, vadinama **RPO** (recovery point objective). Esant asinchroninei replikacijai jis didesnis už nulį.`,
    },
    cap: {
      title: 'CAP: suderinamumas ar prieinamumas',
      body: `Europa sugrįžo, ir lentoje jos [[db|duomenų bazė]] iškart vėl tapo lydere. Realybėje tai sunkiausia akimirka: senoji lyderė nieko nežino apie įrašus, kuriuos Amerika priėmė per gedimą, o Amerikos nepasiekė paskutiniai Europos įrašai. Prieš vėl priimant įrašus kažkas turi nuspręsti, kuri kopija teisinga.

Dar blogiau – **tinklo atskyrimas** (partition): ryšys tarp regionų nutrūksta, bet abu veikia. **CAP teorema** teigia: tinklo atskyrimo metu sistema su duomenų kopijomis negali būti kartu **suderinta** (consistency: kiekvienas skaitymas mato naujausią įrašą) ir **prieinama** (availability: kiekviena užklausa gauna atsakymą). Tenka rinktis.

**Suderinamumas:** Amerika atsisako priimti įrašus, kol ryšys grįš. Amerikiečiai mato klaidas, užtat kopijos nesiskiria. Taip elgiasi bankai ir biržos. **Prieinamumas:** abu regionai toliau priima įrašus, o kopijos vėliau suderinamos: laimi naujausias įrašas arba kopijos sujungiamos pagal dalykinės srities taisykles. Du krepšelius galima sujungti, dviejų nurašymų iš vienos sąskaitos – ne. Taip elgiasi socialiniai tinklai ir parduotuvės.

Todėl automatinis paaukštinimas pavojingas. Jei Amerika tinklo atskyrimą palaikys gedimu, lyderių bus dvi: tai **split brain** („suskilusios smegenys“). Tikros sistemos repliką paaukština tik tada, kai už tai balsuoja stebėtojų dauguma, o stebėtojai dažnai statomi trečiame regione.`,
    },
    summary: {
      title: 'Santrauka',
      body: ({ sim }) =>
        `Antrasis regionas davė du dalykus: tolimi naudotojai aptarnaujami arti jų, o paslauga išgyvena viso regiono praradimą. p95 sumažėjo iki ${p95(sim)}. Lėčiausios užklausos dabar – įrašai iš Amerikos, keliaujantys pas [[db|lyderę]], ir ta skaitymo dalis, kurią JAV serveriai siunčia ten pat.

Kaina: sistema kainuoja ${usd(sim.costPerHour)} per valandą vietoj 1,90 $, įrašai vis dar kerta vandenyną, o kiekviena duomenų kopija atneša pasirinkimą tarp suderinamumo ir prieinamumo. Kad ir įrašai taptų vietiniai, reikia lyderio kiekviename regione ir konfliktų sprendimo arba duomenis reikia padalyti pagal geografiją: europiečių paskyros gyvena Europoje, amerikiečių – JAV. Tai skaidymas (sharding, 9 pamoka), pritaikytas geografijai.

12 pamokoje vienas įvykių srautas maitins paiešką ir analitiką.`,
    },
  },
  annotations: {
    nearTrip: sim => `${n(incoming(sim, 'users-eu'))} rps · arti`,
    farTrip: sim =>
      `${n(incoming(sim, 'users-us'))} rps · +${crossing} ms už vandenyno`,
    noAnswer: sim => `atsakymo nėra · klaidos ${percent(sim.errorRate)}`,
    leader: sim => `lyderė · ${n(incoming(sim, 'db'))} rps`,
    replicaIdle: sim => `bazės kopija · ${n(incoming(sim, 'replica-1'))} rps`,
    promoted: sim => `paaukštinta · ${n(incoming(sim, 'replica-1'))} rps`,
    detour: sim =>
      `→ JAV · +${crossing} ms · klaidos ${percent(sim.errorRate)}`,
    oldLeader: () => 'grįžo · be JAV įrašų',
    lag: sim => `${n(incoming(sim, 'replica-1'))} rps · atsilieka`,
    writesHere: () => 'lyderė · čia keliauja kiekvienas įrašas',
  },
  tasks: {
    'build-us': {
      prompt:
        'Sukurkite sistemos kopiją JAV: amerikiečiai turi būti aptarnaujami namie, o paslauga turi išgyventi Europos praradimą.',
      goals: {
        'two-entrances': 'Naudotojai sujungti su dviem balansuotuvais',
        'reads-replica': 'Serveris sujungtas su replika',
        'holds-load': 'Atlaiko 500 rps, kai klaidų mažiau nei 1 %',
        fast: 'p95 ne daugiau kaip 160 ms esant 500 rps',
        'survives-eu':
          'Išgyvena Europos praradimą esant 500 rps, kai klaidų ne daugiau kaip 1 %',
      },
      hints: [
        'Amerikiečiams viskas reikalinga arti: įėjimas, serveriai ir duomenys. Duomenys jau yra: replika zonoje „JAV“.',
        'Pastatykite zonoje „JAV“ balansuotuvą ir du serverius: kai Europa suges, jie priims visus 500 rps. Sujunkite balansuotuvą su abiem serveriais, o kiekvieną serverį – su baze (įrašai) ir su replika. Tada sujunkite abi naudotojų grupes su naujuoju balansuotuvu.',
        'Zonoje „JAV“ atsirado punktyrinis kontūras. Pastatykite blokus ten ir nutieskite pažymėtus ryšius.',
      ],
      solvedNote:
        'Amerikiečiai aptarnaujami namie. Kai Europa sugenda, JAV pusė priima visus, o replika perima įrašus.',
    },
  },
} satisfies LessonTexts<typeof lesson>
