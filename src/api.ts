import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import sizeOf from 'image-size'
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
  ClientContext,
  ActivityType,
  ThreadFolderName,
} from '@textshq/platform-sdk'
import sdk from 'matrix-js-sdk'
import MatrixClient, { MatrixSession } from './matrix-client'
import { mapRoom, mapMessage, getContentTypeFromMimeType, getAttachmentTypeFromContentType } from './mappers'
import type { ContentInfo } from './types/matrix'

function createPromise<T>() {
  let promiseResolve: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>(resolve => { promiseResolve = resolve })
  return {
    resolve: promiseResolve,
    promise,
  }
}

export default class Matrix implements PlatformAPI {
  private readonly matrixClient = new MatrixClient()

  private session: MatrixSession

  private threads = {}

  private rooms = {}

  private accountInfo: ClientContext

  private prepared = createPromise<void>()

  get userID() {
    return this.session?.user_id
  }

  init = async (session: MatrixSession, accountInfo: ClientContext) => {
    this.accountInfo = accountInfo
    if (session?.access_token) {
      this.session = session
      return this.matrixClient.startFromSession(
        session,
        this.accountInfo.dataDirPath,
      )
    }
  }

  login = async (creds): Promise<LoginResult> => {
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

  logout = async () => {
    this.dispose()
    await fs.rm(this.accountInfo?.dataDirPath, { recursive: true })
  }

  dispose = () => {
    this.matrixClient.client?.stopClient()
  }

  getCurrentUser = (): CurrentUser => ({
    id: this.session.user_id,
    displayText: this.session.user_id,
  })

  mapEvents = async (type, payload): Promise<ServerEvent[]> => {
    switch (type) {
      case 'prepared': {
        for (const data of this.matrixClient.client.getVisibleRooms()) {
          const room = mapRoom(this.matrixClient, this.userID, data)
          this.threads[room.id] = room
          this.rooms[room.id] = data
        }
        this.prepared.resolve()
        break
      }

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
            type: ServerEventType.USER_ACTIVITY,
            activityType: payload.member.typing ? ActivityType.TYPING : ActivityType.NONE,
            threadID: payload.member.roomId,
            participantID: payload.member.userId,
            durationMs: 3000, // todo review
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

  getThreads = async (inboxName: ThreadFolderName): Promise<Paginated<Thread>> => {
    await this.prepared.promise

    return {
      items: Object.values(this.threads),
      hasMore: false,
      oldestCursor: null,
    }
  }

  getMessages = async (threadID: string, pagination: PaginationArg): Promise<Paginated<Message>> => {
    const room = this.rooms[threadID]
    const liveTimeline = room.getLiveTimeline()
    if (pagination?.direction === 'before') {
      await this.matrixClient.client.scrollback(room, 30)
    }
    const hasMore = !!liveTimeline.getState(sdk.EventTimeline.BACKWARDS).paginationToken
    const items = liveTimeline.getEvents()
      .map(event => mapMessage(this.matrixClient, this.userID, room, event))
      .filter(Boolean)
    return {
      items,
      hasMore,
    }
  }

  sendMessage = async (threadID: string, content: MessageContent, options: MessageSendOptions) => {
    let msgContent: any
    let attachmentBuffer: Buffer
    if (content.filePath) {
      attachmentBuffer = await fs.readFile(content.filePath)
    } else if (content.fileBuffer) {
      attachmentBuffer = content.fileBuffer
    }
    const pendingMsg: Message = {
      id: undefined,
      timestamp: new Date(),
      senderID: this.userID,
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
      pendingMsg.attachments = [{
        id: randomUUID(),
        type: getAttachmentTypeFromContentType(msgtype),
        data: attachmentBuffer,
      }]
    } else {
      msgContent = {
        msgtype: 'm.text',
        body: content.text,
      }
      pendingMsg.text = content.text
    }
    if (options.quotedMessageID) {
      msgContent['m.relates_to'] = {
        'm.in_reply_to': {
          event_id: options.quotedMessageID,
        },
      }
      pendingMsg.linkedMessageID = options.quotedMessageID
    }
    const { event_id } = await this.matrixClient.client.sendMessage(threadID, msgContent)
    pendingMsg.id = event_id
    return [pendingMsg]
  }

  addReaction = async (threadID: string, messageID: string, reactionKey: string) => {
    const msgContent = {
      'm.relates_to': {
        event_id: messageID,
        key: reactionKey,
        rel_type: 'm.annotation',
      },
    }
    await this.matrixClient.client.sendEvent(threadID, 'm.reaction', msgContent)
  }

  removeReaction = async (threadID: string, messageID: string, reactionKey: string) => {
    const room = this.rooms[threadID]
    if (!room) {
      return
    }
    const annotationRelations = room
      .getUnfilteredTimelineSet()
      .relations
      .getChildEventsForEvent(messageID, 'm.annotation', 'm.reaction')
    const reaction = annotationRelations
      .getRelations()
      .find(
        event =>
          event.getSender() === this.userID
          && event.getRelation().key === reactionKey,
      )
    if (!reaction) {
      return
    }
    await this.matrixClient.client.redactEvent(threadID, reaction.getId())
  }

  deleteMessage = async (threadID: string, messageID: string) => {
    await this.matrixClient.client.redactEvent(threadID, messageID)
  }

  sendReadReceipt = async (threadID: string, messageID: string) => {}

  sendActivityIndicator = async (type: ActivityType, threadID: string) => {
    const typing = type === ActivityType.TYPING
    this.matrixClient.client.sendTyping(threadID, typing, 3000)
  }
}
