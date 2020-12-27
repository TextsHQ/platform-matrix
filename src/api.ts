import { promises as fs } from 'fs'
import sizeOf from 'image-size'
import rimraf from 'rimraf'
import {
  PlatformAPI,
  OnServerEventCallback,
  LoginResult,
  Paginated,
  Thread,
  Message,
  MessageContent,
  MessageSendOptions,
  CurrentUser,
  InboxName,
  ServerEventType,
  ServerEvent,
  PaginationArg,
  AccountInfo,
  ActivityType,
} from '@textshq/platform-sdk'
import MatrixClient, { MatrixSession } from './matrix-client'
import { mapRoom, mapMessage, getContentTypeFromMimeType } from './mappers'
import { ContentInfo } from './types/matrix'

export default class Matrix implements PlatformAPI {
  matrixClient = new MatrixClient()

  session

  threads = {}

  rooms = {}

  accountInfo: AccountInfo

  get userID() {
    return this.session?.user_id
  }

  init = async (session: MatrixSession, accountInfo: AccountInfo) => {
    this.accountInfo = accountInfo
    if (session?.access_token) {
      this.session = session
      return this.matrixClient.startFromSession(
        session,
        this.accountInfo.dataDirPath,
      )
    }
  }

  getAuthUrl = async callback => {}

  login = async (creds): Promise<LoginResult> => {
    console.log('-- login', creds)
    const res = await this.matrixClient.login(creds)
    if (res.access_token) {
      await this.matrixClient.startFromSession(
        res,
        this.accountInfo.dataDirPath,
      )
      this.session = res
      return { type: 'success' }
    }
    if (res.error) {
      return { type: 'error', errorMessage: res.error }
    }
  }

  // @ts-ignore
  logout = (accountInfo: AccountInfo) =>
    new Promise<void>(resolve => {
      this.dispose()
      rimraf(accountInfo.dataDirPath, () => {
        resolve()
      })
    })

  dispose = () => {
    this.matrixClient.stopClient()
  }

  getCurrentUser = (): CurrentUser => ({
    id: this.session.user_id,
    displayText: this.session.user_id,
  })

  mapEvents = async (type, payload): Promise<ServerEvent[]> => {
    console.log('-- mapEvent', type, payload)
    switch (type) {
      case 'Room': {
        const room = mapRoom(this.matrixClient, this.userID, payload)
        this.threads[room.id] = room
        this.rooms[room.id] = payload
        return [
          {
            type: ServerEventType.STATE_SYNC,
            objectIDs: {},
            mutationType: 'upsert',
            objectName: 'thread',
            entries: [room],
          },
        ]
      }
      case 'Room.timeline': {
        if (payload.event.getType() === 'm.room.redaction') {
          return [
            {
              type: ServerEventType.THREAD_MESSAGES_REFRESH,
              threadID: payload.room.roomId,
            },
          ]
        }
        const message = mapMessage(
          this.matrixClient,
          this.userID,
          payload.room,
          payload.event,
          true,
        )
        if (!message) return
        return [
          {
            type: ServerEventType.STATE_SYNC,
            objectIDs: {
              threadID: payload.room.roomId,
              messageID: message.id,
            },
            mutationType: 'upsert',
            objectName: 'message',
            entries: [message],
          },
        ]
      }
      case 'Room.localEchoUpdated': {
        if (payload.event.getType() === 'm.room.redaction') {
          return [
            {
              type: ServerEventType.THREAD_MESSAGES_REFRESH,
              threadID: payload.room.roomId,
            },
          ]
        }
        const data = mapMessage(
          this.matrixClient,
          this.userID,
          payload.room,
          payload.event,
          true,
        )
        if (!data) return
        return [
          {
            type: ServerEventType.STATE_SYNC,
            objectIDs: {
              threadID: payload.room.roomId,
            },
            mutationType: 'delete',
            objectName: 'message',
            entries: [payload.oldEventId],
          },
          {
            type: ServerEventType.STATE_SYNC,
            objectIDs: {
              threadID: payload.room.roomId,
            },
            mutationType: 'upsert',
            objectName: 'message',
            entries: [data],
          },
        ]
      }
      case 'RoomMember.typing': {
        if (payload.member.userId === this.userID) {
          return
        }
        return [
          {
            type: ServerEventType.PARTICIPANT_TYPING,
            typing: payload.member.typing,
            threadID: payload.member.roomId,
            participantID: payload.member.userId,
            durationMs: 3000,
          },
        ]
      }
    }
  }

  subscribeToEvents = (onEvent: OnServerEventCallback) => {
    this.matrixClient.onMessage = async (type, data) => {
      const events = await this.mapEvents(type, data)
      if (events) {
        onEvent(events)
      }
    }
  }

  serializeSession = () => this.session

  searchUsers = async (typed: string) => []

  createThread = (userIDs: string[]) => null

  getThreads = async (inboxName: InboxName): Promise<Paginated<Thread>> => ({
    items: Object.values(this.threads),
    hasMore: false,
    oldestCursor: null,
  })

  getMessages = async (
    threadID: string,
    pagination: PaginationArg,
  ): Promise<Paginated<Message>> => {
    let items = []
    const room = this.rooms[threadID]
    if (room) {
      items = room.timeline
        .map(event => mapMessage(this.matrixClient, this.userID, room, event))
        .filter(Boolean)
    }
    return {
      items,
      hasMore: false,
    }
  }

  sendMessage = async (
    threadID: string,
    content: MessageContent,
    options: MessageSendOptions,
  ) => {
    let msgContent
    let attachmentBuffer
    if (content.filePath) {
      attachmentBuffer = await fs.readFile(content.filePath)
    } else if (content.fileBuffer) {
      attachmentBuffer = content.fileBuffer
    }
    if (attachmentBuffer) {
      const url = await this.matrixClient.upload(attachmentBuffer)
      const msgtype = getContentTypeFromMimeType(content.mimeType)
      const info: ContentInfo = {
        mimetype: content.mimeType,
        size: attachmentBuffer.byteLength,
      }
      if (msgtype === 'm.image') {
        const dimension = sizeOf(attachmentBuffer)
        if (dimension) {
          // height/width are required to preview in Element.
          info.h = dimension.height
          info.w = dimension.width
        }
      }
      msgContent = {
        msgtype,
        url,
        info,
        body: content.text || content.fileName,
      }
    } else {
      msgContent = {
        msgtype: 'm.text',
        body: content.text,
      }
    }
    if (options.quotedMessageID) {
      msgContent['m.relates_to'] = {
        'm.in_reply_to': {
          event_id: options.quotedMessageID,
        },
      }
    }
    await this.matrixClient.sendMessage(threadID, msgContent)
    return true
  }

  sendFileFromFilePath = async (threadID: string, filePath: string) => true

  sendFileFromBuffer = async (
    threadID: string,
    fileBuffer: Buffer,
    mimeType: string,
  ) => true

  addReaction = async (
    threadID: string,
    messageID: string,
    reactionName: string,
  ) => {
    const msgContent = {
      'm.relates_to': {
        event_id: messageID,
        key: reactionName,
        rel_type: 'm.annotation',
      },
    }
    await this.matrixClient.sendEvent(threadID, 'm.reaction', msgContent)
  }

  removeReaction = async (
    threadID: string,
    messageID: string,
    reactionName: string,
  ) => {
    const room = this.rooms[threadID]
    if (!room) {
      return
    }
    const annotationRelations = room
      .getUnfilteredTimelineSet()
      .getRelationsForEvent(messageID, 'm.annotation', 'm.reaction')
    const reaction = annotationRelations
      .getRelations()
      .find(
        event =>
          event.getSender() === this.userID
          && event.getRelation().key === reactionName,
      )
    if (!reaction) {
      return
    }
    await this.matrixClient.redactEvent(threadID, reaction.getId())
  }

  deleteMessage = async (threadID: string, messageID: string) => {
    await this.matrixClient.redactEvent(threadID, messageID)
    return true
  }

  sendReadReceipt = async (threadID: string, messageID: string) => {}

  sendActivityIndicator = async (type: ActivityType, threadID: string) => {
    const typing = type === ActivityType.TYPING
    this.matrixClient.sendTyping(threadID, typing)
  }
}
