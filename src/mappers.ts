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
  let text
  let action = null
  const senderID = event.getSender()

  switch (event.getType()) {
    case 'm.room.encryption': {
      action = {
        type: MessageActionType.THREAD_TITLE_UPDATED,
        title: 'Encrypted',
        actorParticipantID: senderID,
      }
      text = 'Encryption enabled'
      break
    }
    case 'm.room.member': {
      let membership = event.getContent().membership
      let type
      if (membership == 'join') {
        type = MessageActionType.THREAD_PARTICIPANTS_ADDED
        text = `${senderID} joined the room`
      } else if (membership == 'leave') {
        type = MessageActionType.THREAD_PARTICIPANTS_REMOVED
        text = `${senderID} left the room`
      } else {
        console.log('-- m.room.member', event)
        return null
      }
      action = {
        type,
        title: event.getContent().membership,
        actorParticipantID: senderID,
      }
      break
    }
    case 'm.room.message': {
      text = event.getContent().body
      break
    }
    case 'm.room.name': {
      const prevContent = event.getPrevContent()
      let type
      if (prevContent.name) {
        type = MessageActionType.THREAD_TITLE_UPDATED
        text = `${senderID} changed the room name from ${prevContent.name} to ${
          event.getContent().name
        }`
      } else {
        type = MessageActionType.GROUP_THREAD_CREATED
        text = `${senderID} created and configured the room`
      }
      // console.log('m.room.name', event.getPrevContent())
      action = {
        type,
        title: event.getContent().name,
        actorParticipantID: senderID,
      }
      break
    }
    default: {
      console.log('-- mapMessage', event)
      return null
    }
  }

  return {
    _original: [],
    id: event.getId(),
    timestamp: event.getDate(),
    senderID,
    text,
    isSender: userID == senderID,
    attachments: [],
    isAction: !!action,
    action,
    reactions: [],
  }
}
