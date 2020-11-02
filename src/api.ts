import { promises as fs } from 'fs'
import path from 'path'
import bluebird from 'bluebird'
import {
  PlatformAPI,
  OnServerEventCallback,
  Participant,
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
  texts,
  AccountInfo,
} from '@textshq/platform-sdk'
import MatrixClient, { MatrixSession } from './matrix-client'
import { mapRoom, mapMessage } from './mappers'

export default class Matrix implements PlatformAPI {
  matrixClient = new MatrixClient()
  session
  threads = {}

  init = async (session: MatrixSession, accountInfo: AccountInfo) => {
    if (session?.access_token) {
      this.session = session
      this.matrixClient.startFromSession(session)
    }
  }

  getAuthUrl = async callback => {}

  login = async (creds): Promise<LoginResult> => {
    console.log('-- login', creds)
    const res = await this.matrixClient.login(creds)
    if (res.access_token) {
      this.matrixClient.start()
      this.session = res
      return { type: 'success' }
    } else if (res.error) {
      return { type: 'error', errorMessage: res.error }
    }
  }

  logout = () => {}

  dispose = () => {}

  getCurrentUser = (): CurrentUser => ({
    id: this.session.user_id,
    displayText: this.session.user_id,
  })

  mapEvent = async (type, payload): Promise<ServerEvent> => {
    console.log('-- mapEvent', type, payload)
    switch (type) {
      case 'Room': {
        const data = mapRoom(payload)
        this.threads[data.id] = data
        return {
          type: ServerEventType.STATE_SYNC,
          objectID: [data.id],
          mutationType: 'created',
          objectName: 'thread',
          data,
        }
      }
      case 'Room.timeline': {
        const data = mapMessage(payload)
        if (!data) return
        return {
          type: ServerEventType.STATE_SYNC,
          objectID: [payload.getRoomId(), data.id],
          mutationType: 'created',
          objectName: 'message',
          data,
        }
      }
    }
  }

  subscribeToEvents = (onEvent: OnServerEventCallback) => {
    // this.onEvent = onEvent
    this.matrixClient.onMessage = async (type, data) => {
      const event = await this.mapEvent(type, data)
      if (event) {
        onEvent([event])
      }
    }
  }

  unsubscribeToEvents = () => {}

  serializeSession = () => {
    return this.session
  }

  searchUsers = async (typed: string) => []

  createThread = (userIDs: string[]) => null

  getThreads = async (inboxName: InboxName): Promise<Paginated<Thread>> => {
    return {
      items: Object.values(this.threads),
      hasMore: false,
      oldestCursor: null,
    }
  }

  getMessages = async (
    threadID: string,
    pagination: PaginationArg
  ): Promise<Paginated<Message>> => {
    return {
      items: [],
      hasMore: false,
    }
  }

  sendMessage = async (
    threadID: string,
    content: MessageContent,
    options: MessageSendOptions
  ) => {
    return true
  }

  sendFileFromFilePath = async (threadID: string, filePath: string) => true

  sendFileFromBuffer = async (
    threadID: string,
    fileBuffer: Buffer,
    mimeType: string
  ) => true

  addReaction = async (
    threadID: string,
    messageID: string,
    reactionName: string
  ) => {}

  removeReaction = async (
    threadID: string,
    messageID: string,
    reactionName: string
  ) => {}

  deleteMessage = async (threadID: string, messageID: string) => {
    return true
  }

  sendReadReceipt = async (threadID: string, messageID: string) => {}

  sendTypingIndicator = async (threadID: string, typing: boolean) => {}
}
