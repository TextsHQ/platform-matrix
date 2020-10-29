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

export function mapMessage(
  msg: any,
  senderID: string,
  isSender: boolean
): Message {
  return
}
