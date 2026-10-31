import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

export default {
  title: 'Access token. A pass of its own for the AI',
  summary:
    'An AI chat is not a vault: the assistant gets a pass of its own. A read-only token instead of a password in the chat, revoked when the work is done.',
  preview: {
    alt: 'Illustration: an AI chat on a laptop, beside it a green pass on a lanyard, the assistant’s own access token, while the master key stays in a safe.',
  },
  labels: {
    marina: { name: 'Marina' },
    oleg: { name: 'Oleg' },
    assistant: { name: 'AI assistant' },
    crm: { name: 'Romashka CRM' },
    'assistant:intro': {
      name: 'Hi! I’ll put together the October sales report. I need access to the CRM: send me the admin login and password, that’s the quickest way.',
    },
    'assistant:say-password': {
      name: 'Login: admin\nPassword: ••••••••••••',
    },
    'assistant:say-token': {
      name: 'Here’s the token: crm_tok_••••••••••••3f9a',
    },
    'assistant:say-reference': {
      name: 'The token is in 1Password: op://Work/crm-agent/token. Run it with op run.',
    },
    'assistant:password': {
      name: 'I can see the admin password. Don’t send passwords in the chat: they stay in the history. Better create a separate read-only token in the CRM, and delete this message.',
    },
    'assistant:token': {
      name: 'Got the token, working on it. A tip for next time: a token is a secret too, so it’s safer to give a link to the 1Password item.',
    },
    'assistant:reference': {
      name: 'Running it with op run: the token goes into an environment variable and never reaches the chat.',
    },
    'assistant:done': {
      name: 'Done: I exported 248 October deals to the “Sales — October” spreadsheet. I don’t need access any more, so the token can be revoked.',
    },
    'section:sales': { name: 'Sales' },
    'section:clients': { name: 'Clients' },
    'section:invoices': { name: 'Invoices' },
    'section:staff': { name: 'Staff' },
  },
  steps: {
    'not-a-vault': {
      title: 'A chat is not a vault',
      body: `AI assistants such as Claude, ChatGPT and Codex can work with a CRM, spreadsheets and code, and more and more often they need access to work systems.

But a chat with an assistant is not a vault. A pasted password stays in the chat history, the account administrators can see it, and it ends up in logs and backups. And the admin password opens everything at once.`,
    },
    'own-pass': {
      title: 'A pass of its own',
      body: `The assistant gets a pass of its own, an **access token**: a separate key just for this job. It has its own **permissions**: what it may do (only read), where (one section) and for how long (a week).

The token itself is kept in the password manager, and the assistant gets not the text but a link to the item: **op://Work/crm-agent/token**. The **op run** command passes the token to the program, and it never reaches the chat.`,
    },
    leak: {
      title: 'Question: where is the leak',
      body: 'Oleg sent the assistant three messages in one day. One of them leaks a secret. Which one?',
    },
    friday: {
      title: 'The pass burns out',
      body: `The work is done, so the pass is revoked without waiting for Friday. The one-week term is insurance in case someone forgets.

A revoked token opens nothing, and your password stays with you: you don’t need to change it or tell it to anyone.`,
      more: {
        title: 'More: settings, code and screenshots',
        body: `**Work plan and settings.** For work, use the assistant’s work account and check the “don’t use my data for training” setting. Client documents and personal data don’t go into a personal account.

**Agents in code** (Codex, Claude Code and others). Secrets are kept in a **.env** file, and that file is listed in **.gitignore**. The agent gets no access to **~/.ssh** or to the browser’s passwords. Commands the agent wants to run are read before you confirm them.

**Screenshots.** A secret in a screenshot is the same as a secret in the chat: before sending one, check that no token, password or QR code is visible on it.`,
      },
    },
    'crm-token': {
      title: 'Task: access for the assistant',
      body: `Marina asks the assistant to put together a sales report, and it asks for the CRM admin password.

Give the assistant a pass of its own: in the CRM, create a read-only token for the “Sales” section for 7 days, save it to the password manager and give the assistant a link to the item. When the work is done, revoke the token.`,
    },
    summary: {
      title: 'Summary',
      body: `Oleg pasted a password into the chat, while Marina gave the assistant a pass and took it back after the work.

- An AI chat is not a vault: passwords and tokens are never pasted into it.
- An **access token** with narrow **permissions**: read only, one section, a short term.
- The token lives in the password manager, and the assistant gets a link to the item; after the work, the token is revoked.`,
    },
  },
  annotations: {
    'dictate.alt': () =>
      'Oleg shows a friendly robot assistant a sheet of paper with a password; the sheet flies off into a tall chat-archive cabinet holding hundreds of sheets just like it.',
    'dictate.narration': () =>
      'Oleg asks the assistant to put a report together.',
    'dictate.oleg': () => 'Here’s the admin password. Can you figure it out?',
    'pass.alt': () =>
      'Marina hangs a guest pass around the robot assistant’s neck, with a small “read only” padlock and a little calendar up to Friday.',
    'pass.narration': () => 'Marina does it differently.',
    'pass.marina': () =>
      'Here’s your pass: read only, sales only, until Friday.',
    'pass.robot': () => 'Got it! That’s all I need.',
    'three.alt': () =>
      'Oleg at his laptop; above him float three message bubbles for the assistant: a spreadsheet, a key in a safe and a settings file.',
    'three.narration': () => 'Oleg’s three messages in one day.',
    'friday.alt': () =>
      'Friday. The guest pass around the robot’s neck crumbles into sparks, and the robot waves. Marina nods, pleased.',
    'friday.narration': () =>
      'The report is ready. The pass is no longer needed.',
    'friday.robot': () => 'Thanks! You can take the pass back.',
    'summary.dictate': () => 'An AI chat is not a vault',
    'summary.pass': () => 'The assistant gets its own pass',
    'summary.three': () => 'A secret in a file is a leak too',
    'summary.friday': () => 'Work done, token revoked',
  },
  quizzes: {
    leak: {
      question: 'Which of the three messages to the assistant leaks a secret?',
      options: {
        export:
          '“Here’s the October sales export, I’ve removed the client names. Build a chart.”',
        reference:
          '“The token is in 1Password: op://Work/crm-agent/token. Run it with op run.”',
        env: '“It won’t connect to the CRM, here’s my whole .env file. See what’s wrong.”',
      },
      wrong: {
        export:
          'An export without client names is ordinary work data: there are no secrets in it.',
        reference:
          'This is a link to an item in the password manager, not the token itself. Only a program started with op run on your computer can get the token through it.',
      },
      explain:
        'A **.env** file holds secrets: tokens, database passwords, service keys. Sending the whole file is the same as pasting all those passwords into the chat. Show the assistant the error, not the secrets; if the file has already gone out, the keys in it are changed.',
    },
  },
  tasks: {
    'crm-token': {
      prompt:
        'Give the assistant access to sales without the admin password, and take it back after the work.',
      goals: {
        scoped:
          'The assistant works with a token: read only, “Sales” only, for no longer than 7 days',
        revoked: 'The token is revoked after the work',
        clean:
          'Access is given with no secrets in the chat; if the password got there, it has been changed',
      },
      hints: [
        'The admin password is not pasted into the chat. Go to the “CRM” tab: that’s where a separate token for the assistant is created.',
        'At first the token form gives everything: full access, all sections, no expiry. Narrow it down to reading, one section and 7 days. Give the assistant a link to the password manager item; for that, the token is saved first.',
        'In the CRM: “Read only”, a tick only next to “Sales”, “7 days” → “Create token” → “Save to the password manager”. In the assistant chat: “Give a link to the password manager item”. When the report is ready, in the CRM: “Revoke”. The place to press is outlined with a dashed line.',
      ],
      solvedNote:
        'Done: the report is ready, the assistant saw only sales and only for a week, and now its pass has been revoked. The admin password never left the CRM.',
    },
  },
} satisfies LessonTexts<typeof lesson>
