// Adapted from matrix-react-sdk/src/TextForEvent.tsx

import {
  MatrixClient,
  MatrixEvent,
  GuestAccess,
  HistoryVisibility,
  JoinRule,
} from 'matrix-js-sdk'

function textualPowerLevel(level: number, usersDefault: number): string {
  const LEVEL_ROLE_MAP = {
    undefined: 'Default',
    0: 'Restricted',
    [usersDefault]: 'Default',
    50: 'Moderator',
    100: 'Admin',
  }
  if (LEVEL_ROLE_MAP[level]) {
    return LEVEL_ROLE_MAP[level]
  }
  return `Custom ${level}`
}

export function getSenderName(event: MatrixEvent): string {
  const sender = event.sender?.name ?? event.getSender()
  return sender ? `{{${sender}}}` : 'Someone'
}

function getRoomMemberDisplayname(
  client: MatrixClient,
  event: MatrixEvent,
  userId = event.getSender(),
): string {
  const roomId = event.getRoomId()
  const member = client.getRoom(roomId)?.getMember(userId!)
  return member?.name || member?.rawDisplayName || userId || 'Someone'
}

export function textForGuestAccessEvent(ev: MatrixEvent): string {
  const senderDisplayName = getSenderName(ev)
  switch (ev.getContent().guest_access) {
    case GuestAccess.CanJoin:
      return `${senderDisplayName} has allowed guests to join the room.`
    case GuestAccess.Forbidden:
      return `${senderDisplayName} has prevented guests from joining the room.`
    default:
      // There`s no other options we can expect, however just for safety`s sake we`ll do this.
      return `${senderDisplayName} changed guest access to ${
        ev.getContent().guest_access
      }`
  }
}

export function textForHistoryVisibilityEvent(event: MatrixEvent): string {
  const senderName = getSenderName(event)
  switch (event.getContent().history_visibility) {
    case HistoryVisibility.Invited:
      return `${senderName} made future room history visible to all room members, from the point they are invited.`
    case HistoryVisibility.Joined:
      return `${senderName} made future room history visible to all room members, from the point they joined.`
    case HistoryVisibility.Shared:
      return `${senderName} made future room history visible to all room members.`
    case HistoryVisibility.WorldReadable:
      return `${senderName} made future room history visible to anyone.`
    default:
      return `${senderName} made future room history visible to unknown ${
        event.getContent().history_visibility
      }.`
  }
}

export function textForJoinRulesEvent(
  ev: MatrixEvent,
): string {
  const senderDisplayName = getSenderName(ev)
  switch (ev.getContent().join_rule) {
    case JoinRule.Public:
      return `${senderDisplayName} made the room public to whoever knows the link.`
    case JoinRule.Invite:
      return `${senderDisplayName} made the room invite only.`
    case JoinRule.Knock:
      return `${senderDisplayName} changed the join rule to ask to join.`
    case JoinRule.Restricted:
      return `${senderDisplayName} changed who can join this room.`
    default:
      // The spec supports "knock" and "private", however nothing implements these.
      return `${senderDisplayName} changed the join rule to ${
        ev.getContent().join_rule
      }`
  }
}

export function textForPowerEvent(
  event: MatrixEvent,
  client: MatrixClient,
): string {
  const senderName = getSenderName(event)
  if (!event.getPrevContent()?.users || !event.getContent()?.users) {
    return null
  }
  const previousUserDefault: number = event.getPrevContent().users_default || 0
  const currentUserDefault: number = event.getContent().users_default || 0
  // Construct set of userIds
  const users: string[] = []
  Object.keys(event.getContent().users).forEach(userId => {
    if (users.indexOf(userId) === -1) users.push(userId)
  })
  Object.keys(event.getPrevContent().users).forEach(userId => {
    if (users.indexOf(userId) === -1) users.push(userId)
  })

  const diffs: {
    userId: string
    name: string
    from: number
    to: number
  }[] = []
  users.forEach(userId => {
    // Previous power level
    let from: number = event.getPrevContent().users[userId]
    if (!Number.isInteger(from)) {
      from = previousUserDefault
    }
    // Current power level
    let to = event.getContent().users[userId]
    if (!Number.isInteger(to)) {
      to = currentUserDefault
    }
    if (from === previousUserDefault && to === currentUserDefault) {
      return
    }
    if (to !== from) {
      const name = getRoomMemberDisplayname(client, event, userId)
      diffs.push({ userId, name, from, to })
    }
  })
  if (!diffs.length) {
    return null
  }

  const powerLevelDiffText = diffs
    .map(
      diff =>
        `${diff.name} from ${textualPowerLevel(
          diff.from,
          previousUserDefault,
        )} to ${textualPowerLevel(diff.to, currentUserDefault)}`,
    )
    .join(', ')
  return `${senderName} changed the power level of ${powerLevelDiffText}.`
}
