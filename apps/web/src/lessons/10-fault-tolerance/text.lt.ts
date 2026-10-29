import { formatNumber } from '../../i18n/format'
import type { LessonTexts } from '../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('lt', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)} %`
const dollars = (value: number) => `${value.toFixed(2).replace('.', ',')} $`

export default {
  title: 'Atsparumas gedimams',
  summary:
    'Vienintelis gedimo taškas: antras balansuotuvas, replika, kuri pakeičia bazę, sveikatos patikra, perjungimas ir skirtumas tarp prieinamumo ir duomenų patvarumo.',
  steps: {
    'count-spares': {
      title: 'Suskaičiuokime atsarginius',
      body: `Vėl parduotuvė: [[users|naudotojai]] per [[lb-1|balansuotuvą]] kreipiasi į tris serverius, o serveriai laiko duomenis [[db|duomenų bazėje]]. Apkrova 600 rps, viskas žalia.

3 pamokoje serveriams pritaikėme **N+1** taisyklę: jų yra trys, o šiai apkrovai pakanka dviejų. Jei bet kuris sugenda, jo dalį perima likę. Dabar pažiūrėkite į kitus blokus. Balansuotuvas vienas ir bazė viena, ir atsarginių jie neturi.`,
    },
    'balancer-down': {
      title: 'Sugedo balansuotuvas',
      body: `Balansuotuvas irgi yra serveris, tik su kita programa. Naktį įdiegta nevykusi konfigūracija, atnaujintas branduolys, sudegė tinklo plokštė – ir [[lb-1|lb-1]] nustojo atsakinėti.

Visi trys serveriai tvarkingi, bet stovi be darbo: naudotojai žino vieną adresą, ir juo niekas neatsako. Klaidos 100 %. Sveikatos patikra čia irgi nepadės: sugedo būtent tas blokas, kuris ją atlieka.`,
    },
    'database-down': {
      title: 'Sugedo bazė',
      body: `Balansuotuvas grįžo. Dabar sugenda [[db|duomenų bazė]]: diske baigėsi vieta, mašina persikrovė po atnaujinimo arba duomenų centre visa spinta liko be elektros.

Serveriai ir toliau gauna užklausas, bet neturi kur skaityti ir rašyti: savų duomenų jie nelaiko (2 pamoka). Kiekviena užklausa baigiasi klaida, ir klaidų vėl 100 %. Trys serveriai ir balansuotuvas be savo vienintelės bazės yra bevertiai.

Yra kai kas blogiau už prastovą. Jei miršta pats diskas, o kopijos nėra, parduotuvės užsakymai dingsta visam laikui. Netekti prieigos valandai ir netekti duomenų visam laikui – dvi skirtingos bėdos, ir prie to dar grįšime.`,
    },
    'add-spares': {
      title: 'Užduotis: atsarginiai',
      body: `Blokas, kurio gedimas sustabdo visą sistemą, vadinamas **vieninteliu gedimo tašku**. Tai gydoma **dubliavimu** (redundancy): antru kiekvieno tokio bloko egzemplioriumi ir būdu į jį persijungti.

Įėjimui tai antras balansuotuvas, apie kurį taip pat žino naudotojai. Duomenims – **replika**: bazės kopija, kuri gauna kiekvieną pagrindinės bazės įrašą. Ją pažįstate iš 6 pamokos, ten ji priėmė skaitymą. Jei pagrindinė bazė sugenda, replika **paaukštinama**: ji pradeda priimti rašymą, o serveriai persijungia į ją. Tam serveriai turi būti sujungti ir su [[db|baze]], ir su replika.

Balansuotuvas ir replika jau paletėje.`,
    },
    'balancer-failover': {
      title: 'Balansuotuvas vėl sugenda',
      body: ({ sim }) =>
        `Pakartokime naktį su nevykusia konfigūracija: [[lb-1|lb-1]] vėl neveikia. Dabar naudotojai eina į [[lb-2|lb-2]], ir jis vienas atlaiko visus ${n(sim.load)} rps, klaidos ${percent(sim.errorRate)}. Balansuotuvas atlaiko iki 5000 rps, tad vieno užtenka net piko metu. Tai ir yra N+1 įėjimui.

Iš kur naudotojai žino, kur eiti? Iš **sveikatos patikros** (health check). Kas kelias sekundes DNS paslauga klausia kiekvieno balansuotuvo „ar gyvas?“ ir po kelių iš eilės praleistų atsakymų nustoja dalyti jo adresą. Kelių, o ne vieno, kad vienas pamestas paketas nesukeltų perjungimo. Todėl perjungimas niekada nebūna akimirksniu: kol patikros nepavyksta ir nepasibaigia DNS podėliai, dalis užklausų dar keliauja mirusiu adresu – nuo kelių sekundžių iki minutės. Lenta rodo sistemą jau po perjungimo.`,
    },
    'database-failover': {
      title: 'Replikos paaukštinimas',
      body: ({ sim }) =>
        `Dabar sugenda [[db|duomenų bazė]]. Serveriai nebegali į ją rašyti ir kreipiasi į [[replica-1|repliką]]: ji paaukštinama ir priima visą srautą – ir rašymą, ir skaitymą. Klaidos ${percent(sim.errorRate)}. Toks persijungimas į atsarginį bloką vadinamas **failover**.

Bazės perjungimas lėtesnis nei balansuotuvo. Pirmiausia reikia įsitikinti, kad pagrindinė tikrai mirusi, o ne tik lėta, kitaip atsiras dvi pagrindinės bazės, ir kiekviena priims savo įrašus. Tada replika paaukštinama, ir serveriai prisijungia iš naujo. Paprastai tai užtrunka dešimtis sekundžių, ir **perjungimo laikas** tiesiogiai atimamas iš laiko, kai sistema prieinama.

Su duomenimis irgi yra kabliukas. Replika įrašus paprastai gauna su nedideliu vėlavimu (asinchroninė replikacija). Užsakymai, kuriuos pagrindinė bazė patvirtino paskutinę sekundę, bet nespėjo perduoti, dingsta. Svetainė veikia, bet kelių užsakymų nėra: sistema liko **prieinama**, bet nukentėjo duomenų **patvarumas**.`,
    },
    summary: {
      title: 'Santrauka',
      body: ({ sim }) =>
        `Senoji pagrindinė bazė sutaisyta. Tikrovėje ji grįžta kaip naujosios pagrindinės replika, o mūsų lentoje tiesiog užima savo ankstesnę vietą.

Dabar kiekvienas blokas turi atsarginį: du balansuotuvai, N+1 serverių, bazė ir replika. Kaina matyti prietaise „Kaina“: ${dollars(sim.costPerHour)} per valandą vietoj 2,30 $. Dubliavimas visada kainuoja, todėl jis pirmiausia taikomas ten, kur vienas gedimas sustabdo viską.

**Prieinamumas** (availability) – laiko dalis, kai sistema atsako. Jis skaičiuojamas „devynetais“: 99,9 % leidžia beveik 9 valandas prastovos per metus, 99,99 % – tik 53 minutes. **Patvarumas** (durability) – pažadas, kad patvirtinti duomenys niekada nedings. Replika padidina prieinamumą, bet lygiai taip pat stropiai nukopijuoja ir atsitiktinį ištrynimą. Patvarumui reikia **atsarginių kopijų**, o vertingiausiems duomenims – sinchroninės replikacijos.

Mūsų atsarginiai blokai kol kas stovi viename duomenų centre. Praktikoje jie išskirstomi po **prieinamumo zonas**: atskirus pastatus su savo elektra ir tinklu. O ką daryti, kai sugenda visas regionas, aptarsime 11 pamokoje.`,
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
    promoted: sim => `dabar pagrindinė · klaidos ${percent(sim.errorRate)}`,
    pair: () => 'vienas iš dviejų · bet kuris susitvarkys',
    copies: () => 'pagrindinė · replika pasiruošusi pakeisti',
  },
  tasks: {
    'add-spares': {
      prompt:
        'Pašalinkite vienintelius gedimo taškus: parduotuvė turi atlaikyti bet kurio balansuotuvo, serverio ar bazės gedimą.',
      goals: {
        'two-balancers': 'Naudotojai sujungti su dviem balansuotuvais',
        'replica-exists': 'Lentoje yra bazės replika',
        'survives-failure':
          'Esant 600 rps, atlaiko bet kurio balansuotuvo, serverio ar bazės gedimą, kai klaidų ne daugiau nei 1 %',
      },
      hints: [
        'Paklauskite apie kiekvieną bloką: kas nutiks, jei jis suges? Serveriai atsarginį jau turi, o balansuotuvas ir bazė – ne.',
        'Pridėkite antrą balansuotuvą, sujunkite jį su visais trimis serveriais ir prijunkite prie jo naudotojus. Tada pridėkite repliką ir sujunkite su ja kiekvieną serverį, neištrindami ryšių su baze.',
        'Lentoje atsirado punktyriniai kontūrai. Pastatykite ten balansuotuvą ir repliką ir nutieskite pažymėtus ryšius.',
      ],
      solvedNote:
        'Dabar gali sugesti bet kuris vienas blokas: naudotojai pereina į kitą balansuotuvą, o replika pakeičia bazę.',
    },
  },
} satisfies LessonTexts<typeof lesson>
