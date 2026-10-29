import { type SimResult, simulationRules } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`
const incoming = (sim: SimResult, id: string) => sim.nodes[id]?.incoming ?? 0
const utilization = (sim: SimResult, id: string) =>
  sim.nodes[id]?.utilization ?? 0
const served = (sim: SimResult) =>
  ['app1', 'app2', 'app3', 'app4', 'app5'].reduce(
    (sum, id) => sum + (sim.nodes[id]?.served ?? 0),
    0,
  )
const writes = (sim: SimResult) => served(sim) * simulationRules.writeShare
const reads = (sim: SimResult) => served(sim) - writes(sim)

export default {
  title: 'Duomenų bazės replikacija',
  summary:
    'Skaitymo replikos, replikacijos vėlavimas, perjungimas gedimo atveju ir kodėl visi įrašai vis tiek keliauja į pagrindinę bazę.',
  steps: {
    'one-database': {
      title: 'Penki serveriai, viena bazė',
      body: ({ sim }) =>
        `Internetinė parduotuvė išaugo. [[users|Naudotojai]] per [[lb|balansuotuvą]] patenka į penkis serverius, nuo [[app1|app1]] iki [[app5|app5]], o visi jie skaito ir rašo duomenis į vieną [[db|duomenų bazę]].

Serveriai nelaiko būsenos (2 pamoka), todėl juos pridėti lengva (3 pamoka). Su baze kitaip: ji viena ir atlaiko apie **${n(1500)} rps**. Dabar į ją ateina ${n(incoming(sim, 'db'))} rps, taigi ji jau apkrauta ${percent(utilization(sim, 'db'))}.

Dauguma šių užklausų – **skaitymas**: „Mano užsakymai“, paskyra, rekomendacijos, pristatymo būsena. Tik maždaug viena užklausa iš penkių keičia duomenis (užsakymas, krepšelis, mokėjimas) – tai **rašymas**. Podėlis (cache) iš 4 pamokos padeda, kai daug žmonių skaito tą patį, pavyzdžiui, populiarios prekės puslapį. Čia kiekvienas naudotojas skaito savo duomenis, tas pats įrašas retai prašomas du kartus, ir podėlis beveik nepataikytų. Todėl podėlio lentoje nėra.`,
    },
    'evening-peak': {
      title: 'Vakaro pikas',
      body: ({ sim }) =>
        `Vakare apkrova išauga iki **${n(sim.load)} rps**. Serveriai susitvarko: kiekvienas apkrautas ${percent(utilization(sim, 'app1'))}. Tačiau visos užklausos suteka į vieną [[db|bazę]], ir ji gauna ${n(sim.nodes['db']?.dropped ?? 0)} rps daugiau, nei gali apdoroti. Tos užklausos prarandamos: naudotojai gauna klaidą, o prietaisas „Klaidos“ rodo ${percent(sim.errorRate)}.

Dar vienas serveris nepadės: jis siųs savo užklausas į tą pačią bazę. Galingesnė bazė kurį laiką padės, bet ir ji turi lubas, o kaina auga greičiau nei galia, kaip ir su serveriais 1 pamokoje.`,
    },
    'reads-and-writes': {
      title: 'Skaitymą galima padauginti',
      body: ({ sim }) =>
        `Pažiūrėkite, kuo užsiėmusi [[db|bazė]]: iš jos ${n(incoming(sim, 'db'))} rps skaitymui tenka ${n(reads(sim))}, o rašymui – tik ${n(writes(sim))}. Jei skaitymą perimtų kas nors kitas, bazei liktų didelė atsarga.

Skaitymas duomenų nekeičia, todėl į jį gali atsakyti bet kuri tiksli bazės **kopija**. Tokių kopijų palaikymas vadinamas **replikacija**. Pagrindinė bazė vadinama **primary** (arba lyderiu). Ji priima visus įrašus ir kiekvieną pakeitimą užrašo į **replikacijos žurnalą**. **Replikos** (sekėjos) gauna šį žurnalą, pritaiko tuos pačius pakeitimus ta pačia tvarka ir atsako į skaitymo užklausas.

Rašoma **tik į pagrindinę bazę**. Jei dvi kopijos priimtų įrašus nepriklausomai, jos galėtų atlikti vienas kitam prieštaraujančius pakeitimus: pavyzdžiui, abi parduotų paskutinę prekę sandėlyje.`,
    },
    'add-replicas': {
      title: 'Užduotis: skaitymo replikos',
      body: `Paletėje atsirado **bazės replika**. Serveris, prijungtas prie bazės ir prie replikų, įrašus siunčia tik į bazę, o skaitymą po lygiai dalija tarp bazės ir savo replikų.

Replika – irgi serveris, ir ji gali sugesti. Jei vienintelė replika sugenda, visas jos skaitymas grįžta į pagrindinę bazę, ir ji vėl perkraunama. Prisiminkite **N+1** taisyklę iš 3 pamokos.`,
    },
    'replication-lag': {
      title: 'Replikacijos vėlavimas',
      body: `Dabar [[db|pagrindinė bazė]] priima visus įrašus ir savo skaitymo dalį, o [[replica-1|replica-1]] atsako tik į skaitymo užklausas.

Kopijavimas nėra akimirksnis. Pagrindinė bazė patvirtina įrašą iš karto, o replikoms jį nusiunčia šiek tiek vėliau. Tai **asinchroninė replikacija**, o delsa vadinama **replikacijos vėlavimu** (replication lag). Paprastai tai milisekundės, bet esant apkrovai ar po tinklo trikdžių vėlavimas išauga iki sekundžių.

Ona pateikia užsakymą, ir įrašas keliauja į pagrindinę bazę. Kita jos užklausa, „Mano užsakymai“, patenka į repliką, kurios pakeitimas dar nepasiekė, ir užsakymo sąraše nėra. Ona nusprendžia, kad užsakymas dingo, ir pateikia jį dar kartą. Skaitymas iš replikos yra **galiausiai nuoseklus** (eventual consistency): replika pasivys pagrindinę bazę, bet ne iš karto.

Įprastas sprendimas vadinamas **„skaityk savo įrašus“** (read-your-own-writes): kelias sekundes po to, kai naudotojas ką nors įrašė, jo duomenys skaitomi iš pagrindinės bazės. Svarbius puslapius, pavyzdžiui, krepšelį ir mokėjimą, galima visada skaityti iš pagrindinės bazės. Kitas variantas – **sinchroninė replikacija**: pagrindinė bazė laukia, kol replika patvirtins įrašą. Vėlavimo tada nėra, bet kiekvienas įrašas tampa lėtesnis, o viena lėta replika stabdo visus įrašus.`,
    },
    failover: {
      title: 'Pagrindinė bazė sugedo',
      body: ({ sim }) =>
        `Pačiame piko įkarštyje sugenda [[db|pagrindinės bazės]] diskas. Be replikų tai būtų 2 pamoka iš naujo: duomenys nepasiekiami, ir visos užklausos baigiasi klaida.

Tačiau replikos turi visą kopiją. Sistema pastebi, kad pagrindinė bazė neatsako, ir **paaukština** repliką: ji tampa nauja pagrindine baze ir priima įrašus, kitos replikos ima sekti ją, o serveriai persijungia į ją. Tai vadinama **failover** (perjungimu gedimo atveju). ${
          sim.errorRate > 0.01
            ? `Tiesa, persijungti pavyko ne visiems serveriams: klaidų ${percent(sim.errorRate)}. Serveris, neprijungtas nė prie vienos replikos, neturi kur rašyti ir praranda savo užklausas.`
            : `Klaidų ${percent(sim.errorRate)}: replikos atlaiko visus ${n(sim.load)} rps.`
        }

Perjungimas turi kainą. Esant asinchroninei replikacijai, paskutiniai įrašai, kurie nespėjo pasiekti replikos, prarandami. Be to, du mazgai jokiu būdu neturi vienu metu laikyti savęs pagrindine baze: tai vadinama **split brain** („suskilusios smegenys“). Kad taip nenutiktų, nauja pagrindinė bazė renkama kelių mazgų balsavimu.`,
    },
    summary: {
      title: 'Santrauka',
      body: ({ sim }) =>
        `Senoji pagrindinė bazė sutaisyta. Lentoje ji vėl pagrindinė; praktikoje ji paprastai grįžta kaip naujosios pagrindinės bazės replika.

Replikos **plečia skaitymą**: kiekviena perima savo dalį, ir jų galima pridėti. Be to, tai **karštasis rezervas**: kai pagrindinė bazė sugenda, replika užima jos vietą per kelias sekundes, o ne per valandas, kurių prireiktų atkūrimui iš atsarginės kopijos. Kaina – replikacijos vėlavimas, į kurį programa turi atsižvelgti, ir pačios replikos, po 0,60 $ per valandą už kiekvieną.

**Rašymui** replikos nepadeda. Visas rašymas, ${n(writes(sim))} rps, vis tiek keliauja į [[db|pagrindinę bazę]], o kiekviena replika pakartoja kiekvieną pakeitimą, kad jos kopija neatsiliktų (lenta skaičiuoja tik replikos aptarnaujamą skaitymą). Kai vien rašymas nebetilps vienoje bazėje, duomenis teks padalyti kelioms duomenų bazėms. Tai **skaidymas į šardus** (sharding), 9 pamokos tema.`,
    },
  },
  annotations: {
    dbLoad: sim =>
      `${n(incoming(sim, 'db'))} rps iš ${n(1500)} · ${percent(utilization(sim, 'db'))}`,
    dbOverload: sim =>
      `${n(incoming(sim, 'db'))} rps iš ${n(1500)} · klaidos ${percent(sim.errorRate)}`,
    readsAndWrites: sim =>
      `skaitymas ${n(reads(sim))} · rašymas ${n(writes(sim))} rps`,
    primaryWrites: sim =>
      `rašymas ${n(writes(sim))} rps + skaitymas · ${percent(utilization(sim, 'db'))}`,
    replicaBehind: sim =>
      `skaitymas ${n(incoming(sim, 'replica-1'))} rps · šiek tiek atsilieka`,
    primaryDown: sim =>
      `pagrindinė neveikia · klaidos ${percent(sim.errorRate)}`,
    promoted: sim => `nauja pagrindinė · ${n(incoming(sim, 'replica-1'))} rps`,
    writesStayHere: sim => `visas rašymas, ${n(writes(sim))} rps · tik čia`,
  },
  tasks: {
    'add-replicas': {
      prompt: `Paskirstykite skaitymą taip, kad bazei liktų atsarga esant ${n(1600)} rps, net jei viena replika sugestų.`,
      goals: {
        'replica-exists': 'Lentoje yra bazės replika',
        'servers-read-replicas': 'Serveriai prijungti prie replikos',
        'primary-headroom': `Bazė apkrauta ne daugiau kaip 80 % esant ${n(1600)} rps`,
        'holds-load': `Atlaiko ${n(1600)} rps, kai klaidų mažiau nei 1 %`,
        'spare-replica': 'Atlaiko bet kurios vienos replikos gedimą',
      },
      hints: [
        'Bazė užversta skaitymo užklausomis, o į skaitymą gali atsakyti bet kuri duomenų kopija.',
        'Pastatykite dvi replikas dešinėje nuo serverių ir prijunkite kiekvieną serverį prie abiejų. Ryšius „serveris → bazė“ palikite: tik jais keliauja įrašai.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite replikas ten ir nutieskite pažymėtus ryšius nuo kiekvieno serverio.',
      ],
      solvedNote:
        'Įrašai keliauja į pagrindinę bazę, skaitymas dalijamas trims, ir replikos gedimas nebeperkrauna bazės.',
    },
  },
} satisfies LessonTexts<typeof lesson>
