import Path from 'path'
import { orderBy } from 'lodash'
import {
  Message,
  Thread,
  MessageReaction,
  MessageSeen,
  ServerEvent,
  Participant,
  MessageActionType,
  MessageAttachmentType,
  ServerEventType,
  MessageAttachment,
  ParticipantTypingEvent,
  StateSyncEvent,
  UNKNOWN_DATE,
} from '@textshq/platform-sdk'

export function mapRoom(userID, room): Thread {
  let participantItems = []
  const messages = room.timeline.map(e => mapMessage(userID, e)).filter(Boolean)
  return {
    id: room.roomId,
    title: room.name,
    isUnread: false,
    isReadOnly: false,
    type: 'group',
    timestamp: new Date(),
    messages: {
      items: messages,
      hasMore: false,
      oldestCursor: null,
    },
    participants: {
      items: participantItems,
      hasMore: false,
      oldestCursor: null,
    },
  }
}

export function mapMessage(userID, event): Message {
  let body
  if (event.getType() === 'm.room.message') {
    body = event.getContent().body
  } else {
    return null
  }

  const senderID = event.getSender()
  return {
    _original: [],
    id: event.getId(),
    timestamp: new Date(event.getTs()),
    senderID,
    text: body,
    isSender: userID == senderID,
    attachments: [],
    reactions: [],
  }
}
