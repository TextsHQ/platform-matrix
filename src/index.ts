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

export default class MatrixAPI implements PlatformAPI {
  currentUser = null

  init = async (session, accountInfo: AccountInfo) => {}

  getAuthUrl = async callback => {}

  login = async (creds): Promise<LoginResult> => {
    this.currentUser = creds.username
    return { type: 'success' }
  }

  logout = () => {}

  dispose = () => {}

  getCurrentUser = (): CurrentUser => ({
    id: this.currentUser,
    displayText: this.currentUser,
  })

  subscribeToEvents = (onEvent: OnServerEventCallback) => {}

  unsubscribeToEvents = () => {}

  serializeSession = () => {
    return this.currentUser
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
