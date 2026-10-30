import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

/** The passport names the site without `www.`, and the browser asks for the
    `www.` name. */
const missesWww = (name: string, names: ReadonlyArray<string>): boolean =>
  name.startsWith('www.') && names.includes(name.slice('www.'.length))

export default {
  title: 'HTTP, HTTPS and certificates',
  summary:
    'What the padlock in the browser protects, and why a certificate can be invalid.',
  labels: {
    phone: { name: 'Phone', note: 'in your hand, at the café' },
    laptop: { name: 'Laptop', note: 'on the desk at home' },
    printer: { name: 'Printer', note: 'in the next room' },
    router: { name: 'Router', note: 'the post office of your home' },
    cafe: { name: 'Café Wi-Fi', note: 'open network, no password' },
    stranger: { name: 'Neighbour', note: 'a laptop at the next table' },
    internet: { name: 'Internet', note: 'many networks' },
    dns: { name: 'DNS server', note: 'your provider’s directory' },
    vps: { name: 'Your server', note: 'myapp.example' },
    shop: { name: 'Shop website', note: 'shop.example' },
    ca: {
      name: 'Certificate authority',
      note: 'a passport office for websites',
    },
    'zone:cafe': { name: 'Café Utro' },
  },
  steps: {
    postcard: {
      title: 'HTTP is a postcard',
      body: `You are at Café Utro, and your [[phone|phone]] is on the [[cafe|café’s]] open network. You open the admin page of your site from lesson 10, http://myapp.example/login, and type your password. Press “Run”: the envelope stops at the café Wi-Fi and opens. Inside you can read both the page address and the password. Plain http:// is a postcard: anyone it passes through can read it. On the café’s open network that includes even the [[stranger|laptop at the next table]].

The browser warns you about it: left of the address it says “Not secure”.`,
    },
    sealed: {
      title: 'HTTPS is a sealed envelope',
      body: `Now let’s sign in to the [[shop|shop website]]: https://shop.example/login. Press “Run”. At the very start the phone and the site agree on a cipher — like a lock whose key only the two of them have. From then on everything inside travels sealed: along the way you can see where the envelope is going, but not what is inside.

This is **HTTPS**: the same HTTP, only in a sealed envelope. It has its own port, 443, and instead of “Not secure” the address bar shows a padlock.`,
    },
    passport: {
      title: 'A certificate is the site’s passport',
      body: `But how does the phone know that it sealed the envelope with the shop website and not with a [[stranger|neighbour at the café]] pretending to be it? When they meet, the site shows its **certificate**: the site’s passport. It says the site’s name, until what date it is valid and who issued it. Such passports are issued by [[ca|certificate authorities]] — passport offices for websites, and the browser knows in advance which of them to trust.

The browser checks three things: the name in the passport matches the address bar, it has not expired, and it was issued by an authority the browser trusts. If anything is wrong, you get a red screen instead of the site. The shop.example passport is under the board. Press “Run”: the phone receives it while agreeing on the cipher.`,
      more: {
        title: 'More: how the cipher is agreed and what errors there are',
        body: `Agreeing on the cipher is called the TLS handshake. The site sends its certificate and the public half of a key; the phone checks the passport, and together they arrive at a shared secret key that nobody along the way has seen. The S in HTTPS is exactly TLS.

Certificate authorities (CA) form a chain: the site’s passport is signed by an intermediate authority, and that one by a root authority built into the browser and the operating system. Free passports for 90 days are issued by, for example, Let’s Encrypt; the certbot program or the Caddy web server renew them on their own. Checking with a file over http:// is called HTTP-01. If port 80 cannot be opened, there is DNS-01: the authority asks you to add a TXT record, as in lesson 10.

Other common errors: NET::ERR_CERT_DATE_INVALID — the passport has expired (or the computer’s date is wrong); NET::ERR_CERT_AUTHORITY_INVALID — the passport was issued by an authority the browser does not trust, for example a “self-signed” one drawn at home; ERR_SSL_PROTOCOL_ERROR — there is no HTTPS on port 443 at all.`,
      },
    },
    'cafe-sees': {
      title: 'Question: what the café sees',
      body: `You are at the café again and sign in at https://shop.example/login. What do the [[cafe|café network]] and the [[stranger|neighbour at the table]] learn about your envelope?`,
    },
    'get-certificate': {
      title: 'Task: a padlock for your site',
      body: `Time to move [[vps|your site]] to HTTPS too. The hosting company turned on HTTPS on the server, but its certificate is issued for the host’s technical name. And you turned HTTP off after reading that it is unsafe. The phone shows https://myapp.example — a red screen with NET::ERR_CERT_COMMON_NAME_INVALID: the name in the passport does not match the address.

In the server panel, issue a certificate for myapp.example and www.myapp.example, and turn on the redirect from http:// to https://. The certificate authority issues a passport only once it is sure the site is yours: it asks the server to put a password file in place and fetches it over http://. You can also check from the laptop’s terminal: curl -v https://myapp.example/.`,
    },
    summary: {
      title: 'Summary',
      body: `Your site now has a padlock, and http:// leads to https:// by itself. Press “Run”: signing in from the café now travels sealed.

- HTTP is a postcard: anyone along the way can read it, on open Wi-Fi even the neighbour at the next table.
- **HTTPS** seals what is inside. From the outside you only see where the envelope is going: the address, the port and the site’s name.
- A **certificate** is the site’s passport: the name, the expiry date and the signature of an authority the browser trusts. A red screen means one of the three checks failed, and the error code tells you which.
- To issue a passport, the certificate authority visits the site over http://, so port 80 stays open with a redirect to https:// on it.

Next, module 3, lesson 12: the firewall. How to open only the ports you need on a server, even when a program listens to everyone.`,
    },
  },
  annotations: {
    seesPassword: () => 'sees: password=kotik2024',
    seesName: () => 'sees: shop.example, port 443',
    seesMyapp: () => 'sees: myapp.example, port 443',
  },
  quizzes: {
    'cafe-sees': {
      question:
        'At the café you sign in at https://shop.example/login. What do the café network and the neighbour at the table learn about your envelope?',
      options: {
        nothing: 'Nothing: HTTPS hides everything',
        'address-only': 'Only the server’s IP address, 198.51.100.10',
        'address-port-name':
          'The server’s IP address, port 443 and the name shop.example',
        everything: 'Everything, including the /login page and the password',
      },
      wrong: {
        nothing:
          'The envelope is sealed, but it still needs an address on it, or it could not be delivered. The café sees where it is going.',
        'address-only':
          'Also port 443 and the site’s name: the phone says the name openly at the very start, so that the server can pick the right passport.',
        everything:
          'That would be true with http://. With https:// the page and the password travel inside the sealed envelope.',
      },
      explain:
        'The café knows you visited shop.example, but not which page or what you typed. That is why on someone else’s Wi-Fi you type passwords only on sites with a padlock.',
    },
  },
  tasks: {
    'get-certificate': {
      prompt:
        'Issue a certificate for myapp.example and www.myapp.example and turn on the redirect from http:// to https://.',
      goals: {
        lock: 'https://myapp.example opens with a padlock',
        'lock-www': 'https://www.myapp.example — with a padlock too',
        redirect: 'http://myapp.example redirects to https://',
        'only-web':
          'Only port 80 and port 443 are open from outside: the app and the database stay hidden',
      },
      hints: [
        'Press “Advanced” on the red screen: the browser says which name the passport is issued for now. It does not match myapp.example.',
        'You need a new certificate for myapp.example and www.myapp.example. The certificate authority checks that the site is yours by visiting it over http://. So first open port 80 on the “Site” tab, then issue the certificate on the “Certificate” tab, and finally turn on the redirect.',
        'The places you need in the panel are outlined with dashes. Finally, reload the page on the phone.',
      ],
      solvedNote:
        'The certificate covers both names: the site opens with a padlock, and http:// redirects to https://.',
    },
  },
  feedback: {
    CertNameMismatch: ({ name, names }) =>
      missesWww(name, names)
        ? `https://${name}: NET::ERR_CERT_COMMON_NAME_INVALID. The passport does not include the name ${name}. Issue the certificate for both names.`
        : `This server could not prove that it is ${name}: its certificate is issued for ${names.join(', ')}. The server may be misconfigured, or someone may be trying to intercept your data.`,
    GoalExtraOpenPort: ({ port }) =>
      port === 5432
        ? 'Port 5432 is open from outside — the database can be seen from the café. Set it back to “localhost only”.'
        : port === 3000
          ? 'Port 3000 is open from outside — the app can be reached as a postcard, bypassing HTTPS. Set it back to “localhost only”.'
          : `An extra port ${port} is open from outside. Close it on the “Site” tab.`,
    PortClosed: ({ port }) =>
      port === 80
        ? 'http://myapp.example — ERR_CONNECTION_REFUSED: port 80 is closed. Anyone who types the address without https gets an error. And the certificate authority cannot check the site: it needs port 80.'
        : `Port ${port} is closed: nobody listens on it.`,
    GoalNotRedirected: () =>
      'Over http:// the site opens as a postcard: the password from the sign-in form is readable in the café again. Turn on the redirect to https://.',
  },
  askAi: {
    lead: 'A red browser screen is an error code and the site’s passport. Copy both, and the AI will tell you which of the three checks failed:',
    template: `The browser says <error code, e.g. NET::ERR_CERT_COMMON_NAME_INVALID>
on https://<my site>.

Output of \`curl -v https://<my site>/\` (the starred lines about the certificate):
<paste the output>

How I issue the certificate: <certbot, Caddy, hosting panel, …>
Is port 80 open from outside — output of \`curl -v http://<my site>/\`:
<paste the output>

Why does the browser reject the certificate, and how do I issue it so
that both <my site> and www.<my site> work?`,
  },
} satisfies LessonTexts<typeof lesson>
