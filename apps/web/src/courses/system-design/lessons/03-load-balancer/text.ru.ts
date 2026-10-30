import { formatNumber } from '../../../../i18n/format'
import type { LessonTexts } from '../../../../lesson/dsl'
import type lesson from './lesson'

const n = (value: number) => formatNumber('ru', Math.round(value))
const percent = (ratio: number) => `${n(ratio * 100)}%`

export default {
  title: 'Load balancer. Нагрузка делится поровну',
  summary:
    'Горизонтальное масштабирование (horizontal scaling): load balancer как единый вход в систему, health check и правило N+1.',
  steps: {
    'one-server': {
      title: 'Один server',
      body: `Интернет-магазин устроен просто. [[users|Users]] отправляют запросы на единственный [[app1|server]] приложения, а он читает и записывает данные в [[db|database]].

Server размера M обрабатывает около **400 запросов в секунду**, сокращённо rps. Сейчас приходит 300. Полоска загрузки под блоком app1 зелёная, и все точки доходят до цели.`,
    },
    overload: {
      title: 'Распродажа',
      body: `Началась распродажа, и нагрузка выросла до **900 rps**. [[app1|Server]] успевает обработать свои 400 запросов, а остальные отбрасывает. Красные точки показывают пользователей, которые получили ошибку 503.

Время ответа портится раньше, чем загрузка доходит до 100%. Уже после 80% запросы ждут в очереди, и показатель p95 (время, за которое отвечают 95% запросов) растёт быстрее загрузки.`,
    },
    'scale-out': {
      title: 'Вверх или вширь',
      body: `Можно купить server мощнее. Это **вертикальное масштабирование** (vertical scaling). Оно простое, но у него есть потолок, цена растёт быстрее мощности, а server остаётся single point of failure.

Другой путь называется **горизонтальным масштабированием** (horizontal scaling): поставить несколько одинаковых блоков «Server». Мы добавили [[app2|app2]] и [[app3|app3]]. Они подключены к database, но простаивают, потому что пользователи знают только адрес [[app1|app1]].`,
    },
    'place-lb': {
      title: 'Задача: load balancer',
      body: 'Нужен посредник с одним адресом, который принимает все запросы и раздаёт их между блоками «Server». **Load balancer** (по-русски — балансировщик нагрузки) — именно такой посредник, и он уже появился в палитре слева от доски.',
    },
    'server-down': {
      title: 'Если server упал',
      body: ({ sim, doc }) => {
        const alive = doc.nodes.filter(
          node =>
            node.kind === 'server' &&
            !doc.failed.includes(node.id) &&
            (sim.nodes[node.id]?.incoming ?? 0) > 0,
        )
        const share = alive.length > 0 ? sim.load / alive.length : 0
        return `Load balancer раздаёт запросы **по кругу** (round-robin): первый запрос уходит на один server, второй на следующий, и так далее.

Теперь [[app2|app2]] упал. Load balancer каждые несколько секунд опрашивает блоки «Server». Это **health check** (проверка доступности): server, который не ответил, исключается из раздачи. Его долю забирают остальные, и теперь каждый получает ${n(share)} rps. ${share > 400 ? 'Это больше их 400 rps, поэтому часть запросов снова теряется.' : 'Они справляются, потому что у вас есть запасной server.'}

Отсюда правило **N+1**: блоков «Server» должно хватать на пиковую нагрузку даже без одного из них.`
      },
    },
    summary: {
      title: 'Итог',
      body: `Stateless server и load balancer вместе дают горизонтальное масштабирование. Чтобы выдержать больше нагрузки, достаточно добавить ещё один server, и load balancer начнёт отправлять запросы и на него.

Но все блоки «Server» ходят в одну [[db|database]], и она станет следующим узким местом. В уроке 4 поставим перед ней **cache** (по-русски — кеш: быстрая память для частых ответов).`,
    },
  },
  annotations: {
    app1Load: sim =>
      `${n(sim.nodes['app1']?.incoming ?? 0)} rps из 400 возможных`,
    app1Overload: sim =>
      `загрузка ${percent(sim.nodes['app1']?.utilization ?? 0)} · ошибки ${percent(sim.errorRate)}`,
    idle: () => '0 rps · простаивает',
    excluded: () => 'app2 не отвечает → исключён',
    survivorLoad: sim =>
      `${n(sim.nodes['app1']?.incoming ?? 0)} rps · ${percent(sim.nodes['app1']?.utilization ?? 0)}`,
    databaseLoad: sim =>
      `${n(sim.databaseLoad)} rps · сюда ходят все блоки «Server»`,
  },
  tasks: {
    'place-lb': {
      prompt:
        'Сделайте так, чтобы все запросы пользователей распределялись между тремя блоками «Server».',
      goals: {
        'lb-exists': 'На доске есть блок «Load balancer»',
        'lb-fans-out': 'Load balancer ведёт к трём блокам «Server»',
        'only-through-lb': '«Users» ходят только через load balancer',
        'holds-load': 'Держит 900 rps с ошибками меньше 1%',
      },
      hints: [
        'Запросы от «Users» должны приходить не на server, а в один «вход» в систему.',
        'Поставьте load balancer между «Users» и блоками «Server». Старая связь «Users → app1» должна исчезнуть.',
        'На доске появился пунктирный контур. Поставьте load balancer туда и проведите отмеченные связи. Красным отмечена связь, которую нужно удалить.',
      ],
      solvedNote:
        'Все запросы идут через load balancer, ни один server не перегружен.',
    },
  },
} satisfies LessonTexts<typeof lesson>
