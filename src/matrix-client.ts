// @ts-ignore
global.Olm = require('olm')
import sdk from 'matrix-js-sdk'
import { WebStorageSessionStore } from 'matrix-js-sdk/lib/store/session/webstorage'
import { LocalStorage } from 'node-localstorage'

import { LoginCreds } from '@textshq/platform-sdk'

const localStorage = new LocalStorage('./matrix-storage')

export type MatrixSession = {
  user_id: string
  access_token: string
  home_server: string
  device_id: string
  well_known: {
    'm.homeserver': {
      base_url: string
    }
  }
}

export default class MatrixClient {
  client
  onMessage: Function

  async login({ custom: server, username: user, password }: LoginCreds) {
    this.client = sdk.createClient({
      baseUrl: server,
      unstableClientRelationAggregation: true,
      sessionStore: new WebStorageSessionStore(window.localStorage),
    })
    try {
      const res = await this.client.login('m.login.password', {
        user,
        password,
      })
      return res
    } catch (e) {
      return e.data
    }
  }

  startFromSession(session: MatrixSession) {
    this.client = sdk.createClient({
      baseUrl: `https://${session.home_server}`,
      accessToken: session.access_token,
      userId: session.user_id,
      deviceId: session.device_id,
      unstableClientRelationAggregation: true,
      sessionStore: new WebStorageSessionStore(localStorage),
    })
    this.start()
  }

  async start() {
    await this.client.initCrypto()
    this.client.startClient()
    this.client.once('sync', (state, prevState, res) => {
      // state will be 'PREPARED' when the client is ready to use
      console.log('sync', state)
      if (state == 'PREPARED') {
        this.onPrepared()
      }
    })
  }

  onPrepared() {
    var rooms = this.client.getRooms()
    rooms.forEach(room => {
      this.onMessage('Room', room)
    })
    this.client.on('Room.timeline', (event, room, toStartOfTimeline) => {
      this.onMessage('Room.timeline', { room, event })
    })
    this.client.on(
      'Room.localEchoUpdated',
      (event, room, oldEventId, oldStatus) => {
        this.onMessage('Room.localEchoUpdated', { room, event, oldEventId })
      }
    )
    this.client.on('RoomMember.typing', (event, member) => {
      this.onMessage('RoomMember.typing', { event, member })
    })
  }

  sendEvent(...args) {
    this.client.sendEvent(...args)
  }

  sendMessage(...args) {
    this.client.sendMessage(...args)
  }

  sendTyping(roomId, typing) {
    this.client.sendTyping(roomId, typing, 3000)
  }

  mxcUrlToHttp(...args) {
    return this.client.mxcUrlToHttp(...args)
  }

  upload(file) {
    return this.client._http.uploadContent(file, {
      rawResponse: false,
      onlyContentUri: true,
    })
  }

  redactEvent(...args) {
    return this.client.redactEvent(...args)
  }
}
