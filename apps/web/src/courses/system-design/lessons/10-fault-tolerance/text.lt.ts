import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`
const dollars = (value: number) => `${value.toFixed(2).replace('.', ',')} $`

export default {
  title: 'Failover. Sistema išgyvena gedimą',
  summary:
    'SPOF, vienintelis gedimo taškas: antras load balancer, read replica, kuri pakeičia database, health check, failover ir skirtumas tarp availability ir durability.',
  preview: {
    alt: 'Schema: failover – sugedus load balancer ir database, srautas eina per atsarginę porą, ir neliko single point of failure.',
  },
  steps: {
    'count-spares': {
      title: 'Suskaičiuokime atsarginius',
      body: `Vėl parduotuvė: [[users|Users]] per [[lb-1|load balancer]] kreipiasi į tris „Server“ blokus, o šie duomenis rašo į [[db|database]]. Apkrova 600 rps, viskas žalia.

3 pamokoje servers gavo **N+1** taisyklę: jų yra trys, o šiai apkrovai pakanka dviejų. Jei bet kuris sugenda, jo dalį perima likę. Dabar pažiūrėkite į kitus blokus. Load balancer vienas ir database viena, ir atsarginių jie neturi.`,
    },
    'balancer-down': {
      title: 'Sugedo load balancer',
      body: `Load balancer irgi yra server, tik su kita programa. Naktį įdiegta nevykusi konfigūracija, atnaujintas branduolys, sudegė tinklo plokštė – ir [[lb-1|lb-1]] nustojo atsakinėti.

Visi trys „Server“ blokai tvarkingi, bet stovi be darbo: naudotojai žino vieną adresą, ir juo niekas neatsako. Klaidos 100 %. **Health check** (sveikatos patikra) čia irgi nepadės: sugedo būtent tas blokas, kuris ją atlieka.`,
    },
    'database-down': {
      title: 'Sugedo database',
      body: `Load balancer grįžo. Dabar sugenda [[db|database]]: diske baigėsi vieta, mašina persikrovė po atnaujinimo arba duomenų centre visa spinta liko be elektros.

Servers ir toliau gauna užklausas, bet neturi kur skaityti ir rašyti: savų duomenų jie nelaiko (2 pamoka). Kiekviena užklausa baigiasi klaida, ir klaidų vėl 100 %. Servers ir load balancer be savo vienintelės database yra bevertiai.

Yra kai kas blogiau už prastovą. Jei miršta pats diskas, o kopijos nėra, parduotuvės užsakymai dingsta visam laikui. Netekti prieigos valandai ir netekti duomenų visam laikui – dvi skirtingos bėdos, ir prie to dar grįšime.`,
    },
    'add-spares': {
      title: 'Užduotis: atsarginiai',
      body: `Blokas, kurio gedimas sustabdo visą sistemą, vadinamas **SPOF** (single point of failure, lietuviškai – vienintelis gedimo taškas). Tai gydoma **dubliavimu** (redundancy): antru kiekvieno tokio bloko egzemplioriumi ir būdu į jį persijungti.

Įėjimui tai antras load balancer, apie kurį taip pat žino naudotojai. Duomenims – read replica: database kopija, kuri gauna kiekvieną įrašą iš **primary** (pagrindinės database). Read replica pažįstate iš 6 pamokos, ten ji priėmė skaitymą. Jei primary sugenda, read replica **paaukštinama** (promote): ji pradeda priimti rašymą, o servers persijungia į ją. Tam servers turi būti sujungti ir su [[db|database]], ir su read replica.

Load balancer ir read replica jau paletėje.`,
    },
    'balancer-failover': {
      title: 'Load balancer vėl sugenda',
      body: ({ sim }) =>
        `Pakartokime naktį su nevykusia konfigūracija: [[lb-1|lb-1]] vėl neveikia. Dabar naudotojai eina į [[lb-2|lb-2]], ir jis vienas atlaiko visus ${n(sim.load)} rps, klaidos ${percent(sim.errorRate)}. Load balancer atlaiko iki 5000 rps, tad vieno užtenka net piko metu. Tai ir yra N+1 įėjimui.

Iš kur naudotojai žino, kur eiti? Iš health check. Kas kelias sekundes DNS paslauga klausia kiekvieno load balancer „ar gyvas?“ ir po kelių vienas po kito praleistų atsakymų nustoja dalyti jo adresą. Kelių, o ne vieno, kad vienas pamestas paketas nesukeltų perjungimo. Todėl perjungimas niekada nebūna akimirksniu: kol patikros nepavyksta ir nepasensta DNS cache, dalis užklausų dar keliauja mirusiu adresu – nuo kelių sekundžių iki minutės. Lenta rodo sistemą jau po perjungimo.`,
    },
    'database-failover': {
      title: 'Read replica tampa primary',
      body: ({ sim }) =>
        `Dabar sugenda [[db|database]]. Servers nebegali į ją rašyti ir kreipiasi į [[replica-1|read replica]]: ji paaukštinama ir priima visą srautą – ir rašymą, ir skaitymą. Klaidos ${percent(sim.errorRate)}. Toks persijungimas į atsarginį bloką vadinamas **failover** (perjungimas į rezervą).

Database failover lėtesnis nei load balancer failover. Pirmiausia reikia įsitikinti, kad primary tikrai mirusi, o ne tik lėta, kitaip atsiras dvi primary, ir kiekviena priims savo įrašus. Tada read replica paaukštinama, ir servers prisijungia iš naujo. Paprastai tai užtrunka dešimtis sekundžių, ir visas šis laikas, **failover time**, tiesiogiai atimamas iš laiko, kai sistema prieinama.

Su duomenimis irgi yra kabliukas. Read replica įrašus paprastai gauna su nedideliu vėlavimu, **replication lag**: replikacija asinchroninė (asynchronous replication). Užsakymai, kuriuos primary patvirtino paskutinę sekundę, bet nespėjo perduoti, dingsta. Svetainė veikia, bet kelių užsakymų nėra: sistema išlaikė **availability** (prieinamumą), bet nukentėjo **durability** (duomenų patvarumas).`,
    },
    summary: {
      title: 'Santrauka',
      body: ({ sim }) =>
        `Senoji primary sutaisyta. Tikrovėje ji grįžta kaip naujosios primary read replica, o mūsų lentoje tiesiog užima savo ankstesnę vietą.

Dabar kiekvienas blokas turi atsarginį: load balancer – antrą load balancer, servers – vieną daugiau, nei reikia (N+1), database – read replica. Kaina matyti prietaise „Kaina“: ${dollars(sim.costPerHour)} per valandą vietoj 2,30 $. Dubliavimas visada kainuoja, todėl jis pirmiausia taikomas ten, kur vienas gedimas sustabdo viską.

**Availability** (prieinamumas) – laiko dalis, kai sistema atsako. Jis skaičiuojamas „devynetais“: 99,9 % leidžia beveik 9 valandas prastovos per metus, 99,99 % – tik 53 minutes. **Durability** (patvarumas) – pažadas, kad patvirtinti duomenys niekada nedings. Read replica padidina availability, bet lygiai taip pat stropiai nukopijuoja ir atsitiktinį ištrynimą. Durability užtikrinti reikia **backups** (atsarginių kopijų), o vertingiausiems duomenims – sinchroninės replikacijos (synchronous replication).

Mūsų atsarginiai blokai kol kas stovi viename duomenų centre. Praktikoje jie išskirstomi po **availability zones** (prieinamumo zonas): atskirus pastatus su savo elektra ir tinklu. O ką daryti, kai sugenda visas regionas (region), aptarsime 11 pamokoje.`,
    },
  },
  annotations: {
    single: () => 'vienintelis · atsarginio nėra',
    nPlusOne: sim => `be vieno: po ${n(sim.load / 2)} rps`,
    outage: sim => `nepasiekiamas · klaidos ${percent(sim.errorRate)}`,
    idle: sim =>
      `${n(sim.nodes['app2']?.incoming ?? 0)} rps · tvarkingas, bet be darbo`,
    nowhereToWrite: sim =>
      `${n(sim.nodes['app2']?.incoming ?? 0)} rps · nėra kur rašyti`,
    takesAll: sim =>
      `visi ${n(sim.load)} rps · klaidos ${percent(sim.errorRate)}`,
    promoted: sim => `dabar primary · klaidos ${percent(sim.errorRate)}`,
    pair: () => 'vienas iš dviejų · bet kuris susitvarkys',
    copies: () => 'primary · read replica pasiruošusi pakeisti',
  },
  tasks: {
    'add-spares': {
      prompt:
        'Pašalinkite SPOF: parduotuvė turi atlaikyti bet kurio load balancer, server ar database gedimą.',
      goals: {
        'two-balancers': 'Users sujungti su dviem „Load balancer“ blokais',
        'replica-exists': 'Lentoje yra read replica',
        'survives-failure':
          'Esant 600 rps, atlaiko bet kurio load balancer, server ar database gedimą, kai klaidų ne daugiau nei 1 %',
      },
      hints: [
        'Paklauskite apie kiekvieną bloką: kas nutiks, jei jis suges? Servers atsarginį jau turi, o load balancer ir database – ne.',
        'Pridėkite antrą load balancer, sujunkite jį su visais trimis „Server“ blokais ir prijunkite prie jo bloką „Users“. Tada pridėkite read replica ir sujunkite su ja kiekvieną server, neištrindami ryšių su database.',
        'Lentoje atsirado punktyriniai kontūrai. Pastatykite ten load balancer ir read replica ir nutieskite pažymėtus ryšius.',
      ],
      solvedNote:
        'Dabar gali sugesti bet kuris vienas blokas: srautas iš Users pereina į kitą load balancer, o read replica pakeičia database.',
    },
  },
} satisfies LessonTexts<typeof lesson>
