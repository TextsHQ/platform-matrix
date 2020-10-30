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
import MatrixAPI, { MatrixSession } from './api'

export default class Matrix implements PlatformAPI {
  api = new MatrixAPI()
  session

  init = async (session: MatrixSession, accountInfo: AccountInfo) => {
    if (session?.access_token) {
      this.session = session
      this.api.startFromSession(session)
    }
  }

  getAuthUrl = async callback => {}

  login = async (creds): Promise<LoginResult> => {
    console.log('-- login', creds)
    const res = await this.api.login(creds)
    if (res.access_token) {
      this.api.start()
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

  subscribeToEvents = (onEvent: OnServerEventCallback) => {}

  unsubscribeToEvents = () => {}

  serializeSession = () => {
    return this.session
  }

  searchUsers = async (typed: string) => []

  createThread = (userIDs: string[]) => null

  getThreads = async (inboxName: InboxName): Promise<Paginated<Thread>> => {
    return {
      items: [],
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
