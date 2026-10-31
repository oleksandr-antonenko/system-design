import type { ScenarioStrings } from './types'

export const scenarioLt: ScenarioStrings = {
  taskHeading: 'Užduotis ekrane',
  taskHowTo:
    'Veikite ekrane kaip gyvenime. Tikslai pažymimi patys, pabaigoje paspauskite „Tikrinti“.',
  pickHowTo:
    'Paspauskite reikiamą vietą ekrane. Klaviatūra: Tab iki jos ir Enter.',

  solveFirst: 'Išspręskite užduotį ekrane, kad galėtumėte tęsti',

  frameLabel: 'Pamokos kadras',
  galleryLabel: 'Pamokos kadrai',
  openSign: 'Atidaryti lentelę',
  closeSign: 'Uždaryti lentelę',
  signHead: 'Lentelė',

  mistakesLabel: 'Klaidos pakeliui',
  noMistakes: 'nebuvo',
  gaveAwayPassword: ssid =>
    `pašto slaptažodis įvestas tinklo „${ssid}“ puslapyje: gyvenime jį iškart keičia ir praneša IT`,
  openedMailWithoutVpn: 'darbo paštas atidarytas svetimame tinkle be VPN',
  followedBait:
    'paspausta nuoroda ar priedas masalo laiške: gyvenime apie tai iškart praneša IT',
  passwordInChat:
    'slaptažodis išsiųstas pokalbyje: gyvenime žinutė ištrinama, o slaptažodis pakeičiamas',
  allowedStranger:
    'svetimas prisijungimas patvirtintas mygtuku „Taip“: gyvenime iš karto praneša IT ir keičia slaptažodį',
  complied:
    'skubus prašymas priimtas be patikrinimo: gyvenime, jei pinigai jau išėjo, iš karto skambina į banką ir IT',
  calledTheirNumber:
    'patikrinimas skambinant numeriu iš žinutės: ten atsiliepia tas pats žmogus',
  pastedPassword:
    'administratoriaus slaptažodis įklijuotas į pokalbį su asistentu: jį ištrina iš pokalbio ir pakeičia',
  pastedToken:
    'raktas išsiųstas į pokalbį tekstu: žinutę ištrina, raktą po darbo atšaukia',
  deletedBait:
    'masalas ištrintas, o ne persiųstas IT: pagal jį IT randa tokius pat laiškus kolegoms',

  noPhone: 'Šiame žingsnyje telefono nėra.',
  noInbox: 'Šiame žingsnyje pašto nėra.',
  networkUnknown: ssid => `Tinklo „${ssid}“ šalia nėra.`,
  networkLocked: ssid => `„${ssid}“ – tinklas su slaptažodžiu, o jo neturite.`,
  notJoined: 'Telefonas neprisijungęs prie šio tinklo.',
  offline:
    'Interneto nėra: pirma prisijunkite prie Wi-Fi ir praeikite tinklo prisijungimo puslapį.',
  vpnOff: 'VPN išjungtas.',
  mailUnknown: 'Tokio laiško nėra.',
  notOnNetwork: ssid =>
    `Telefonas ne tinkle „${ssid}“ arba nepraėjo jo prisijungimo puslapio.`,
  mailNotSent: 'Laiškas dar neišsiųstas.',
  phishLeft: count => `Masalų be žymos „Sukčiavimas“: ${count}.`,
  realMisflagged: count => `Tikrų laiškų be žymos „Tikras“: ${count}.`,
  noVault: 'Šiame žingsnyje nėra slaptažodžių tvarkyklės.',
  entryUnknown: 'Tokio įrašo nėra.',
  entryOnSticker: name =>
    `„${name}“ dar ant lipduko: pirmiausia perkelkite įrašą į seifą.`,
  stickersLeft: count => `Lipdukų su slaptažodžiais ant monitoriaus: ${count}.`,
  passwordReused: count => `Įrašų su vienodu slaptažodžiu: ${count}.`,
  notShared: name => `„${name}“ dar ne bendrame seife.`,
  notRegenerated: name => `„${name}“ slaptažodis vis dar senas.`,
  noAuth: 'Šiame žingsnyje nėra saugumo puslapio.',
  notScanned: 'Pirmiausia nuskaitykite QR kodą programėle.',
  wrongCode: 'Kodas nesutampa su kodu programėlėje.',
  twoFactorOff: '2FA dar neįjungta.',
  codesNotSaved: 'Atsarginiai kodai dar neišsaugoti.',
  noSignIn: 'Prisijungimo užklausos dabar nėra.',
  signInPending: 'Svetima prisijungimo užklausa dar neatmesta.',
  notReported: 'Prisijungimas atmestas, bet IT dar nežino.',
  noChat: 'Šiame žingsnyje nėra pokalbių programėlės.',
  threadUnknown: 'Tokio pokalbio nėra.',
  replyUnknown: 'Tokio atsakymo nėra.',
  contactUnknown: 'Tokio kontakto žinyne nėra.',
  notReplied: name => `Pokalbyje „${name}“ dar nėra tinkamo atsakymo.`,
  notCalled: name => `Skambučio numeriu iš žinyno dar nebuvo: ${name}.`,
  notForwarded: name => `Pokalbis „${name}“ dar nepersiųstas IT.`,
  noAssistant: 'Šiame žingsnyje nėra asistento.',
  noSections: 'Rakte nėra nė vieno skyriaus.',
  tokenUnknown: 'Tokio rakto nėra.',
  tokenRevoked: 'Šis raktas jau atšauktas.',
  tokenNotSaved: 'Raktas dar neišsaugotas slaptažodžių tvarkyklėje.',
  lineUnknown: 'Tokios žinutės nėra.',
  noAccessGiven: 'Asistentas dar negavo rakto.',
  accessTooBroad:
    'Asistento raktas platesnis nei reikia: tik skaityti, vienas skyrius, ne ilgiau kaip savaitę.',
  accessActive: 'Asistento raktas dar galioja.',
  secretInChat: 'Pokalbyje liko slaptažodis arba raktas.',
  passwordNotChanged:
    'Administratoriaus slaptažodis buvo pokalbyje, bet dar nepakeistas.',
  mailNotForwarded: name => `Laiškas nuo „${name}“ dar nepersiųstas IT.`,
  notSignedOut: 'Svetimos pašto sesijos dar atviros.',
  weakPhrase: 'pasirinkta lengvai atspėjama pagrindinė frazė',
  noKeepass: 'Ekrane nėra KeePass.',
  noBase: 'Slaptažodžių bazės dar nėra: sukurkite ją.',
  phraseMissing: 'Bazė dar neturi pagrindinės frazės.',
  phraseUnknown: 'Tokios frazės sąraše nėra.',
  phraseWeak: 'Pagrindinė frazė per paprasta: ją atspės.',
  placeUnknown: 'Ten kopijos padėti negalima.',
  entriesLeft: count => `Įrašų dar ne bazėje: ${count}.`,
  noBackup: 'Atsarginės bazės kopijos nėra.',
  backupSameDevice:
    'Kopija tame pačiame nešiojamajame kompiuteryje: jam sugedus, dings abi.',
  backupStale:
    'Kopija senesnė už bazę: joje ne visi įrašai. Išsaugokite kopiją dar kartą.',
  risky: risk =>
    risk === 'plug'
      ? 'rastas USB atmintukas įkištas į kompiuterį'
      : risk === 'run'
        ? 'atidarytas failas, kuris paleidžia programą'
        : risk === 'grant'
          ? 'plėtiniui suteikta prieiga prie visų svetainių'
          : 'kompiuteris paliktas neužrakintas',
  noTray: 'Ekrane nėra ko tvarkyti.',
  itemUnknown: 'Tokio daikto nėra.',
  actionUnknown: 'Su šiuo daiktu taip pasielgti negalima.',
  itemsLeft: count => `Sutvarkyta ne taip arba nesutvarkyta: ${count}.`,

  phone: {
    title: 'Telefonas',
    settings: 'Nustatymai',
    apps: 'Programos',
    mailApp: 'Paštas',
    vpnRow: profile => `VPN · ${profile}`,
    vpnOn: 'Prisijungta prie biuro',
    vpnOffStatus: 'Išjungtas',
    vpnNeedsInternet: 'Reikia interneto',
    vpnBadge: 'VPN',
    homeNoteVpn:
      'VPN įjungtas: viskas, ką telefonas siunčia, eina uždaru vamzdžiu iki biuro.',
    homeNote: 'Svetimame tinkle: tinklas – VPN – darbo reikalai.',
    sentNote: 'Laiškas išsiųstas per VPN.',
    wifiNote:
      'Spyna – tinklas su slaptažodžiu. Brūkšneliai – signalo stiprumas, o ne tinklo sąžiningumas.',
    accept: 'Sutinku',
    portalConsentNote:
      'Šis puslapis prašo tik sutikti su taisyklėmis. Nei pašto, nei slaptažodžių.',
    portalEmail: 'El. paštas',
    portalPassword: 'Pašto slaptažodis',
    leave: 'Uždaryti ir atsijungti',
    signIn: 'Prisijungti',
    understood: 'Supratau',
    lockedTitle: ssid => `„${ssid}“ – su slaptažodžiu`,
    lockedHint:
      'Šio tinklo slaptažodžio neturite. Ieškokite tinklo pagal lentelę.',
    leakedTitle: 'Stop: slaptažodis iškeliavo kaimynui',
    leakedBody:
      'Tikram Wi-Fi jūsų pašto slaptažodžio nereikia. Šį puslapį parodė tinklas antrininkas: panašiu vardu tinklas, kurį įjungė kažkas šalia.',
    leakedNext:
      'Gyvenime dabar: pakeisti pašto slaptažodį ir parašyti IT. Čia telefonas atsijungė nuo antrininko – pasirinkite tinklą iš lentelės.',
    needsNetworkTitle: 'Nėra interneto ryšio',
    needsNetworkBody:
      'Pirma prisijunkite prie Wi-Fi ir praeikite tinklo prisijungimo puslapį.',
    needsVpnTitle: 'VPN išjungtas',
    needsVpnBody:
      'Esate svetimame tinkle. Darbo paštą atidaro tik per VPN: tada jį mato tik jūs ir biuras.',
    openWithoutVpn: 'Atidaryti be VPN',
    turnOnVpn: 'Įjungti VPN',
    mailTitle: 'Paštas',
    mailWithoutVpn:
      'Paštas atidarytas be VPN. Grįžkite, įjunkite VPN ir atidarykite jį iš naujo.',
    mailThroughVpn: 'VPN · saugus ryšys su biuru',
    mailSent: '✓ Išsiųsta per VPN',
    to: address => `Kam: ${address}`,
    send: 'Siųsti',
    sentButton: 'Išsiųsta',
  },

  mail: {
    tab: owner => `Paštas · ${owner}`,
    label: 'Paštas',
    inbox: 'Gautieji',
    sorted: (done, total) => `sutvarkyta ${done} iš ${total}`,
    choose: 'Pasirinkite laišką sąraše.',
    chooseHint: 'Paspauskite siuntėjo vardą, kad pamatytumėte adresą.',
    to: address => `Kam: ${address}`,
    showAddress: name => `${name}: rodyti siuntėjo adresą`,
    markPhish: '⚑ Sukčiavimas',
    markReal: '✓ Tikras',
    flaggedPhish: '⚑ sukčiavimas',
    keptReal: '✓ tikras',
    misflagged: 'pažymėta neteisingai',
    rightPhish: 'Teisingai: masalas.',
    rightReal: 'Teisingai: tikras laiškas.',
    wasPhish: 'Tai masalas.',
    wasReal: 'Tai tikras laiškas.',
    misflaggedReal:
      'Žyma „sukčiavimas“ ant tikro laiško – irgi klaida: kolega laukia atsakymo.',
    linkTo: 'Nuoroda veda į:',
    backToMail: 'Į laišką',
    pageLogin: host =>
      `Tai tos pačios kartoninės durys. Puslapis panašus į pašto prisijungimą, bet adresas – ${host}. Viskas, ką čia įvesite, atiteks sukčiui.`,
    pagePayment: host =>
      `Mokėjimo forma svetimame domene ${host}. Kortelės duomenys iš tokio puslapio patenka sukčiui, ir nuskaičiuoja visai ne tą sumą, kuri laiške.`,
    pageFile:
      'Priedas iš suklastoto laiško. Viduje – sukčiaus „nauji rekvizitai“, o būna ir programa, apsimetanti dokumentu. Tokių priedų neatidaro: laišką persiunčia IT.',
    pageOwn: (host, domain) => `Tai jūsų svetainė: ${host} baigiasi ${domain}.`,
    loginTitle: 'Prisijungimas prie pašto',
    paymentTitle: 'Mokėjimas',
    forward: '↪ Persiųsti IT',
    delete: '🗑 Ištrinti',
    forwardedMark: '↪ IT',
    forwardedNote:
      '↪ Persiųsta IT. Pagal laišką ras tokius pat pas kolegas ir užblokuos siuntėją.',
    deletedBaitNote:
      'Masalas šiukšliadėžėje. IT jo reikia: pagal jį randa, kam dar atėjo toks laiškas. Atidarykite jį „Šiukšliadėžėje“ ir persiųskite IT.',
    inTrash: 'Laiškas šiukšliadėžėje.',
    trash: 'Šiukšliadėžė',
    lastActivity: where => `Paskutinis prisijungimas prie pašto: ${where}`,
    details: 'Daugiau',
    sessionsTitle: 'Kur dabar atidarytas jūsų paštas',
    thisDevice: 'šis įrenginys',
    ownDevice: 'jūsų',
    strangeDevice: 'neatpažįstate?',
    signOut: 'Atsijungti visuose kituose įrenginiuose',
    signedOut:
      '✓ Visos kitos sesijos baigtos. Su senu slaptažodžiu ten nebeprisijungsi.',
  },

  vault: {
    tab: owner => `Seifas · ${owner}`,
    label: 'Slaptažodžių tvarkyklė',
    stickers: 'Lipdukai ant monitoriaus.',
    stickersNote:
      'Juos mato kiekvienas, priėjęs prie stalo. Perkelkite slaptažodžius į seifą, o lipdukus – į smulkintuvą.',
    stickerLogin: login => `prisijungimas: ${login}`,
    stickerPassword: password => `slaptažodis: ${password}`,
    saveSticker: 'Perkelti į seifą',
    sharedBadge: 'bendras',
    access: names => `Prieiga: ${names}`,
    empty: 'Kol kas tuščia.',
    choose: 'Pasirinkite įrašą sąraše.',
    site: 'Svetainė',
    login: 'Prisijungimas',
    password: 'Slaptažodis',
    reusedBadge: 'kartojasi',
    reusedWith: names =>
      `Toks pat slaptažodis: ${names}. Nutekės iš vienos svetainės – atrakins ir kitą.`,
    generatedNote:
      'Naują slaptažodį sugeneravo seifas: 20 atsitiktinių simbolių. Įsiminti nereikia – seifas jį įrašys pats.',
    ownNote:
      'Slaptažodis sugalvotas rankomis. Seifas gali pakeisti jį ilgu atsitiktiniu.',
    generate: 'Pakeisti sugeneruotu',
    generatedButton: '✓ Slaptažodis sugeneruotas',
    share: 'Bendrinti…',
    inShared: vault => `Bendrame seife „${vault}“`,
    shareTitle: name => `Bendrinti „${name}“`,
    moveToShared: vault => `Perkelti į bendrą seifą „${vault}“`,
    moveNote: names =>
      `Prieigą gaus: ${names}. Pasikeis slaptažodis – visiems pasikeis savaime; išeis darbuotojas – prieigą uždarys vienu paspaudimu.`,
    sendInChat: person => `Nukopijuoti slaptažodį į pokalbį · ${person}`,
    sendNote: 'Slaptažodis liks susirašinėjimo istorijoje.',
    cancel: 'Atšaukti',
    sentTitle: 'Stop: slaptažodis nukeliavo į pokalbį',
    sentBody:
      'Dabar jis guli susirašinėjimo istorijoje, pašnekovo telefone ir atsarginėse kopijose ir pats iš ten nedings. Pasikeis slaptažodis – teks siųsti iš naujo.',
    sentNext:
      'Gyvenime dabar: ištrinkite žinutę ir pakeiskite slaptažodį. Čia galite tęsti: pasidalykite įrašu per bendrą seifą.',
  },

  keepass: {
    tab: owner => `KeePass · ${owner}`,
    label: 'KeePass seifo failas',
    noBase: 'Slaptažodžių bazės dar nėra',
    noBaseNote: place =>
      `Nauja bazė – vienas užšifruotas failas. Jis bus čia: ${place}. Debesies nėra.`,
    create: 'Sukurti naują bazę',
    phraseTitle: file => `Pagrindinė frazė failui „${file}“`,
    phraseNote:
      'Be jos failo neatidarys niekas: nei IT, nei KeePass kūrėjai. Atkurti jos negalima. Pasirinkite frazę:',
    weakTitle: 'Ją atspės.',
    where: place => `Bazės failas yra čia: ${place}`,
    noCloud:
      'Debesies nėra: sugedus ar pradingus šiam įrenginiui, kartu dings ir bazė.',
    copiesTitle: 'Atsarginės kopijos',
    noCopies: 'Kopijų dar nėra.',
    copyCount: (inCopy, inBase) => `įrašų: ${inCopy} iš ${inBase}`,
    fresh: 'nauja',
    stale: 'pasenusi',
    sameDevice: 'tame pačiame kompiuteryje',
    saveCopy: 'Išsaugoti kopiją…',
    copyTitle: file => `Kur išsaugoti „${file}“ kopiją`,
    entriesTitle: count => `Įrašai bazėje: ${count}`,
    emptyBase: 'Bazė kol kas tuščia.',
    waiting:
      'Slaptažodžiai ant lapelio po klaviatūra – perkelkite juos į bazę:',
    add: 'Įtraukti į bazę',
  },

  tray: {
    tab: (look, owner) =>
      look === 'desk'
        ? `Stalas · ${owner}`
        : look === 'downloads'
          ? `Atsisiuntimai · ${owner}`
          : `Plėtiniai · ${owner}`,
    showExtensions: 'Rodyti failų plėtinius',
    extensionsShown:
      'Matomas visas pavadinimas: failo tipas – raidės po paskutinio taško.',
    extensionsHidden: 'Dabar sistema slepia paskutinę pavadinimo dalį.',
    fileType: ext =>
      ({
        pdf: 'PDF dokumentas',
        exe: 'Programa',
        msi: 'Programos diegimo failas',
        zip: 'ZIP archyvas',
        docx: 'Word dokumentas',
        docm: 'Word dokumentas su makrokomandomis',
        xlsx: 'Excel lentelė',
        jpg: 'JPEG paveikslėlis',
        png: 'PNG paveikslėlis',
      })[ext] ?? `${ext.toUpperCase()} failas`,
  },

  auth: {
    tab: owner => `2FA · ${owner}`,
    label: 'Saugumo puslapis ir telefonas',
    security: 'Saugumas',
    twoFactorTitle: 'Dviejų veiksnių apsauga (2FA)',
    offNote:
      'Išjungta. Įjunkite – ir jungiantis be slaptažodžio prireiks kodo iš programėlės telefone.',
    enable: 'Įjungti 2FA',
    scanStep:
      '1. Telefone atidarykite autentifikavimo programėlę ir nuskaitykite QR kodą.',
    codeStep: '2. Įveskite 6 skaitmenis, kuriuos parodys programėlė.',
    codeLabel: 'Kodas iš programėlės',
    confirm: 'Patvirtinti',
    wrongCode: 'Kodas netinka. Pažiūrėkite šešis skaitmenis programėlėje.',
    notScannedYet:
      'Pirmiausia nuskaitykite QR kodą telefonu: kodas atsiras programėlėje.',
    onNote:
      '✓ 2FA įjungta. Jungiantis iš naujo įrenginio svetainė paklaus kodo.',
    backupTitle: 'Atsarginiai kodai',
    backupNote:
      'Pametus telefoną, prisijungti galima vienu iš šių kodų, kiekvienas veikia vieną kartą. Laikykite juos ne telefone, o slaptažodžių tvarkyklėje.',
    saveCodes: 'Išsaugoti slaptažodžių tvarkyklėje',
    codesSaved: '✓ Atsarginiai kodai išsaugoti slaptažodžių tvarkyklėje.',
    qrLabel: 'QR kodas autentifikavimo programėlei',
    app: 'Autentifikatorius',
    noAccounts: 'Paskyrų kol kas nėra.',
    scan: 'Nuskaityti QR kodą',
    needsQr:
      'Kamerai nėra ko nuskaityti: pirmiausia atidarykite QR kodą svetainėje mygtuku „Įjungti 2FA“.',
    codeNote: 'Kodas keičiasi kas 30 sekundžių.',
    requestTitle: 'Ar tai jūs jungiatės?',
    deny: 'Ne, tai ne aš',
    approve: 'Taip, tai aš',
    allowedTitle: 'Stop: įleidote svetimą',
    allowedBody:
      'Jūs niekur nesijungėte, vadinasi, jungėsi kažkas su jūsų slaptažodžiu, o jūs jam atrakinote antrąją spyną. Būtent to sukčius ir tikisi: siunčia užklausas, kol kas nors paspaus „Taip“.',
    allowedNext: 'Tuoj pat užbaikite šį prisijungimą.',
    notMe: 'Tai buvau ne aš – užbaigti prisijungimą',
    declinedTitle: 'Prisijungimas atmestas',
    declinedBody: site =>
      `Jūsų slaptažodį nuo ${site} žino dar kažkas. Praneškite IT: slaptažodį reikia pakeisti.`,
    report: 'Pranešti IT',
    reported: '✓ IT žino: slaptažodį pakeis kartu su jumis.',
  },

  chat: {
    tab: owner => `Pokalbiai · ${owner}`,
    label: 'Pokalbių programėlė',
    chats: 'Pokalbiai',
    directory: 'Žinynas',
    directoryNote:
      'Numeriai iš įmonės žinyno. Jais galima pasitikėti: jų jums neatsiuntė žinute.',
    unknownBadge: 'nėra kontaktuose',
    choose: 'Pasirinkite pokalbį.',
    call: 'Skambinti',
    callNumber: number => `Skambinti ${number}`,
    forward: 'Persiųsti IT',
    forwardTo: name => `Persiųsti pokalbį: ${name}`,
    forwarded: name => `↪ Persiųsta: ${name}`,
    youForwarded: name => `↪ Persiuntėte pokalbį „${name}“`,
    itThanks: 'Ačiū, pažiūrėsiu!',
    replyHint: 'Atsakyti:',
    callTitle: name => `Skambutis · ${name}`,
    noAnswer: 'Signalai… Niekas neatsiliepia.',
    hangUp: 'Baigti skambutį',
    theirNumberTitle: 'Stop: tai ne patikrinimas.',
    theirNumberBody:
      'Numeriu iš žinutės atsiliepia tas, kas ją atsiuntė, o balsą dabar lengva suklastoti.',
    theirNumberNext:
      'Tikrinama numeriu, kurį žinote patys: atidarykite „Žinyną“.',
    compliedTitle: 'Stop: prašymas nepatikrintas.',
    compliedBody:
      'Skubu, „vadovas“, „neskambinkite“ – visi trys svertai iš karto. Pirma patikrinimas kitu kanalu, paskui pinigai.',
    compliedNext:
      'Gyvenime, jei pinigai jau išėjo, iš karto skambinkite į banką ir IT: mokėjimą kartais dar spėja sustabdyti. Čia galite tęsti.',
  },

  assistant: {
    tab: owner => `Asistentas · ${owner}`,
    label: 'Pokalbis su DI asistentu',
    deleted: 'Žinutė ištrinta',
    delete: 'Ištrinti',
    deleteLabel: 'Ištrinti žinutę',
    passwordWarning:
      'Administratoriaus slaptažodis dabar pokalbio istorijoje. Ištrinkite žinutę ir pakeiskite slaptažodį CRM sistemoje.',
    tokenWarning:
      'Raktas tekstu liko pokalbio istorijoje. Ištrinkite žinutę, o po darbo atšaukite raktą.',
    pastePassword: 'Įklijuoti administratoriaus slaptažodį',
    pasteToken: 'Įklijuoti raktą tekstu',
    giveReference: 'Duoti nuorodą į įrašą slaptažodžių tvarkyklėje',
    composer: 'Žinutė asistentui…',
    needsToken: 'Rakto dar nėra: sukurkite jį skirtuke CRM.',
    needsSaved:
      'Nuoroda duodama į išsaugotą raktą: pirmiausia CRM sistemoje „Išsaugoti slaptažodžių tvarkyklėje“.',
  },

  crm: {
    tab: owner => `CRM · ${owner}`,
    label: 'CRM nustatymai',
    settings: 'Nustatymai · Prieiga',
    adminTitle: 'Administratoriaus slaptažodis',
    adminOld: 'Paskutinį kartą keistas prieš tris mėnesius.',
    adminChanged: '✓ Ką tik pakeistas. Senas slaptažodis nebeveikia.',
    changePassword: 'Keisti slaptažodį',
    tokensTitle: 'Raktai asistentams ir integracijoms',
    tokensNote:
      'Raktas – atskiras raktas programai: savos teisės, skyriai ir terminas. Atšaukiamas vienu paspaudimu ir neliečia jūsų slaptažodžio.',
    access: 'Teisės',
    accessRead: 'Tik skaityti',
    accessWrite: 'Skaityti ir rašyti',
    accessAdmin: 'Visa prieiga',
    sections: 'Skyriai',
    term: 'Terminas',
    days: days =>
      days === 0 ? 'Neterminuotai' : days === 7 ? '7 dienos' : `${days} dienų`,
    create: 'Sukurti raktą',
    noSections: 'Pažymėkite bent vieną skyrių.',
    tokenTitle: number => `Raktas Nr. ${number}`,
    active: 'galioja',
    revoked: 'atšauktas',
    save: 'Išsaugoti slaptažodžių tvarkyklėje',
    saved: reference => `✓ Slaptažodžių tvarkyklėje: ${reference}`,
    revoke: 'Atšaukti',
    tooBroad:
      'Plačiau, nei reikia asistentui: jam užtenka skaityti vieną skyrių savaitę. Atšaukite šį raktą ir sukurkite siauresnį.',
  },

  trap: {
    label: 'Mokomasis puslapis: langas su prizu',
    prize: 'Laimėk iPhone Duo',
    visitor:
      'Jūs – 1 000 000-asis lankytojas! Prisijunkite prie paskyros ir atsiimkite prizą.',
    burnsIn: 'Prizas dings po',
    signIn: 'Prisijungimas',
    useAccount: brand => `Naudokite ${brand} paskyrą`,
    email: 'El. paštas arba telefonas',
    password: 'Slaptažodis',
    emailMissing: 'Įveskite el. pašto adresą arba telefoną',
    passwordMissing: 'Įveskite slaptažodį',
    skip: 'Praleisti',
    login: 'Prisijungti',
    fine: 'Spausdami „Prisijungti“ sutinkate su akcijos taisyklėmis. Prizų skaičius ribotas.',
  },

  letter: {
    label: 'Laiškas',
    to: address => `Kam: ${address}`,
  },
}
