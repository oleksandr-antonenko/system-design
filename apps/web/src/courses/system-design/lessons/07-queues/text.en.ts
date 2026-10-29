import { Option } from 'effect'

import type { SimResult } from '../../../../domain/simulate'
import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('en', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`
const p95 = (sim: SimResult) =>
  Option.match(sim.p95, { onNone: () => '—', onSome: ms => `${n(ms)} ms` })
const app1In = (sim: SimResult) => sim.nodes['app1']?.incoming ?? 0
const app1Load = (sim: SimResult) => sim.nodes['app1']?.utilization ?? 0

const queuePoint = `That is the point of a queue: workers are sized for the usual load, not for the peak, and the queue smooths the peak out. But only if the queue drains between peaks. If load stays above what the workers can do, the queue grows without end, and the only cure is more workers.`

export default {
  title: 'Queues and background work',
  summary:
    'Moving slow work out of the request: a queue, workers, queue growth, bursts and at-least-once delivery.',
  steps: {
    'in-request': {
      title: 'Everything inside the request',
      body: `The online shop has grown. [[users|Users]] send requests to two application servers, [[app1|app1]] and [[app2|app2]], and the data lives in the [[db|database]]. The load balancer from lesson 3 is left off the board to save room: the Users block spreads requests evenly across the servers itself, just as a balancer would.

When a customer places an order, the server saves it, sends a confirmation email, renders a PDF invoice and only then answers. The mail service takes about a second to reply, the PDF eats CPU time, and the customer watches a spinner all along. Photo uploads, sign-ups and password resets hide the same kind of work. In this lesson's model every request the server handles leaves one such **job**.

While a request is busy with it, the server cannot take others, so it manages about **150 rps** instead of the usual 400. Right now 240 rps arrive, and the servers are already 80% busy.`,
    },
    sale: {
      title: 'The sale',
      body: `A sale starts and load jumps to **500 rps**. Each [[app1|server]] manages its 150 requests per second and drops the other 100: **40%** of customers get an error, and the lucky ones wait more than a second for a response.

The annoying part is that the customer does not need the email at the moment they click the button. All they need to know is that the order is saved. Yet the slow work holds the request, and to carry it you would need four servers instead of two.`,
    },
    background: {
      title: 'Later, in the background',
      body: `Work the user is not waiting for can be done **later**, in the background. We changed the order handler: the server saves the order, records a job such as “send the email for order 1042” and answers right away.

Without the slow work a server handles its usual 400 rps again. At the same 500 rps [[app1|app1]] and [[app2|app2]] are 63% busy, the errors are gone, and p95 has dropped from over a second to about 100 ms.

Only the jobs have nowhere to go yet: nobody sends the emails. They need a **queue**, a buffer where the server (the **producer**) leaves a job and moves on. Separate processes, **workers** (the **consumers**), take jobs from the queue one at a time and do them at their own pace.`,
    },
    'add-queue': {
      title: 'Task: a queue and workers',
      body: `The queue and the worker are already in the palette to the left of the board. A worker does about **200 jobs per second**, and every request now leaves one job, so at 500 rps there are 500 jobs every second.

If the workers do fewer jobs than arrive, the queue **grows**: the label on the queue block and the Queue growing instrument show by how much per second. That is not an error yet, but a queue that grows forever means emails that arrive hours late.`,
    },
    burst: {
      title: 'A burst',
      body: ({ sim }) => {
        const growth = sim.backlog
        const opening = `Black Friday morning: for ten minutes load jumps to **700 rps**. The servers cope: [[app1|app1]] is ${percent(app1Load(sim))} busy, there are no errors, and p95 has grown only to ${p95(sim)}.`
        if (growth < 1) {
          return `${opening}

Your workers keep up even with the peak: they can do more than 700 jobs per second, so the queue does not grow. The three workers that 500 rps needs would finish 600 jobs per second: the queue would grow by 100 every second, and ${n(60000)} emails would pile up over ten minutes. After the peak they would clear them in ten minutes.

${queuePoint}`
        }
        const done = sim.load - growth
        const spare = done - 500
        const pile = growth * 600
        const drain =
          spare >= 1
            ? `When the peak passes and load returns to 500 rps, the workers have ${n(spare)} jobs per second to spare and clear the pile in about ${n(pile / spare / 60)} minutes.`
            : 'Even after the peak the workers would have nothing to spare, and the pile would never clear.'
        return `${opening}

The workers finish ${n(done)} jobs per second, and every second ${n(growth)} more arrive than they can take. The queue **grows**: over ten minutes ${n(pile)} emails pile up in it. These are not errors: no job is lost, it simply waits its turn.

${drain} ${queuePoint}`
      },
    },
    'worker-crash': {
      title: 'A worker crashes',
      body: ({ sim }) => {
        const growth = sim.backlog
        const meanwhile =
          growth >= 1
            ? ` Meanwhile the remaining workers finish ${n(sim.load - growth)} jobs per second while ${n(sim.load)} arrive, so the queue grows by ${n(growth)} every second. Customers do not notice: the site answers just as fast.`
            : ` The remaining workers still handle all ${n(sim.load)} jobs per second: you have a spare one.`
        return `The peak is over and load is back to 500 rps. Then [[worker-2|worker-2]] crashes in the middle of a job: it took an order and sent the email, but did not get to report back.

The queue does not delete a job when it hands it out. It waits for an **acknowledgement** (ack) from the worker. If no ack arrives in time, the job goes back to the queue and another worker takes it. That is a **retry**, and it is why a crash loses no email.${meanwhile}

The price of retries is duplicates. The email was already sent, but without the ack the job runs a second time. Queues promise **at-least-once** delivery: every job is done at least once, and sometimes twice. So a job has to be **idempotent**: running it again changes nothing. For example, the worker passes the order number to the mail service as an idempotency key, and the service sends one email per key however many times it is asked. A job that fails again and again (say, the address does not exist) is moved after a few attempts to a separate **dead-letter queue**, so it does not hold up the rest.`
      },
    },
    summary: {
      title: 'Summary',
      body: `[[worker-2|worker-2]] is back, and the queue has stopped growing. You moved the slow work out of the request: the server saves the order, leaves a job in the queue and answers at once, while the workers send emails and build invoices in the background.

A queue gives you three things. **Speed**: the user does not wait for work they do not need right now. **Smoothing**: a burst piles up in the queue instead of overloading the workers and the mail service, and they clear it after the peak. **Isolation**: a slow mail service or a crashed worker does not bring the site down, and the job is retried.

The rules are short. Size the workers for the usual load and watch the queue growth. Make jobs idempotent, because delivery is at least once. A queue gives every job to **one** worker; in lesson 12 we meet its relative, the **event bus**, which hands a copy of every message to each subscriber. But first, lesson 8 deals with a burst that hits the servers themselves.`,
    },
  },
  annotations: {
    slowServer: sim => `${n(app1In(sim))} of 150 rps · email and PDF inside`,
    saleOverload: sim =>
      `load ${percent(app1Load(sim))} · errors ${percent(sim.errorRate)}`,
    lightServer: sim => `${n(app1In(sim))} of 400 rps · answers at once`,
    burstServer: sim =>
      `${n(app1In(sim))} rps · ${percent(app1Load(sim))} · errors ${percent(sim.errorRate)}`,
    burstQueue: sim =>
      sim.backlog >= 1
        ? `+${n(sim.backlog)} jobs/s wait their turn`
        : 'keeps up with the peak',
    crashed: () => 'crashed · its job goes back to the queue',
    redelivered: sim =>
      sim.backlog >= 1
        ? `+${n(sim.backlog)}/s · no job lost`
        : 'a spare worker covers it',
    steady: sim =>
      sim.backlog >= 1
        ? `growing +${n(sim.backlog)}/s`
        : `${n(sim.load)} jobs/s · not growing`,
  },
  tasks: {
    'add-queue': {
      prompt:
        'Move the slow work into a queue and add enough workers that the queue does not grow at 500 rps.',
      goals: {
        'queue-exists': 'There is a queue on the board',
        'servers-enqueue': 'Both servers put jobs into the queue',
        'queue-has-workers': 'The queue hands jobs to workers',
        'no-backlog': 'At 500 rps the queue does not grow',
        'site-answers': 'Handles 500 rps with less than 1% errors',
      },
      hints: [
        'Jobs need a place to wait and someone to do them. The server should only leave a job and answer.',
        'Place a queue to the right of the servers and connect app1 and app2 to it. Then connect workers to the queue: 500 jobs arrive per second and a worker does 200, so work out how many you need.',
        'A dashed outline appeared on the board. Place the queue and three workers there and draw the marked connections: from both servers to the queue and from the queue to each worker.',
      ],
      solvedNote:
        'The servers answer at once, and the workers keep up with all 500 jobs per second: the queue does not grow.',
    },
  },
} satisfies LessonTexts<typeof lesson>
