import { Option } from 'effect'
import { expectOutMessage, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import {
  add,
  cable,
  move,
  router,
  send,
  setLinkUp,
  transit,
} from '../../net/build'
import { Intent } from '../../net/packet'
import { buildWorld } from '../../net/testing'
import { emptyWorld } from '../../net/world'
import { type BoardInput, BoardOutMessage } from '../contract'
import type { PacketTypes } from '../types'
import * as Board from './board'

// Подмодуль доски сетей (design D1 add-network-board): проигрыватель,
// выбор в квизах, чипы, инструмент «кабель», отправка по адресу, сборка
// конверта. Ходы уходят плееру как ProposedOps, выбор — как PickedTarget.

const input = (
  mode: BoardInput<PacketTypes>['mode'],
  pickable: ReadonlyArray<string> = [],
): BoardInput<PacketTypes> => ({ doc: emptyWorld, mode, pickable })

const update =
  (boardInput: BoardInput<PacketTypes>) =>
  (boardModel: Board.Model, boardMessage: Board.Message) =>
    Board.update(boardInput)(boardModel, boardMessage)

describe('playback', () => {
  test('Run plays to the next stop; frames move the playhead and stop there', () => {
    const playing = Board.update(input('View'))(
      Board.initialModel,
      Board.Message.ClickedRun({ startAt: 0, stopAt: 1000, total: 3000 }),
    ).model
    expect(playing).toMatchObject({
      playhead: 0,
      stopAt: 1000,
      hasStarted: true,
      playedTotal: 3000,
    })
    const moved = Board.frame(playing, 40, { isReducedMotion: false })
    expect(moved.playhead).toBe(40)
    const stopped = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].reduce(
      current => Board.frame(current, 100, { isReducedMotion: false }),
      playing,
    )
    expect(stopped.playhead).toBe(1000)
  })

  test('×¼ slows the frames down; interrupt rewinds but keeps the speed', () => {
    story(
      update(input('View')),
      given(Board.initialModel),
      message(Board.Message.ClickedSpeed()),
      message(
        Board.Message.ClickedRun({ startAt: 0, stopAt: 1000, total: 1000 }),
      ),
      model(next => {
        expect(Board.frame(next, 40, { isReducedMotion: false }).playhead).toBe(
          10,
        )
        expect(Board.interrupt(next)).toEqual({
          ...Board.initialModel,
          isSlow: true,
        })
      }),
    )
  })

  test('Back and To start stop the envelope at a hop', () => {
    story(
      update(input('View')),
      given(Board.initialModel),
      message(
        Board.Message.ClickedRun({ startAt: 0, stopAt: 3000, total: 3000 }),
      ),
      message(Board.Message.ClickedBack({ at: 1040, total: 3000 })),
      model(next => {
        expect([next.playhead, next.stopAt]).toEqual([1040, 1040])
      }),
      message(Board.Message.ClickedRestart()),
      model(next => {
        expect([next.playhead, next.stopAt, next.hasStarted]).toEqual([
          0,
          0,
          true,
        ])
      }),
    )
  })
})

describe('quiz picks', () => {
  test('a pick answers the quiz and plays the trace to the first stop', () => {
    story(
      update(input('Pick', ['laptop', 'router', 'shop'])),
      given(Board.initialModel),
      message(
        Board.Message.ClickedCandidate({
          id: 'router',
          playTo: 2280,
          total: 7760,
        }),
      ),
      expectOutMessage(BoardOutMessage.PickedTarget('router')),
      model(next => {
        expect([next.playhead, next.stopAt, next.hasStarted]).toEqual([
          0,
          2280,
          true,
        ])
      }),
    )
  })

  test('outside the quiz and for strangers a click picks nothing', () => {
    story(
      update(input('View', [])),
      given(Board.initialModel),
      message(
        Board.Message.ClickedCandidate({ id: 'router', playTo: 0, total: 0 }),
      ),
      model(next => {
        expect(next).toEqual(Board.initialModel)
      }),
    )
    story(
      update(input('Pick', ['router'])),
      given(Board.initialModel),
      message(
        Board.Message.ClickedCandidate({ id: 'phone', playTo: 0, total: 0 }),
      ),
      model(next => {
        expect(next).toEqual(Board.initialModel)
      }),
    )
  })

  test('several answers: clicks mark and unmark, Done sends them together', () => {
    story(
      update(input('Pick', ['link:a', 'link:b', 'link:c'])),
      given(Board.initialModel),
      message(Board.Message.ToggledCandidate({ id: 'link:a' })),
      message(Board.Message.ToggledCandidate({ id: 'link:c' })),
      message(Board.Message.ToggledCandidate({ id: 'link:a' })),
      message(Board.Message.ToggledCandidate({ id: 'link:b' })),
      model(next => {
        expect(next.selection).toEqual(['link:c', 'link:b'])
      }),
      message(Board.Message.ClickedDone({ playTo: 0, total: 0 })),
      expectOutMessage(BoardOutMessage.PickedTarget('link:c+link:b')),
    )
  })

  test('next hop: carry the envelope and drop it on a device', () => {
    story(
      update(input('Pick', ['core', 'dns'])),
      given(Board.initialModel),
      message(Board.Message.PressedEnvelope()),
      message(
        Board.Message.ReleasedOnCandidate({
          id: 'core',
          playTo: 900,
          total: 2000,
        }),
      ),
      expectOutMessage(BoardOutMessage.PickedTarget('core')),
      model(next => {
        expect(next.maybeGrab).toEqual(Option.none())
      }),
    )
  })

  test('chips: click a chip then a place, or drag it; Done sends the pairs', () => {
    story(
      update(input('Pick', ['dns', 'gateway', 'port'])),
      given(Board.initialModel),
      message(Board.Message.ClickedChip({ chip: 'dns' })),
      message(Board.Message.ClickedSlot({ slot: 'A' })),
      message(Board.Message.DraggedChip({ chip: 'port' })),
      message(Board.Message.DroppedOnSlot({ slot: 'B' })),
      message(Board.Message.ClickedChip({ chip: 'dns' })),
      message(Board.Message.ClickedSlot({ slot: 'C' })),
      model(next => {
        expect(next.placements).toEqual({ B: 'port', C: 'dns' })
      }),
      message(Board.Message.ClickedDone({ playTo: 0, total: 0 })),
      expectOutMessage(BoardOutMessage.PickedTarget('B=port+C=dns')),
    )
  })
})

describe('board tools', () => {
  test('the cable tool joins two devices pressed one after another', () => {
    story(
      update(input('Edit')),
      given(Board.initialModel),
      message(Board.Message.ClickedCableTool()),
      message(Board.Message.ClickedCableEnd({ id: 'printer' })),
      message(Board.Message.ClickedCableEnd({ id: 'router' })),
      expectOutMessage(
        BoardOutMessage.ProposedOps([cable('printer', 'router')]),
      ),
    )
  })

  test('an unplugged cable goes back in: pressed, or joined again with the cable tool', () => {
    const unplugged: BoardInput<PacketTypes> = {
      doc: buildWorld([
        add(
          router('router', 300, 300, {
            lan: '192.168.1.1/24',
            wan: '203.0.113.7',
          }),
        ),
        add(transit('isp', 490, 300, { ip: '203.0.113.1' })),
        cable('router', 'isp'),
        setLinkUp('router', 'isp', false),
      ]),
      mode: 'Edit',
      pickable: [],
    }
    story(
      update(unplugged),
      given(Board.initialModel),
      message(Board.Message.ClickedPlugIn({ a: 'router', b: 'isp' })),
      expectOutMessage(
        BoardOutMessage.ProposedOps([setLinkUp('router', 'isp', true)]),
      ),
    )
    story(
      update(unplugged),
      given(Board.initialModel),
      message(Board.Message.ClickedCableTool()),
      message(Board.Message.ClickedCableEnd({ id: 'isp' })),
      message(Board.Message.ClickedCableEnd({ id: 'router' })),
      expectOutMessage(
        BoardOutMessage.ProposedOps([setLinkUp('isp', 'router', true)]),
      ),
    )
    story(
      update({ ...unplugged, mode: 'View' }),
      given(Board.initialModel),
      message(Board.Message.ClickedPlugIn({ a: 'router', b: 'isp' })),
      model(next => {
        expect(next).toEqual(Board.initialModel)
      }),
    )
  })

  test('outside a task the cable tool does nothing', () => {
    story(
      update(input('View')),
      given(Board.initialModel),
      message(Board.Message.ClickedCableTool()),
      message(Board.Message.ClickedCableEnd({ id: 'printer' })),
      message(Board.Message.ClickedCableEnd({ id: 'router' })),
      model(next => {
        expect(next.tool).toEqual(
          Board.Tool.Cable({ maybeFrom: Option.none() }),
        )
      }),
    )
  })

  test('the card sends a photo to the typed address', () => {
    story(
      update(input('Edit')),
      given(Board.initialModel),
      message(Board.Message.ClickedDevice({ id: 'phone' })),
      message(Board.Message.UpdatedSendAddress({ value: ' 192.168.1.42 ' })),
      message(Board.Message.SubmittedSend({ from: 'phone', what: 'photo' })),
      expectOutMessage(
        BoardOutMessage.ProposedOps([
          send(
            Intent.Send({ from: 'phone', to: '192.168.1.42', what: 'photo' }),
          ),
        ]),
      ),
    )
  })

  test('a dragged device is moved where it is dropped', () => {
    story(
      update(input('Edit')),
      given(Board.initialModel),
      message(Board.Message.GrabbedDevice({ id: 'router', x: 300, y: 320 })),
      message(Board.Message.MovedDevice({ x: 512.4, y: 280.6 })),
      message(Board.Message.DroppedDevice()),
      expectOutMessage(BoardOutMessage.ProposedOps([move('router', 512, 281)])),
      model(next => {
        expect(next.maybeGrab).toEqual(Option.none())
      }),
    )
  })

  test('a press without a move is a click, not a move', () => {
    story(
      update(input('Edit')),
      given(Board.initialModel),
      message(Board.Message.GrabbedDevice({ id: 'router', x: 300, y: 320 })),
      message(Board.Message.DroppedDevice()),
      model(next => {
        expect(next).toEqual(Board.initialModel)
      }),
    )
  })

  test('the envelope builder sends the headers in the chosen order', () => {
    story(
      update(input('Edit')),
      given(Board.initialModel),
      message(Board.Message.ClickedHeader({ level: 'link' })),
      message(Board.Message.ClickedHeaderSlot({ position: 0 })),
      message(Board.Message.DraggedHeader({ level: 'transport' })),
      message(Board.Message.DroppedOnHeaderSlot({ position: 1 })),
      message(Board.Message.ClickedHeader({ level: 'internet' })),
      message(Board.Message.ClickedHeaderSlot({ position: 1 })),
      message(Board.Message.ClickedHeader({ level: 'application' })),
      message(Board.Message.ClickedHeaderSlot({ position: 3 })),
      model(next => {
        expect(next.headers).toEqual([
          'link',
          'internet',
          'transport',
          'application',
        ])
      }),
      message(
        Board.Message.ClickedBuilderSend({
          from: 'laptop',
          url: 'https://shop.example/',
        }),
      ),
      expectOutMessage(
        BoardOutMessage.ProposedOps([
          send(
            Intent.Raw({
              from: 'laptop',
              url: 'https://shop.example/',
              order: ['link', 'internet', 'transport', 'application'],
            }),
          ),
        ]),
      ),
    )
  })
})

describe('a move with its own trace', () => {
  test('replay plays the move from the start by itself', () => {
    const replayed = Board.replay({
      ...Board.initialModel,
      isSlow: true,
      maybeCard: Option.some('phone'),
    })
    expect(replayed).toMatchObject({
      playhead: 0,
      hasStarted: true,
      playedTotal: Board.AUTO_PLAY,
      isSlow: true,
      maybeCard: Option.none(),
    })
    expect(Board.frame(replayed, 50, { isReducedMotion: false }).playhead).toBe(
      12.5,
    )
  })
})
