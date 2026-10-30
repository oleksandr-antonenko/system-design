import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('uk', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`

export default {
  title: 'Load balancer',
  summary:
    'Горизонтальне масштабування (horizontal scaling): кілька блоків «Server» за одним входом, health check і правило N+1.',
  steps: {
    'one-server': {
      title: 'Один server',
      body: `Інтернет-магазин влаштований просто. [[users|Users]] надсилають запити на один [[app1|server]] застосунку, а він читає і записує дані в [[db|database]].

Server розміру M обробляє близько **400 запитів на секунду**, скорочено rps. Зараз надходить 300. Смужка завантаження під блоком зелена, і всі точки доходять до мети.`,
    },
    overload: {
      title: 'Розпродаж',
      body: `Почався розпродаж, і навантаження зросло до **900 rps**. [[app1|Server]] встигає обробити свої 400 запитів, а решту відкидає. Червоні точки — це користувачі, які отримали помилку 503.

Час відповіді погіршується раніше, ніж завантаження доходить до 100%. Уже після 80% запити чекають у черзі, і показник p95 (час, за який відповідають 95% запитів) зростає швидше за завантаження.`,
    },
    'scale-out': {
      title: 'Угору чи вшир',
      body: `Можна купити потужніший server. Це **вертикальне масштабування** (vertical scaling). Воно просте, але має стелю, ціна зростає швидше за потужність, а server лишається single point of failure.

Інший шлях — **горизонтальне масштабування** (horizontal scaling): поставити кілька однакових блоків «Server». Ми додали [[app2|app2]] і [[app3|app3]]. Вони підключені до database, але простоюють, бо users знають лише адресу [[app1|app1]].`,
    },
    'place-lb': {
      title: 'Задача: load balancer',
      body: '**Load balancer** (українською — балансувальник навантаження) — посередник з однією адресою: він приймає всі запити й роздає їх блокам «Server». Саме такий посередник тут і потрібен, і він уже з’явився в палітрі ліворуч від дошки.',
    },
    'server-down': {
      title: 'Якщо server упав',
      body: ({ sim, doc }) => {
        const alive = doc.nodes.filter(
          node =>
            node.kind === 'server' &&
            !doc.failed.includes(node.id) &&
            (sim.nodes[node.id]?.incoming ?? 0) > 0,
        )
        const share = alive.length > 0 ? sim.load / alive.length : 0
        return `Load balancer роздає запити **по колу** (round-robin): перший запит іде на один server, другий — на наступний, і так далі.

Тепер [[app2|app2]] упав. Load balancer кожні кілька секунд опитує блоки «Server». Це **health check** (перевірка справності): server, який не відповів, виключається з роздачі. Його частку забирають решта блоків, і тепер кожен отримує ${n(share)} rps. ${share > 400 ? 'Це більше за їхні 400 rps, тому частина запитів знову втрачається.' : 'Вони впораються, бо у вас є запасний server.'}

Звідси правило **N+1**: блоків «Server» має вистачати на пікове навантаження навіть без одного з них.`
      },
    },
    summary: {
      title: 'Підсумок',
      body: `Блоки «Server» без стану (stateless) разом із load balancer дають горизонтальне масштабування. Щоб витримати більше навантаження, досить додати ще один server за load balancer.

Але всі блоки «Server» ходять в одну [[db|database]], і вона стане наступним вузьким місцем. В уроці 4 поставимо перед нею **cache** (українською — кеш: швидка пам’ять для частих відповідей).`,
    },
  },
  annotations: {
    app1Load: sim =>
      `${n(sim.nodes['app1']?.incoming ?? 0)} rps із 400 можливих`,
    app1Overload: sim =>
      `завантаження ${percent(sim.nodes['app1']?.utilization ?? 0)} · помилки ${percent(sim.errorRate)}`,
    idle: () => '0 rps · простоює',
    excluded: () => 'app2 не відповідає → виключено',
    survivorLoad: sim =>
      `${n(sim.nodes['app1']?.incoming ?? 0)} rps · ${percent(sim.nodes['app1']?.utilization ?? 0)}`,
    databaseLoad: sim => `${n(sim.databaseLoad)} rps від усіх блоків «Server»`,
  },
  tasks: {
    'place-lb': {
      prompt:
        'Зробіть так, щоб усі запити від users розподілялися між трьома блоками «Server».',
      goals: {
        'lb-exists': 'На дошці є блок «Load balancer»',
        'lb-fans-out': 'Load balancer веде до трьох блоків «Server»',
        'only-through-lb': 'Users ходять лише через load balancer',
        'holds-load': 'Витримує 900 rps з помилками менше 1%',
      },
      hints: [
        'Users мають звертатися не до server, а до одного «входу» в систему.',
        'Поставте load balancer між users і блоками «Server». Старий зв’язок «Users → app1» має зникнути.',
        'На дошці з’явився пунктирний контур. Поставте load balancer туди й проведіть позначені зв’язки. Червоним позначено зв’язок, який треба видалити.',
      ],
      solvedNote:
        'Усі запити йдуть через load balancer, жоден server не перевантажений.',
    },
  },
} satisfies LessonTexts<typeof lesson>
