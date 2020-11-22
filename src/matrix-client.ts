// @ts-ignore
global.Olm = require('olm')
import sdk from 'matrix-js-sdk'
import { LocalStorageCryptoStore } from 'matrix-js-sdk/lib/crypto/store/localStorage-crypto-store'
import { WebStorageSessionStore } from 'matrix-js-sdk/lib/store/session/webstorage'
import { MemoryStore } from 'matrix-js-sdk/lib/store/memory'
import { LocalStorage } from 'node-localstorage'

import { LoginCreds } from '@textshq/platform-sdk'

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

  async startFromSession(session: MatrixSession, dataDirPath: string) {
    const localStorage = new LocalStorage(dataDirPath)
    sdk.setCryptoStoreFactory(() => new LocalStorageCryptoStore(localStorage))

    this.client = sdk.createClient({
      baseUrl: `https://${session.home_server}`,
      accessToken: session.access_token,
      userId: session.user_id,
      deviceId: session.device_id,
      unstableClientRelationAggregation: true,
      sessionStore: new WebStorageSessionStore(localStorage),
      store: new MemoryStore({ localStorage }),
    })

    await this.client.initCrypto()
    // Support sending encrypted messages even if there are unverified members
    // in a room.
    this.client.setGlobalErrorOnUnknownDevices(false)

    this.client.startClient()
    this.client.once('sync', (state, prevState, res) => {
      // state will be 'PREPARED' when the client is ready to use
      console.log('sync', state)
      if (state == 'PREPARED') {
        this.onPrepared()
      }
    })
  }

  stopClient(...args) {
    this.client.stopClient(...args)
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
