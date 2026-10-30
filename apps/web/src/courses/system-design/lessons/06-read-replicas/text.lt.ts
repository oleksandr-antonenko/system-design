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
  title: 'Read replicas. Database kopijos skaitymui',
  summary:
    'Read replicas, replication lag, failover ir kodėl visi įrašai vis tiek keliauja į primary.',
  preview: {
    alt: 'Schema: įrašai keliauja į primary database, o skaitymai pasiskirsto tarp read replicas, kurios kopijuoja jos duomenis su nedideliu replication lag.',
  },
  steps: {
    'one-database': {
      title: 'Penki „Server“ blokai, viena database',
      body: ({ sim }) =>
        `Internetinė parduotuvė išaugo. [[users|Users]] per [[lb|load balancer]] patenka į penkis „Server“ blokus, nuo [[app1|app1]] iki [[app5|app5]], o visi jie skaito ir rašo duomenis į vieną [[db|database]].

Server blokai yra stateless (2 pamoka), todėl juos pridėti lengva (3 pamoka). Su database kitaip: ji viena ir atlaiko apie **${n(1500)} rps**. Dabar į ją ateina ${n(incoming(sim, 'db'))} rps, taigi ji jau apkrauta ${percent(utilization(sim, 'db'))}.

Dauguma šių užklausų – **skaitymas**: „Mano užsakymai“, paskyra, rekomendacijos, pristatymo būsena. Tik maždaug viena užklausa iš penkių keičia duomenis (užsakymas, krepšelis, mokėjimas) – tai **rašymas**. Cache iš 4 pamokos padeda, kai daug žmonių skaito tą patį, pavyzdžiui, populiarios prekės puslapį. Čia kiekvienas naudotojas skaito savo duomenis, tas pats įrašas retai prašomas du kartus, ir cache hit būtų nedaug. Todėl cache lentoje nėra.`,
    },
    'evening-peak': {
      title: 'Vakaro pikas',
      body: ({ sim }) =>
        `Vakare apkrova išauga iki **${n(sim.load)} rps**. Server blokai susitvarko: kiekvienas apkrautas ${percent(utilization(sim, 'app1'))}. Tačiau visos užklausos suteka į vieną [[db|database]], ir ji gauna ${n(sim.nodes['db']?.dropped ?? 0)} rps daugiau, nei gali apdoroti. Tos užklausos prarandamos: naudotojai gauna klaidą, o prietaisas „Klaidos“ rodo ${percent(sim.errorRate)}.

Dar vienas server nepadės: jis siųs savo užklausas į tą pačią database. Galingesnė database kurį laiką padės, bet ir ji turi lubas, o kaina auga greičiau nei galia, kaip ir su server 1 pamokoje.`,
    },
    'reads-and-writes': {
      title: 'Skaitymą galima padauginti',
      body: ({ sim }) =>
        `Pažiūrėkite, kuo užsiėmusi [[db|database]]: iš jos ${n(incoming(sim, 'db'))} rps skaitymui tenka ${n(reads(sim))}, o rašymui – tik ${n(writes(sim))}. Jei skaitymą perimtų kas nors kitas, database liktų didelė atsarga.

Skaitymas duomenų nekeičia, todėl į jį gali atsakyti bet kuri tiksli database **kopija**. Tokių kopijų palaikymas vadinamas **replikacija** (replication). Pagrindinė database vadinama **primary** (lietuviškai – pagrindinė bazė), arba leader (lyderė). Ji priima visus įrašus ir kiekvieną pakeitimą užrašo į **replication log** (lietuviškai – replikacijos žurnalas). **Replica** (lietuviškai – replika), arba follower (sekėja), – kopija, kuri gauna šį žurnalą, pritaiko tuos pačius pakeitimus ta pačia tvarka ir atsako į skaitymo užklausas.

Rašoma **tik į primary**. Jei dvi kopijos priimtų įrašus nepriklausomai, jos galėtų atlikti vienas kitam prieštaraujančius pakeitimus: pavyzdžiui, abi parduotų paskutinę prekę sandėlyje.`,
    },
    'add-replicas': {
      title: 'Užduotis: read replicas',
      body: `Paletėje atsirado blokas „Read replica“. **Read replica** (lietuviškai – skaitymo replika) – replica, kuri atsako tik į skaitymo užklausas. Server, prijungtas ir prie database, ir prie read replica blokų, įrašus siunčia tik į database, o skaitymą po lygiai dalija tarp database ir visų savo „Read replica“ blokų.

Replica – irgi server, ir ji gali sugesti. Jei vienintelė replica sugenda, visas jos skaitymas grįžta į primary, ir ji vėl perkraunama. Prisiminkite **N+1** taisyklę iš 3 pamokos.`,
    },
    'replication-lag': {
      title: 'Replication lag',
      body: `Dabar [[db|primary]] priima visus įrašus ir savo skaitymo dalį, o [[replica-1|replica-1]] atsako tik į skaitymo užklausas.

Kopijavimas nėra akimirksnis. Primary patvirtina įrašą iš karto, o į replica jį nusiunčia šiek tiek vėliau. Tai **asinchroninė replikacija** (asynchronous replication), o delsa vadinama **replication lag** (lietuviškai – replikacijos vėlavimas). Paprastai tai milisekundės, bet esant apkrovai ar po tinklo trikdžių replication lag išauga iki sekundžių.

Ona pateikia užsakymą, ir įrašas keliauja į primary. Kita jos užklausa, „Mano užsakymai“, patenka į replica, kurios pakeitimas dar nepasiekė, ir užsakymo sąraše nėra. Ona nusprendžia, kad užsakymas dingo, ir pateikia jį dar kartą. Skaitymas iš replica yra **eventually consistent** (lietuviškai – galiausiai nuoseklus): replica pasivys primary, bet ne iš karto.

Įprastas sprendimas vadinamas **read-your-own-writes** (lietuviškai – „skaityk savo įrašus“): kelias sekundes po to, kai naudotojas ką nors įrašė, jo duomenys skaitomi iš primary. Svarbius puslapius, pavyzdžiui, krepšelį ir mokėjimą, galima visada skaityti iš primary. Kitas variantas – **sinchroninė replikacija** (synchronous replication): primary laukia, kol replica patvirtins įrašą. Replication lag tada nėra, bet kiekvienas įrašas tampa lėtesnis, o viena lėta replica stabdo visus įrašus.`,
    },
    failover: {
      title: 'Primary sugedo',
      body: ({ sim }) =>
        `Pačiame piko įkarštyje sugenda [[db|primary]] diskas. Be replica tai būtų 2 pamoka iš naujo: duomenys nepasiekiami, ir visos užklausos baigiasi klaida.

Tačiau kiekviena replica turi visą kopiją. Sistema pastebi, kad primary neatsako, ir **paaukština** (promote) vieną replica: ji tampa nauja primary ir priima įrašus, kitos replica ima sekti ją, o server blokai persijungia į ją. Tai vadinama **failover** (lietuviškai – perjungimas gedimo atveju). ${
          sim.errorRate > 0.01
            ? `Tiesa, persijungti pavyko ne visiems „Server“ blokams: klaidų ${percent(sim.errorRate)}. Server, neprijungtas nė prie vienos replica, neturi kur rašyti ir praranda savo užklausas.`
            : `Klaidų ${percent(sim.errorRate)}: replica blokai atlaiko visus ${n(sim.load)} rps.`
        }

Failover turi kainą. Esant asinchroninei replikacijai, paskutiniai įrašai, kurie nespėjo pasiekti replica, prarandami. Be to, du mazgai jokiu būdu neturi vienu metu laikyti savęs primary: tai vadinama **split brain** (lietuviškai – „suskilusios smegenys“). Kad taip nenutiktų, nauja primary renkama kelių mazgų balsavimu.`,
    },
    summary: {
      title: 'Santrauka',
      body: ({ sim }) =>
        `Senoji primary sutaisyta. Lentoje ji vėl primary; praktikoje ji paprastai grįžta kaip naujosios primary replica.

Read replicas **plečia skaitymą**: kiekviena perima savo dalį, ir jų galima pridėti. Be to, tai **hot standby** (lietuviškai – karštasis rezervas): kai primary sugenda, replica užima jos vietą per kelias sekundes, o ne per valandas, kurių prireiktų atkūrimui iš atsarginės kopijos (backup). Kaina – replication lag, į kurį programa turi atsižvelgti, ir pačios read replicas – po 0,60 $ per valandą už kiekvieną.

**Rašymui** read replicas nepadeda. Visas rašymas, ${n(writes(sim))} rps, vis tiek keliauja į [[db|primary]], o kiekviena replica pakartoja kiekvieną pakeitimą, kad jos kopija neatsiliktų (lenta skaičiuoja tik replica aptarnaujamą skaitymą). Kai vien rašymas nebetilps vienoje database, duomenis teks padalyti kelioms database. Tai **sharding** (lietuviškai – skaidymas į šardus), 9 pamokos tema.`,
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
    primaryDown: sim => `primary neveikia · klaidos ${percent(sim.errorRate)}`,
    promoted: sim => `nauja primary · ${n(incoming(sim, 'replica-1'))} rps`,
    writesStayHere: sim => `visas rašymas, ${n(writes(sim))} rps · tik čia`,
  },
  tasks: {
    'add-replicas': {
      prompt: `Paskirstykite skaitymą taip, kad database liktų atsarga esant ${n(1600)} rps, net jei viena replica sugestų.`,
      goals: {
        'replica-exists': 'Lentoje yra blokas „Read replica“',
        'servers-read-replicas': 'Server blokai prijungti prie „Read replica“',
        'primary-headroom': `Database apkrauta ne daugiau kaip 80 % esant ${n(1600)} rps`,
        'holds-load': `Atlaiko ${n(1600)} rps, kai klaidų mažiau nei 1 %`,
        'spare-replica': 'Atlaiko bet kurio vieno bloko „Read replica“ gedimą',
      },
      hints: [
        'Database užversta skaitymo užklausomis, o į skaitymą gali atsakyti bet kuri duomenų kopija.',
        'Pastatykite du blokus „Read replica“ dešinėje nuo server blokų ir prijunkite kiekvieną server prie abiejų. Ryšius „server → database“ palikite: tik jais keliauja įrašai.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite ten blokus „Read replica“ ir nutieskite pažymėtus ryšius nuo kiekvieno server.',
      ],
      solvedNote:
        'Įrašai keliauja į primary, skaitymas dalijamas trims, ir replica gedimas nebeperkrauna database.',
    },
  },
} satisfies LessonTexts<typeof lesson>
