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
import MatrixClient from './matrix-client'

export function mapRoom(matrixClient: MatrixClient, userID, room): Thread {
  let participantItems = []
  const messages = room.timeline
    .map(event => mapMessage(matrixClient, userID, room, event))
    .filter(Boolean)
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

const getAttachmentTypeFromContentType = type => {
  return (
    {
      'm.image': MessageAttachmentType.IMG,
      'm.audio': MessageAttachmentType.AUDIO,
      'm.video': MessageAttachmentType.VIDEO,
    }[type] || MessageAttachmentType.UNKNOWN
  )
}

export const getContentTypeFromMimeType = mimeType => {
  const mainType = mimeType.split('/')[0]
  return (
    {
      image: 'm.image',
      audio: 'm.audio',
      video: 'm.video',
    }[mainType] || 'm.file'
  )
}

/**
 * This function strips the original message body from quoting message body.
 * Input: '> <@id:matrix.org> a\n> \n> b\n> \n> c\n\nd\n\ne'
 * Output: 'd\n\ne'
 */
const stripQuotedMessage = body => {
  if (body.startsWith('\n')) {
    return body.slice(1)
  } else if (!body.startsWith('> ')) {
    return body
  }

  let linebreak = body.indexOf('\n')
  if (linebreak !== -1) {
    return stripQuotedMessage(body.slice(linebreak + 1))
  }
  return body
}

export function mapMessage(
  matrixClient: MatrixClient,
  userID,
  room,
  event
): Message {
  let text
  let action = null
  let attachments = []
  let reactions = []
  let isDeleted = false
  let linkedMessageID
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
        console.log('m.room.member', event)
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
      const annotationRelations = room
        .getUnfilteredTimelineSet()
        .getRelationsForEvent(event.getId(), 'm.annotation', 'm.reaction')
      if (annotationRelations) {
        reactions = annotationRelations.getRelations().map(event => {
          return {
            id: event.getId(),
            reactionKey: event.getRelation().key,
            participantID: event.getSender(),
            emoji: true,
          }
        })
      }
      if (event.isRedacted()) {
        const byEvent = room.findEventById(event.getUnsigned().redacted_by)
        if (!byEvent) {
          return
        }
        isDeleted = true
        text = `Message deleted by ${byEvent.getSender()}`
        break
      }
      const content = event.getContent()
      switch (content.msgtype) {
        case 'm.bad.encrypted':
        case 'm.text': {
          text = content.body
          if (
            content['m.relates_to'] &&
            content['m.relates_to']['m.in_reply_to']
          ) {
            text = stripQuotedMessage(content.body)
            linkedMessageID = content['m.relates_to']['m.in_reply_to'].event_id
          }

          break
        }
        case 'm.audio':
        case 'm.file':
        case 'm.image':
        case 'm.video': {
          const srcURL = matrixClient.mxcUrlToHttp(content.url)
          attachments = [
            {
              id: event.getId(),
              type: getAttachmentTypeFromContentType(content.msgtype),
              isGif: content.info.mimetype == 'image/gif',
              size: { width: content.info.w, height: content.info.h },
              srcURL,
              mimeType: content.info.mimeType,
              fileName: content.body,
              fileSize: content.info.size,
            },
          ]
          break
        }
        default: {
          console.log('m.room.message', event)
        }
      }
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
      action = {
        type,
        title: event.getContent().name,
        actorParticipantID: senderID,
      }
      break
    }
    case 'm.reaction': {
      // Handled by getRelationsForEvent in m.room.message.
      return
      const related = event.getContent()['m.relates_to']
      const origEvent = room.findEventById(related.event_id)
      if (!origEvent) {
        return
      }
      const message = mapMessage(matrixClient, userID, room, origEvent)
      message.reactions.push({
        id: event.getId(),
        reactionKey: related.key,
        participantID: senderID,
        emoji: true,
      })
      return message
    }
    case 'm.room.redaction': {
      // Handled by event.isRedacted in m.room.message
      return
    }
    default: {
      console.log('-- mapMessage', event)
      return
    }
  }

  return {
    _original: [],
    id: event.getId(),
    timestamp: event.getDate(),
    senderID,
    text,
    isSender: userID == senderID,
    attachments,
    isAction: !!action,
    action,
    isDeleted,
    reactions,
    linkedMessageID,
  }
}
