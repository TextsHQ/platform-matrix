import { Message, Thread, MessageActionType, MessageAttachmentType, texts } from '@textshq/platform-sdk'
import MatrixClient from './matrix-client'

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

const getAttachmentTypeFromContentType = type => ({
  'm.image': MessageAttachmentType.IMG,
  'm.audio': MessageAttachmentType.AUDIO,
  'm.video': MessageAttachmentType.VIDEO,
}[type] || MessageAttachmentType.UNKNOWN)

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
  let text
  let action = null
  let attachments = []
  let reactions = []
  let isDeleted = false
  let linkedMessageID
  const senderID = event.getSender()

  const eventType = event.getType()
  texts.log(eventType, event)
  switch (eventType) {
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
      const { membership } = event.getContent()
      let type
      if (membership === 'join') {
        type = MessageActionType.THREAD_PARTICIPANTS_ADDED
        text = `${senderID} joined the room`
      } else if (membership === 'leave') {
        type = MessageActionType.THREAD_PARTICIPANTS_REMOVED
        text = `${senderID} left the room`
      } else {
        return null
      }
      action = {
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
        isDeleted = true
        text = `Message deleted by ${redactedBy}`
        break
      }
      const annotationRelations = room
        .getUnfilteredTimelineSet()
        .getRelationsForEvent(event.getId(), 'm.annotation', 'm.reaction')
      if (annotationRelations) {
        reactions = annotationRelations.getRelations().map(ev => ({
          id: ev.getId(),
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
          text = content.body
          if (
            content['m.relates_to']
            && content['m.relates_to']['m.in_reply_to']
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
          const srcURL = matrixClient.client.mxcUrlToHttp(content.url)
          attachments = [
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
          message.reactions.filter(x => x.id !== event.getAssociatedId())
          return message
        }
        if (redacted.getType() === 'm.room.message') {
          return mapMessage(matrixClient, userID, room, redacted)
        }
      }
      return
    }
  }

  return {
    _original: JSON.stringify(event),
    id: event.getId(),
    timestamp: event.getDate(),
    senderID,
    text,
    isSender: userID === senderID,
    attachments,
    isAction: !!action,
    action,
    isDeleted,
    reactions,
    linkedMessageID,
  }
}
