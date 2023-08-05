import { Message, Thread, MessageActionType, AttachmentType, texts } from '@textshq/platform-sdk'
import { mapTextAttributes } from './text-attributes'
import type MatrixClient from './matrix-client'

const stripAtMark = (name) => name.startsWith('@') ? name.slice(1) : name

const AVATAR_WIDTH = 64
const AVATAR_HEIGHT = 64

export function mapRoom(matrixClient: MatrixClient, userID, room): Thread {
  const baseUrl = matrixClient.client.getHomeserverUrl()
  const participantItems = room.currentState.getMembers().slice(0, 512).map(member => ({
    id: member.userId,
    username: stripAtMark(member.name),
    imgURL: member.getAvatarUrl(baseUrl, AVATAR_WIDTH, AVATAR_HEIGHT, 'crop')
  }))
  const messages = room.timeline
    .map(event => mapMessage(matrixClient, userID, room, event))
    .filter(Boolean)
  const imgURL = room.getAvatarUrl(baseUrl, AVATAR_WIDTH, AVATAR_HEIGHT, 'crop')
  return {
    id: room.roomId,
    title: room.name,
    isUnread: false,
    isReadOnly: false,
    type: 'group',
    timestamp: messages.slice(-1)[0]?.timestamp || new Date(),
    imgURL,
    messages: {
      items: messages,
      hasMore: true,
      oldestCursor: null,
    },
    participants: {
      items: participantItems,
      hasMore: false,
      oldestCursor: null,
    },
  }
}

export const getAttachmentTypeFromContentType = type => ({
  'm.image': AttachmentType.IMG,
  'm.audio': AttachmentType.AUDIO,
  'm.video': AttachmentType.VIDEO,
}[type] || AttachmentType.UNKNOWN)

export const getContentTypeFromMimeType = (mimeType: string) => {
  const mainType = mimeType.split('/')[0]
  return {
    image: 'm.image',
    audio: 'm.audio',
    video: 'm.video',
  }[mainType] || 'm.file'
}

/**
 * This function strips the original message body from quoting message body.
 * Input: '> <@id:matrix.org> a\n> \n> b\n> \n> c\n\nd\n\ne'
 * Output: 'd\n\ne'
 */
const stripQuotedMessage = body => {
  if (body.startsWith('\n')) {
    return body.slice(1)
  }
  if (!body.startsWith('> ')) {
    return body
  }

  const linebreak = body.indexOf('\n')
  if (linebreak !== -1) {
    return stripQuotedMessage(body.slice(linebreak + 1))
  }
  return body
}

export function mapMessage(
  matrixClient: MatrixClient,
  userID,
  room,
  event,
  fresh = false,
): Message {
  const senderID = event.getSender()
  const mapped: Message = {
    _original: JSON.stringify(event),
    id: event.getId(),
    timestamp: event.getDate(),
    senderID,
    text: '',
    isSender: userID === senderID,
  }

  const eventType = event.getType()
  texts.log(eventType, event)
  switch (eventType) {
    case 'm.room.encryption': {
      mapped.action = {
        type: MessageActionType.THREAD_TITLE_UPDATED,
        title: 'Encrypted',
        actorParticipantID: senderID,
      }
      mapped.text = 'Encryption enabled'
      break
    }
    case 'm.room.member': {
      const { membership } = event.getContent()
      let type
      if (membership === 'join') {
        type = MessageActionType.THREAD_PARTICIPANTS_ADDED
        mapped.text = `${senderID} joined the room`
      } else if (membership === 'leave') {
        type = MessageActionType.THREAD_PARTICIPANTS_REMOVED
        mapped.text = `${senderID} left the room`
      } else {
        return null
      }
      mapped.action = {
        type,
        title: event.getContent().membership,
        actorParticipantID: senderID,
      }
      break
    }
    case 'm.room.encrypted':
    case 'm.room.message': {
      if (event.isRedacted()) {
        const redactedBy = event.getUnsigned().redacted_because.sender
        if (!redactedBy) {
          return
        }
        mapped.isDeleted = true
        mapped.text = `Message deleted by ${redactedBy}`
        break
      }
      const annotationRelations = room
        .getUnfilteredTimelineSet()
        .relations
        .getChildEventsForEvent(event.getId(), 'm.annotation', 'm.reaction')
      if (annotationRelations) {
        mapped.reactions = annotationRelations.getRelations().map(ev => ({
          id: ev.getSender(),
          reactionKey: ev.getRelation().key,
          participantID: ev.getSender(),
          emoji: true,
        }))
      }
      const content = event.getContent()
      switch (content.msgtype) {
        case 'm.bad.encrypted':
        case 'm.notice':
        case 'm.text': {
          mapped.text = content.body
          if (
            content['m.relates_to']
            && content['m.relates_to']['m.in_reply_to']
          ) {
            mapped.text = stripQuotedMessage(content.body)
            mapped.linkedMessageID = content['m.relates_to']['m.in_reply_to'].event_id
          }

          if (content.format === 'org.matrix.custom.html') {
            const { text, textAttributes } = mapTextAttributes(mapped.text)
            mapped.text = text
            mapped.textAttributes = textAttributes
          }
          break
        }
        case 'm.audio':
        case 'm.file':
        case 'm.image':
        case 'm.video': {
          const srcURL = matrixClient.client.mxcUrlToHttp(content.url)
          mapped.attachments = [
            {
              id: event.getId(),
              type: getAttachmentTypeFromContentType(content.msgtype),
              isGif: content.info.mimetype === 'image/gif',
              size: { width: content.info.w, height: content.info.h },
              srcURL,
              mimeType: content.info.mimeType,
              fileName: content.body,
              fileSize: content.info.size,
            },
          ]
          break
        }
      }
      break
    }
    case 'm.room.name': {
      const prevContent = event.getPrevContent()
      let type
      if (prevContent.name) {
        type = MessageActionType.THREAD_TITLE_UPDATED
        mapped.text = `${senderID} changed the room name from ${prevContent.name} to ${
          event.getContent().name
        }`
      } else {
        type = MessageActionType.GROUP_THREAD_CREATED
        mapped.text = `${senderID} created and configured the room`
      }
      mapped.action = {
        type,
        title: event.getContent().name,
        actorParticipantID: senderID,
      }
      break
    }
    case 'm.reaction': {
      if (!fresh) {
        // Handled by getRelationsForEvent in m.room.message.
        return
      }
      const related = event.getRelation()
      if (!related) {
        return
      }
      const origEvent = room.findEventById(related.event_id)
      if (!origEvent) {
        return
      }
      const message = mapMessage(matrixClient, userID, room, origEvent)
      return message
    }
    case 'm.room.redaction': {
      if (!fresh) {
        // Handled by event.isRedacted in m.room.message
        return
      }
      const redacted = room.findEventById(event.getAssociatedId())
      if (redacted) {
        if (redacted.getType() === 'm.reaction') {
          const related = redacted.getContent()['m.relates_to']
          if (!related) {
            return
          }
          const origEvent = room.findEventById(related.event_id)
          if (!origEvent) {
            return
          }
          const message = mapMessage(matrixClient, userID, room, origEvent)
          // todo review this is unused:
          // message.reactions.filter(x => x.id !== event.getAssociatedId())
          return message
        }
        if (redacted.getType() === 'm.room.message') {
          return mapMessage(matrixClient, userID, room, redacted)
        }
      }
      return
    }
    case 'org.matrix.msc3381.poll.start':
    case 'org.matrix.msc3381.poll.response': {
      mapped.isHidden = true
    }
  }

  mapped.isAction = !!mapped.action
  return mapped
}
