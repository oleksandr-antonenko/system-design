import type { SimResult } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('lt', Math.round(value))
const indexIn = (sim: SimResult) => sim.nodes['search']?.incoming ?? 0
const analyticsIn = (sim: SimResult) => sim.nodes['worker-1']?.incoming ?? 0

export default {
  title: 'Search index ir event bus. Paieška ir įvykiai',
  summary:
    'Event bus pristato kiekvieną pakeitimą į search index ir į analitiką: publish/subscribe, subscriber lag ir eventual consistency.',
  steps: {
    catalog: {
      title: 'Katalogas',
      body: `Prekyvietė su milijonu prekių. Šioje lentoje kiekviena užklausa – tai katalogo pakeitimas: pardavėjai keičia kainas, likučius ir aprašymus, apie 150 pakeitimų per sekundę. Pardavėjai čia – blokas [[users|Users]]. Jų užklausas priima du „Server“ blokai, [[app1|app1]] ir [[app2|app2]], o kiekvieną pakeitimą išsaugo [[db|database]]. Kaip ir 7 pamokoje, load balancer nenupieštas, kad užtektų vietos.

Database – **source of truth** (tiesos šaltinis): jei kas nors su ja nesutampa, teisi database.`,
    },
    'stale-index': {
      title: 'Paieška atsilieka parą',
      body: `Pirkėjai ieško prekių žodžiais: „raudona medvilninė suknelė“. Database su tuo tvarkosi prastai. Užklausa, pavyzdžiui, LIKE '%raudona suknelė%' perskaito visą lentelę, milijoną eilučių, ir vis tiek nesusitvarko su rašybos klaidomis, žodžių formomis ir rikiavimu pagal aktualumą. Todėl paiešką aptarnauja atskiras sistemos elementas.

**Search index** (lietuviškai – paieškos indeksas) – atskira saugykla, sukurta būtent tokioms užklausoms. Pavyzdžiui, Elasticsearch ar OpenSearch.

[[search|Search index]] jau yra, bet jis perstatomas iš database kopijos kartą per parą, naktį. Dieną pakeitimai jo nepasiekia: užrašas rodo 0 rps. Pardavėjas pakėlė kainą 10 val. ryto, o paieška iki rytojaus rodo senąją. Pirkėjas spusteli „nuo 19 €“ ir prekės puslapyje mato 29 €.

Tų pačių pakeitimų reikia ir analitikams: kainų istorija, kurios prekės baigiasi, kurie pardavėjai aktyvūs. Kiekvienas pakeitimas turi pasiekti kelias vietas iš karto.`,
    },
    'publish-subscribe': {
      title: 'Publish/subscribe',
      body: `Kaip pakeitimą nugabenti į search index ir į analitiką? Yra trys keliai.

**Server pats rašo visur.** Įrašęs pakeitimą į database, jis dar atnaujina search index ir nusiunčia pakeitimą analitikai. Pardavėjas laukia visų trijų įrašų. Jei search index nepasiekiamas, išsaugojimas arba nepavyksta, arba search index tyliai praranda pakeitimą. O kiekvienas naujas consumer reiškia server kodo pakeitimą ir naują diegimą.

**Queue, kaip 7 pamokoje.** Server palieka pranešimą, consumers jį pasiima iš queue. Bet queue kiekvieną pranešimą atiduoda **vienam** worker ir padalija darbą tarp jų. Jei search index ir analitika imtų iš tos pačios queue, kiekvienas gautų pusę: iš 150 pakeitimų per sekundę po 75. Pusė kainų paieškoje liktų senos, o ataskaitos suskaičiuotų pusę pakeitimų.

**Event bus** (lietuviškai – įvykių magistralė) – tarpininkas, kuris kiekvieną įvykį išdalija visiems, kurie jį prenumeruoja. Server **publikuoja** (publish) vieną įvykį „prekė 42 pakeista“, o event bus pilną **kopiją** atiduoda kiekvienam **subscriber** (prenumeratoriui). Kiekvienas skaito savo tempu, o naujas subscriber neliečia server kodo. Tai **publish/subscribe** (pub/sub, „publikavimas ir prenumerata“) šablonas; taip veikia, pavyzdžiui, Kafka.`,
    },
    'connect-bus': {
      title: 'Užduotis: event bus',
      body: `Event bus ir worker yra paletėje kairėje nuo lentos. Pakeitimus į event bus turi publikuoti ir app1, ir app2. [[search|Search index]] užsiprenumeruoja event bus, o analitikai reikia naujo subscriber – worker, kuris pakeitimus suveda į ataskaitas.

Atkreipkite dėmesį: analitikai iš servers nieko nereikia, jai pakanka užsiprenumeruoti event bus. Kita komanda pasielgs taip pat.`,
    },
    'lagging-subscriber': {
      title: 'Subscriber atsilieka',
      body: `Didelis pardavėjas įkelia savo katalogą: dvidešimt minučių be pertraukos **300 pakeitimų per sekundę**. Event bus kiekvienam subscriber atiduoda visų 300 kopiją.

[[search|Search index]] priima visus: jis atlaiko apie ${n(1500)}. Analitikos [[worker-1|worker]] spėja tik 200 per sekundę, o likusius 100 per sekundę event bus laiko jam. Tai yra subscriber **lag** (atsilikimas), ir lentoje jis matomas taip pat, kaip queue augimas. Per dvidešimt minučių analitika atsiliks ${n(120000)} įvykių. Niekas neprarandama: event bus saugo įvykius (Kafka laiko juos dienomis), ir worker vėliau juos perskaitys nuo ten, kur sustojo. Po įkėlimo, esant 150 pakeitimų per sekundę, jis turės 50 per sekundę atsargą ir pasivys maždaug per 40 minučių. Ataskaitoms 40 minučių vėlavimas priimtinas.

Pastebėkite: event bus nelaukia lėčiausio subscriber. Pardavėjai išsaugo pakeitimus kaip įprastai, o search index lieka šviežias. Antras analitikos worker, užsiprenumeravęs event bus, nepadėtų: jis gautų savo pilną kopiją ir kiekvieną pakeitimą suskaičiuotų du kartus. Kad vieno subscriber srautą padalytų tarp workers, Kafka turi **consumer groups** (vartotojų grupes): grupės viduje įvykiai dalijami kaip queue, o kiekviena grupė gauna savo kopiją.`,
    },
    'index-down': {
      title: 'Search index nepasiekiamas',
      body: `Įkėlimas baigėsi, apkrova grįžo į 150 rps. Dabar [[search|search index]] sustabdytas versijos atnaujinimui, ir pakeitimai jo nepasiekia. (Pirkėjų paiešką kol kas aptarnauja atsarginė kopija, jos lentoje nėra.)

Jei server pats rašytų į search index, kiekvienas pardavėjų išsaugojimas dabar nepavyktų arba search index pakeitimo negautų. Su event bus pardavėjai nieko nepastebi: klaidų nėra. Event bus laiko visus 150 įvykių per sekundę, kol search index vėl veiks, o analitikos [[worker-1|worker]] tuo metu kaip įprastai gauna savo kopiją.

Visą tą laiką search index ir database nesutampa: paieška rodo senas kainas. Net įprastą dieną search index atsinaujina šiek tiek vėliau nei database, po milisekundžių ar sekundžių. Tai vadinama **eventual consistency** (galutinis nuoseklumas): kopijos sutaps, bet ne tą pačią akimirką. Todėl prekės puslapis ir užsakymo pateikimas kainą ima iš database, source of truth, o paieškai leidžiama šiek tiek atsilikti.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Search index vėl veikia. Jis perskaito praleistus įvykius iš event bus nuo ten, kur sustojo, ir pasiveja database: galiausiai visos kopijos sutampa.

Servers publikuoja po vieną įvykį kiekvienam pakeitimui, o [[events-1|event bus]] išdalija kopiją kiekvienam subscriber: [[search|search index]] ir analitikos [[worker-1|worker]]. Skirtumas nuo 7 pamokos – vienas žodis. **Queue** padalija darbus tarp workers, ir kiekvienas darbas atliekamas vieną kartą. **Event bus** kiekvieną įvykį nukopijuoja visiems subscribers, ir kiekvienas consumer mato kiekvieną pakeitimą. Subscribers gyvena nepriklausomai: jei vienas atsiliko ar sugedo, kitiems ir pardavėjams tai nerūpi.

Įrašai keliauja į database, o paieška skaito iš atskiro modelio, surinkto iš įvykių. Rašymo modelio atskyrimas nuo skaitymo modelių vadinamas **CQRS** (Command Query Responsibility Segregation, komandų ir užklausų atskyrimas). Jo kaina – eventual consistency: skaitymo modeliai šiek tiek atsilieka nuo source of truth.`,
    },
  },
  annotations: {
    sourceOfTruth: sim =>
      `${n(sim.databaseLoad)} pakeitimų/s · source of truth`,
    staleIndex: sim => `${n(indexIn(sim))} rps · perstatomas kartą per parą`,
    wantsEveryChange: () => 'reikia kiekvieno pakeitimo',
    indexKeepsUp: sim => `${n(indexIn(sim))} iš ${n(1500)} rps · aktualus`,
    analyticsLag: sim => {
      const lag = sim.load - analyticsIn(sim)
      return lag >= 1
        ? `${n(analyticsIn(sim))} iš ${n(sim.load)}/s · atsilieka +${n(lag)}/s`
        : `${n(analyticsIn(sim))}/s · spėja`
    },
    indexDown: () => 'sustabdytas atnaujinimui',
    busKeeps: sim =>
      sim.backlog >= 1
        ? `laiko +${n(sim.backlog)}/s vėlesniam laikui`
        : 'niekas nelaukia',
    caughtUp: sim => `${n(indexIn(sim))} rps · pasivijo database`,
    busCopies: sim => `${n(sim.load)}/s · kopija kiekvienam subscriber`,
  },
  tasks: {
    'connect-bus': {
      prompt:
        'Padarykite taip, kad kiekvienas pakeitimas per event bus pasiektų search index ir analitiką.',
      goals: {
        'bus-exists': 'Lentoje yra event bus',
        'servers-publish': 'Kiekvienas server publikuoja į event bus',
        'index-subscribed': 'Search index užsiprenumeravo event bus',
        'analytics-subscribed': 'Analitikos worker užsiprenumeravo event bus',
        'keeps-up': 'Esant 150 rps nė vienas subscriber neatsilieka',
      },
      hints: [
        'Server turi apie pakeitimą paskelbti vieną kartą, o kiekvienas consumer – gauti savo kopiją.',
        'Pastatykite event bus dešinėje nuo servers ir sujunkite su ja app1 ir app2. Tada nutieskite ryšius nuo event bus iki search index ir iki naujo bloko „Worker“.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite ten event bus ir worker ir nutieskite pažymėtus ryšius.',
      ],
      solvedNote:
        'Kiekvienas pakeitimas į event bus patenka vieną kartą, o search index ir analitika gauna po pilną kopiją.',
    },
  },
} satisfies LessonTexts<typeof lesson>
