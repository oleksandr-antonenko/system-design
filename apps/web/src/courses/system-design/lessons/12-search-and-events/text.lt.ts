import type { SimResult } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('lt', Math.round(value))
const indexIn = (sim: SimResult) => sim.nodes['search']?.incoming ?? 0
const analyticsIn = (sim: SimResult) => sim.nodes['worker-1']?.incoming ?? 0

export default {
  title: 'Paieška ir įvykiai',
  summary:
    'Įvykių magistralė pristato kiekvieną pakeitimą paieškos indeksui ir analitikai: publish/subscribe, prenumeratoriaus atsilikimas ir galutinis nuoseklumas.',
  steps: {
    catalog: {
      title: 'Katalogas',
      body: `Prekyvietė su milijonu prekių. Šioje lentoje kiekviena užklausa – tai katalogo pakeitimas: pardavėjai keičia kainas, likučius ir aprašymus, apie 150 pakeitimų per sekundę. [[users|Pardavėjai]] kreipiasi į du serverius, [[app1|app1]] ir [[app2|app2]], ir kiekvienas pakeitimas išsaugomas [[db|duomenų bazėje]]. Kaip ir 7 pamokoje, balansuotuvas nenupieštas, kad užtektų vietos.

Duomenų bazė – **tiesos šaltinis** (source of truth): jei kas nors su ja nesutampa, teisi bazė.`,
    },
    'stale-index': {
      title: 'Paieška atsilieka parą',
      body: `Pirkėjai ieško prekių žodžiais: „raudona medvilninė suknelė“. Duomenų bazei tai sekasi prastai. Užklausa, pavyzdžiui, LIKE '%raudona suknelė%' perskaito visą lentelę, milijoną eilučių, ir vis tiek nesusitvarko su rašybos klaidomis, žodžių formomis ir rikiavimu pagal aktualumą. Todėl paiešką aptarnauja atskiras **paieškos indeksas** (pavyzdžiui, Elasticsearch ar OpenSearch), sukurtas būtent tokioms užklausoms.

[[search|Indeksas]] jau yra, bet jis perstatomas iš bazės kopijos kartą per parą, naktį. Dieną pakeitimai jo nepasiekia: užrašas rodo 0 rps. Pardavėjas pakėlė kainą 10 val. ryto, o paieška iki rytojaus rodo senąją. Pirkėjas spusteli „nuo 19 €“ ir prekės puslapyje mato 29 €.

Tų pačių pakeitimų reikia ir analitikams: kainų istorija, kurios prekės baigiasi, kurie pardavėjai aktyvūs. Kiekvienas pakeitimas turi pasiekti kelias vietas iš karto.`,
    },
    'publish-subscribe': {
      title: 'Publikavimas ir prenumerata',
      body: `Kaip pristatyti pakeitimą indeksui ir analitikai? Yra trys keliai.

**Serveris pats rašo visur.** Išsaugojęs bazėje, jis dar atnaujina indeksą ir nusiunčia pakeitimą analitikai. Pardavėjas laukia visų trijų įrašų. Jei indeksas nepasiekiamas, išsaugojimas arba nepavyksta, arba indeksas tyliai praranda pakeitimą. O kiekvienas naujas vartotojas reiškia serverio kodo pakeitimą ir naują diegimą.

**Eilė, kaip 7 pamokoje.** Serveris palieka pranešimą, vartotojai jį pasiima iš eilės. Bet eilė kiekvieną pranešimą atiduoda **vienam** vykdytojui ir padalija darbą tarp jų. Jei indeksas ir analitika imtų iš vienos eilės, kiekvienas gautų pusę: iš 150 pakeitimų per sekundę po 75. Pusė kainų paieškoje liktų senos, o ataskaitos suskaičiuotų pusę pakeitimų.

**Įvykių magistralė.** Serveris **publikuoja** vieną įvykį „prekė 42 pakeista“, o magistralė pilną **kopiją** atiduoda kiekvienam **prenumeratoriui**. Kiekvienas skaito savo tempu, o naujas prenumeratorius neliečia serverio kodo. Tai **publish/subscribe** (pub/sub) šablonas; taip veikia, pavyzdžiui, Kafka.`,
    },
    'connect-bus': {
      title: 'Užduotis: įvykių magistralė',
      body: `Įvykių magistralė ir vykdytojas yra paletėje kairėje nuo lentos. Abu serveriai turi publikuoti pakeitimus į magistralę. [[search|Paieškos indeksas]] užsiprenumeruoja magistralę, o analitikai reikia naujo prenumeratoriaus – vykdytojo, kuris pakeitimus suveda į ataskaitas.

Atkreipkite dėmesį: analitikai iš serverių nieko nereikia, jai pakanka užsiprenumeruoti magistralę. Kita komanda pasielgs taip pat.`,
    },
    'lagging-subscriber': {
      title: 'Prenumeratorius atsilieka',
      body: `Didelis pardavėjas įkelia savo katalogą: dvidešimt minučių iš eilės **300 pakeitimų per sekundę**. Magistralė kiekvienam prenumeratoriui atiduoda visų 300 kopiją.

[[search|Indeksas]] priima visus: jis atlaiko apie ${n(1500)}. Analitikos [[worker-1|vykdytojas]] spėja tik 200 per sekundę, o likusius 100 per sekundę magistralė laiko jam. Tai prenumeratoriaus **atsilikimas** (lag), ir magistralė jį rodo kaip eilės augimą. Per dvidešimt minučių analitika atsiliks ${n(120000)} įvykių. Niekas neprarandama: magistralė saugo įvykius (Kafka laiko juos dienomis), ir vykdytojas vėliau juos perskaitys nuo ten, kur sustojo. Po įkėlimo, esant 150 pakeitimų per sekundę, jis turės 50 per sekundę atsargą ir pasivys maždaug per 40 minučių. Ataskaitoms 40 minučių vėlavimas priimtinas.

Pastebėkite: magistralė nelaukia lėčiausio prenumeratoriaus. Pardavėjai išsaugo pakeitimus kaip įprastai, o indeksas lieka šviežias. Antras analitikos vykdytojas, užsiprenumeravęs magistralę, nepadėtų: jis gautų savo pilną kopiją ir kiekvieną pakeitimą suskaičiuotų du kartus. Kad vieno prenumeratoriaus srautą padalytų keliems vykdytojams, Kafka turi **vartotojų grupes** (consumer groups): grupės viduje įvykiai dalijami kaip eilėje, o kiekviena grupė gauna savo kopiją.`,
    },
    'index-down': {
      title: 'Indeksas nepasiekiamas',
      body: `Įkėlimas baigėsi, apkrova grįžo į 150 rps. Dabar [[search|indeksas]] sustabdytas versijos atnaujinimui, ir pakeitimai jo nepasiekia. (Pirkėjų paiešką kol kas aptarnauja atsarginė kopija, jos lentoje nėra.)

Jei serveris pats rašytų į indeksą, kiekvienas pardavėjų išsaugojimas dabar nepavyktų arba pakeitimas indeksui dingtų. Su magistrale pardavėjai nieko nepastebi: klaidų nėra. Magistralė laiko indeksui visus 150 įvykių per sekundę, o [[worker-1|analitika]] tuo metu kaip įprastai gauna savo kopiją.

Visą tą laiką indeksas ir bazė nesutampa: paieška rodo senas kainas. Net įprastą dieną indeksas atsinaujina šiek tiek vėliau nei bazė, po milisekundžių ar sekundžių. Tai vadinama **galutiniu nuoseklumu** (eventual consistency): kopijos sutaps, bet ne tą pačią akimirką. Todėl prekės puslapis ir užsakymo pateikimas kainą ima iš bazės, tiesos šaltinio, o paieškai leidžiama šiek tiek atsilikti.`,
    },
    summary: {
      title: 'Santrauka',
      body: `Indeksas vėl veikia. Jis perskaito praleistus įvykius iš magistralės nuo ten, kur sustojo, ir pasiveja bazę: galiausiai visos kopijos sutampa.

Serveriai publikuoja po vieną įvykį kiekvienam pakeitimui, o [[events-1|magistralė]] išdalija kopiją kiekvienam prenumeratoriui: [[search|paieškos indeksui]] ir [[worker-1|analitikai]]. Skirtumas nuo 7 pamokos – vienas žodis. **Eilė** padalija darbus vykdytojams, ir kiekvienas darbas atliekamas vieną kartą. **Magistralė** kiekvieną įvykį nukopijuoja visiems prenumeratoriams, ir kiekvienas vartotojas mato kiekvieną pakeitimą. Prenumeratoriai gyvena nepriklausomai: jei vienas atsiliko ar sugedo, kitiems ir pardavėjams tai nerūpi.

Įrašai keliauja į bazę, o paieška skaito iš atskiro modelio, surinkto iš įvykių. Rašymo modelio atskyrimas nuo skaitymo modelių vadinamas **CQRS** (Command Query Responsibility Segregation). Jo kaina – galutinis nuoseklumas: skaitymo modeliai šiek tiek atsilieka nuo tiesos šaltinio.`,
    },
  },
  annotations: {
    sourceOfTruth: sim =>
      `${n(sim.databaseLoad)} pakeitimų/s · tiesos šaltinis`,
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
    caughtUp: sim => `${n(indexIn(sim))} rps · pasivijo bazę`,
    busCopies: sim => `${n(sim.load)}/s · kopija kiekvienam prenumeratoriui`,
  },
  tasks: {
    'connect-bus': {
      prompt:
        'Padarykite taip, kad kiekvienas pakeitimas per įvykių magistralę pasiektų paieškos indeksą ir analitiką.',
      goals: {
        'bus-exists': 'Lentoje yra įvykių magistralė',
        'servers-publish': 'Abu serveriai publikuoja į magistralę',
        'index-subscribed': 'Paieškos indeksas užsiprenumeravo magistralę',
        'analytics-subscribed':
          'Analitikos vykdytojas užsiprenumeravo magistralę',
        'keeps-up': 'Esant 150 rps nė vienas prenumeratorius neatsilieka',
      },
      hints: [
        'Serveris turi apie pakeitimą paskelbti vieną kartą, o kiekvienas vartotojas – gauti savo kopiją.',
        'Pastatykite įvykių magistralę dešinėje nuo serverių ir sujunkite su ja app1 ir app2. Tada nutieskite ryšius nuo magistralės iki paieškos indekso ir iki naujo vykdytojo.',
        'Lentoje atsirado punktyrinis kontūras. Pastatykite ten magistralę ir vykdytoją ir nutieskite pažymėtus ryšius.',
      ],
      solvedNote:
        'Kiekvienas pakeitimas į magistralę patenka vieną kartą, o indeksas ir analitika gauna po pilną kopiją.',
    },
  },
} satisfies LessonTexts<typeof lesson>
