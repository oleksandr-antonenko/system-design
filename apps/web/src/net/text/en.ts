import { type Medium, type WifiBand } from '../model'
import { type NetTexts, type TextContext } from './types'

const band = (value: WifiBand): string =>
  value === 'dual' ? '2.4 and 5 GHz' : value === '2.4' ? '2.4 GHz' : '5 GHz'

const how: Readonly<Record<Medium, string>> = {
  cable: 'with a cable',
  radio: 'over Wi-Fi',
}

const up = (value: string): string => value.toUpperCase()

const q = (id: string, context: TextContext): string => context.name(id)

const all = (ids: ReadonlyArray<string>, context: TextContext): string =>
  ids.map(id => q(id, context)).join(', ')

export const en: NetTexts = {
  UnknownDevice: ({ id }, c) => `There is no ${q(id, c)} on the board.`,
  DuplicateDeviceId: ({ id }, c) => `${q(id, c)} is already on the board.`,
  InvalidMac: ({ value }) =>
    `“${value}” is not a MAC address: it needs six pairs of characters separated by colons.`,
  DuplicateMac: ({ mac, owner }, c) => `${q(owner, c)} already has MAC ${mac}.`,
  InvalidIp: ({ value }) =>
    `“${value}” is not an address: it needs four numbers from 0 to 255 separated by dots.`,
  InvalidPrefix: ({ value }) => `The mask /${value} does not fit.`,
  AddressNotUsable: ({ ip, prefix }) =>
    `${ip}/${prefix} cannot go to a device: it is the address of the network itself or the “everyone” address.`,
  GatewayOutsideSubnet: ({ gateway, ip, prefix }) =>
    `Router ${gateway} is not in the network ${ip}/${prefix}, so the device cannot reach it.`,
  OnlyOneInternet: () => 'There can be only one internet on the board.',
  ConnectSelf: ({ id }, c) => `${q(id, c)} cannot be connected to itself.`,
  AlreadyLinked: ({ a, b }, c) =>
    `${q(a, c)} and ${q(b, c)} are already connected.`,
  UnknownLink: ({ a, b }, c) =>
    `There is no link between ${q(a, c)} and ${q(b, c)}.`,
  PortBusy: ({ device }, c) =>
    `${q(device, c)} has one socket, and it is already taken.`,
  RadioNeedsAccessPoint: ({ a, b }, c) =>
    `Wi-Fi connects a device to a router or an access point, and neither ${q(a, c)} nor ${q(b, c)} is one.`,
  NoWifiOnDevice: ({ device }, c) =>
    `${q(device, c)} has no Wi-Fi: connect it with a cable.`,
  InternetNeedsRouter: ({ device }, c) =>
    `The internet takes a router or a server, not ${q(device, c)}.`,
  SecondWanLink: ({ router }, c) =>
    `${q(router, c)} already has a way out to the internet.`,
  LinkMakesLoop: ({ a, b }, c) =>
    `A link ${q(a, c)} — ${q(b, c)} would close a ring: envelopes would run in circles.`,
  NotAHost: ({ id }, c) =>
    `This is done on a computer, phone or server, not on ${q(id, c)}.`,
  NotARouter: ({ id }, c) =>
    `This is a router setting, and ${q(id, c)} is not a router.`,
  NotAnAccessPoint: ({ id }, c) =>
    `${q(id, c)} has no Wi-Fi network of its own to set up.`,
  DhcpPoolOutsideSubnet: ({ start, end, network, prefix }) =>
    `Addresses ${start}–${end} are not in the home network ${network}/${prefix}.`,
  DhcpPoolReversed: ({ start, end }) =>
    `The pool starts at ${start}, after its end ${end}.`,
  DhcpPoolIncludesRouter: ({ ip }) =>
    `The pool includes the router's own address ${ip}.`,
  ReservationOutsideSubnet: ({ mac, ip }) =>
    `Address ${ip} for ${mac} is not in the home network.`,
  ReservationTaken: ({ ip, mac }) =>
    `Address ${ip} is already kept for ${mac}.`,
  EmptySsid: () => 'A Wi-Fi network needs a name.',
  WifiPasswordTooShort: ({ min }) =>
    `A Wi-Fi password needs at least ${min} characters.`,
  InvalidChannel: ({ band: value, channel }) =>
    `There is no channel ${channel} in ${band(value)}.`,
  InvalidPort: ({ value }) =>
    `Port ${value} does not fit: use a number from 1 to 65535.`,
  EmptyName: () => 'The name cannot be empty.',

  WifiOff: ({ ap }, c) => `Wi-Fi on ${q(ap, c)} is off.`,
  NoWifiProfile: ({ device }, c) =>
    `${q(device, c)} does not know the password for this Wi-Fi yet.`,
  WrongSsid: ({ device, ssid, ap }, c) =>
    `${q(device, c)} looks for “${ssid}”, but ${q(ap, c)} offers another network.`,
  WrongPassword: ({ device, ssid }, c) =>
    `The password for “${ssid}” is wrong, so ${q(device, c)} cannot join.`,
  BandUnsupported: ({ device, band: value }, c) =>
    `${q(device, c)} cannot work on ${band(value)}.`,
  OutOfRange: ({ device, ap }, c) =>
    `${q(device, c)} is too far from ${q(ap, c)}: the signal does not reach it.`,

  FrameReceived: ({ device }, c) => `${q(device, c)} gets the envelope.`,
  FrameNotForMe: ({ device }, c) =>
    `${q(device, c)} sees the envelope is not for it and throws it away.`,
  FrameForwarded: ({ device }, c) =>
    `${q(device, c)} knows where the recipient is and passes the envelope only there.`,
  FrameFlooded: ({ device }, c) =>
    `${q(device, c)} does not know where the recipient is and sends the envelope every way.`,
  FrameBroadcast: ({ device }, c) =>
    `An envelope “for everyone”: ${q(device, c)} sends it every way.`,
  FrameFiltered: ({ device }, c) =>
    `${q(device, c)} keeps the envelope: the recipient is where it came from.`,
  PacketRouted: ({ device }, c) =>
    `${q(device, c)} passes the envelope on along the way.`,
  PacketIgnored: ({ device }, c) =>
    `${q(device, c)} stays quiet: the question is not for it.`,
  ArpIsMine: ({ device, ip }, c) =>
    `${q(device, c)}: “${ip} is me”, and it answers.`,
  ArpNotMine: ({ device, ip }, c) =>
    `${q(device, c)}: “${ip} is not my address”, and it stays quiet.`,
  DhcpServerOff: ({ router }, c) =>
    `${q(router, c)} does not hand out addresses: DHCP is off.`,

  NoLink: ({ device }, c) => `${q(device, c)} has neither a cable nor Wi-Fi.`,
  LinkDown: ({ device }, c) =>
    `${q(device, c)}'s link is off, so the envelope does not leave.`,
  NoAddress: ({ device }, c) =>
    `${q(device, c)} has no address, so the envelope does not leave.`,
  UsesStaticAddress: ({ device }, c) =>
    `${q(device, c)} has an address set by hand, no need to ask the router.`,
  NoGateway: ({ device, ip }, c) =>
    `${q(device, c)} does not know whom to send the envelope for ${ip} through: no router is set.`,
  NoDnsServer: ({ device }, c) =>
    `${q(device, c)} does not know whom to ask for an address by name: no DNS is set.`,
  ArpNoReply: ({ device, ip }, c) =>
    `Nobody answered for ${ip}, so ${q(device, c)} cannot send the envelope.`,
  NoDhcpServer: ({ device }, c) =>
    `Nobody gave ${q(device, c)} an address: there is no router with DHCP nearby.`,
  DhcpPoolExhausted: ({ router }, c) =>
    `${q(router, c)} has run out of free addresses.`,
  TtlExpired: ({ device }, c) =>
    `The envelope has been on the road too long, so ${q(device, c)} throws it away (TTL ran out).`,
  NoRouteToHost: ({ ip }) => `Nobody in the internet has the address ${ip}.`,
  PrivateAddressNotRoutable: ({ ip }) =>
    `${ip} is a home address: nobody can be found by it in the internet.`,
  NoWanLink: ({ router }, c) => `${q(router, c)} has no link to the internet.`,
  NatNoMapping: ({ router, proto, port }, c) =>
    `${q(router, c)} did not expect this envelope (${up(proto)} ${port}) and throws it away.`,
  PortClosed: ({ device, proto, port }, c) =>
    `Nothing listens on port ${port} (${up(proto)}) on ${q(device, c)}, so the connection is refused.`,
  ListensOnlyOnLoopback: ({ device, port }, c) =>
    `Port ${port} on ${q(device, c)} is open only to the device itself (127.0.0.1).`,
  NameNotFound: ({ name }) => `The DNS directory has no name ${name}.`,
  InvalidUrl: ({ url }) => `“${url}” is not a site address.`,
  FrameLost: ({ device }, c) => `The envelope got lost at ${q(device, c)}.`,

  GoalNotLinked: ({ a, b }, c) =>
    `${q(a, c)} and ${q(b, c)} are not connected yet.`,
  GoalWrongMedium: ({ a, b, want }, c) =>
    `${q(a, c)} and ${q(b, c)} should be connected ${how[want]}.`,
  GoalLinkDown: ({ a, b }, c) => `The link ${q(a, c)} — ${q(b, c)} is off.`,
  GoalNoRadioLink: ({ device, ap }, c) =>
    `There is no Wi-Fi link between ${q(device, c)} and ${q(ap, c)}.`,
  GoalWrongAddress: ({ device, have, want }, c) =>
    `${q(device, c)} has ${have}, but it should have ${want}.`,
  AddressConflict: ({ ip, devices }, c) =>
    `Several devices have the address ${ip}: ${all(devices, c)}.`,
  GoalReachable: ({ from, at }, c) =>
    `An envelope from ${q(from, c)} reaches ${q(at, c)}, and it should not.`,
  GoalNotListening: ({ device, proto, port }, c) =>
    `Nothing listens on port ${port} (${up(proto)}) on ${q(device, c)}.`,
  GoalListeningOnWrongAddress: ({ device, port, bind, want }, c) =>
    `Port ${port} on ${q(device, c)} listens on ${bind}, but it should listen on ${want}.`,
  GoalResolvesElsewhere: ({ name, have, want }) =>
    `The name ${name} leads to ${have}, but it should lead to ${want}.`,
}
