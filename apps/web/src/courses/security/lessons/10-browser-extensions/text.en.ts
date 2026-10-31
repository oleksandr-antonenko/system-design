import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Browser extensions. What an extension sees',
  summary:
    'An extension with access to every site sees everything you do. Read the permissions before installing and clear out extensions you do not need every quarter.',
  preview: {
    alt: 'Illustration: one of the browser extensions, a puzzle piece, opens a request in the browser to see pages, files and the camera, with allow and cancel buttons.',
  },
  labels: {
    marina: { name: 'Marina' },
    striped: { name: 'Stripes' },
    'extensions-app': { name: 'Browser extensions' },
    'group:store': {
      name: 'Install',
      note: 'Oleg sent a link: “A PDF converter, really handy!” The store has two of them.',
    },
    'group:installed': {
      name: 'Installed extensions',
      note: 'Check this list every quarter: is everything still needed, and have the permissions changed?',
    },
    'item:pdf-pro': {
      name: 'PDF Converter Pro',
      note: 'Unknown developer · 2 million users',
    },
    'item:pdf-lite': {
      name: 'PDF Tools Lite',
      note: 'The same converter, another developer · 300,000 users',
    },
    'item:vault': {
      name: '1Password',
      note: 'Installed by IT · the password manager from lesson 3',
    },
    'item:translate': {
      name: 'Page translator',
      note: 'Translates the page when you click its icon',
    },
    'item:coupons': {
      name: 'Coupons & Deals 24/7',
      note: 'Installed for a single purchase a year ago',
    },
    'item:dark': {
      name: 'Dark Theme Max',
      note: 'The developer changed a month ago; after the update it asked for new permissions',
    },
    'item:meet': {
      name: 'Romashka Meet',
      note: 'Company video calls, installed by IT',
    },
    'detail:all-sites': {
      name: 'Read and change all your data on all websites',
    },
    'detail:history': { name: 'Read your browsing history' },
    'detail:clipboard': { name: 'Read what you copy' },
    'detail:on-click': {
      name: 'Read and change data on the current site when you click the extension',
    },
    'detail:meet': {
      name: 'Read and change your data on meet.romashka.example',
    },
    'action:install': { name: 'Install' },
    'action:cancel': { name: 'Cancel' },
    'action:keep': { name: 'Keep' },
    'action:remove': { name: 'Remove' },
    'res:pdf-pro:install': {
      name: 'Stop: the converter now sees every page — mail, CRM, bank — and can change what you type. In real life, right now: remove it on the extensions page and tell IT.',
    },
    'res:pdf-pro:cancel': {
      name: 'Right: converting a PDF does not need access to every site. There is a humbler option below.',
    },
    'res:pdf-lite:install': {
      name: 'Installed. It works only on the page where you clicked its icon yourself.',
    },
    'res:vault:remove': {
      name: 'This is the password manager from IT: it needs every site to fill in passwords. Broad access is not a verdict when the extension is needed and comes from someone you trust. Keep it.',
    },
    'res:translate:remove': {
      name: 'The translator only needs the page you clicked on. You can keep it.',
    },
    'res:coupons:remove': {
      name: 'Removed. The coupons were not worth it: for a year the extension saw every page you opened.',
    },
    'res:dark:remove': {
      name: 'Removed. A new owner and new permissions — that is how extensions turn into spies.',
    },
    'res:meet:remove': {
      name: 'These are the company video calls from IT, with access to their own site only. Keep them.',
    },
  },
  steps: {
    helper: {
      title: 'A little helper in the browser',
      body: `A **browser extension** is a small program that plugs into Chrome or another browser and gives it new skills: translating pages, finding coupons, checking spelling. The 1Password icon from lesson 3 that fills in passwords is an extension too.

An extension has its own [[helper|key]] to your tabs. Which pages it sees is up to you when you install it.`,
    },
    permissions: {
      title: 'Permissions',
      body: `Before installing, the browser shows a window with **permissions** — the list of what the extension is allowed to do. Read it as carefully as the address of an email.

Compare the lines on the right. “When you click” — the extension sees one page, and only after you click. “On meet.romashka.example” — one site. “On all websites” — every page: mail, CRM, bank, and everything you type there, passwords included.

The rule: access to every site goes only to what you really need for work and get from a trusted source.`,
    },
    sold: {
      title: 'The extension was sold',
      body: `Even a good extension can go bad. Popular extensions get bought: they already have millions of users and broad permissions. The new owner ships an update, and yesterday's “dark theme” sends him everything you see.

Updates arrive by themselves, without asking. So what matters is not only what you installed, but what you have right now.`,
      more: {
        title: 'More: how to tidy up',
        body: `**Where the list is.** In Chrome: the “⋮” menu → “Extensions” → “Manage extensions”. Other browsers have a similar menu item.

**What to remove.** Anything you have not used for a month; extensions from unknown developers; ones that want every site for no clear reason; ones that recently asked for new permissions.

**A work browser.** IT often restricts installing extensions. If you need a new one, ask IT rather than look for a workaround.`,
      },
    },
    cleanup: {
      title: 'Question: which permission is riskier',
      body: 'Marina is going through her list of extensions. Three of them have these permissions. Which one is the most dangerous?',
    },
    extensions: {
      title: "Task: Marina's extensions",
      body: `Oleg sent a link to a “really handy” PDF converter. The store has two of them, with different permissions. It is also a good moment to check what is already installed.

Decline the extension that wants every site, install the humbler one and remove two unneeded extensions out of five. Keep what IT installed.`,
    },
    summary: {
      title: 'Summary',
      body: `Only the helpers Marina needs are left in her browser.

- A **browser extension** sees what you allowed at installation: “all websites” means mail, CRM and passwords.
- Before installing, read the **permissions** and pick the “when you click” or “one site” option.
- Clear out extras every quarter; new permissions after an update are a reason to be wary.`,
    },
  },
  annotations: {
    'helper.alt': () =>
      'A huge browser window with tabs. A tiny helper robot sits on top with a ring of keys, one for each tab; Marina looks up at it.',
    'helper.narration': () => 'A helper with keys to every tab.',
    'helper.marina': () =>
      'So that is who fills in my passwords and translates pages!',
    'permissions.alt': () =>
      'Marina at her laptop reads an install window through a magnifying glass: three lines with a globe, a page and a hand icon. Over the frame, a comparison of permissions.',
    'permissions.narration': () => 'Read the install window before the button.',
    'permissions.compare': () =>
      'What the extension will see\none page, only when you click|**when you click**\nevery page: mail, CRM, bank|**all data on all websites**',
    'sold.alt': () =>
      "The browser's helper robot is handed over to a new owner, Stripes with a bag of coins. The robot's shiny shell is half open, with stripes underneath.",
    'sold.narration': () => 'The extension changed hands.',
    'sold.striped': () => 'A million users and every site. What a bargain!',
    'cleanup.alt': () =>
      'At a shelf with five tiny extension robots, Marina lifts two of them — the coupon one and the paint roller one — into a recycling box.',
    'cleanup.narration': () => 'Once a quarter, a clear-out.',
    'cleanup.marina': () => "I haven't used these for a year. Goodbye!",
    'summary.helper': () => 'An extension is a helper with keys',
    'summary.permissions': () => 'Read permissions before installing',
    'summary.sold': () => 'Extensions get sold and updated',
    'summary.cleanup': () => 'A clear-out every quarter',
  },
  quizzes: {
    'which-permission': {
      question: 'Which of these permissions is the most dangerous?',
      options: {
        'one-site': 'Read and change your data on meet.romashka.example.',
        'all-sites': 'Read and change all your data on all websites.',
        notify: 'Show notifications.',
      },
      wrong: {
        'one-site':
          'This is access to one video-call site. The extension cannot see your mail, CRM or bank.',
        notify:
          'Notifications can be annoying, but they do not let the extension read pages or what you type.',
      },
      explain:
        '“All your data on all websites” means every page you open and everything you type on it: emails, CRM clients, passwords, card numbers. Such access goes only to an extension you need, from someone you trust.',
    },
  },
  tasks: {
    extensions: {
      prompt:
        'Decline the extension that wants every site, install the humbler option and remove two unneeded extensions.',
      goals: {
        declined: 'The converter with access to every site is not installed',
        narrow: 'A converter that works on click is installed',
        cleaned: 'Unneeded extensions are removed; those from IT stay',
      },
      hints: [
        'Read the red permission lines: access to every site. Compare the two converters — they do the same job.',
        'In the list, remove what nobody uses and what changed hands. 1Password also sees every site, but IT installed it, and without that it cannot fill in passwords.',
        'PDF Converter Pro — “Cancel”, PDF Tools Lite — “Install”, “Coupons & Deals 24/7” and Dark Theme Max — “Remove”. The right button is outlined with a dashed line.',
      ],
      solvedNote:
        'Done: the converter works on click, the coupons and the theme that changed hands are gone, and 1Password, the translator and video calls are in place.',
    },
  },
} satisfies LessonTexts<typeof lesson>
