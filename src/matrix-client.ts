// global.Olm needs to be loaded before matrix-js-sdk
import './patch-global-olm'
import sdk from 'matrix-js-sdk'
import { LocalStorageCryptoStore } from 'matrix-js-sdk/lib/crypto/store/localStorage-crypto-store'
import { MemoryStore } from 'matrix-js-sdk/lib/store/memory'
import { LocalStorage } from 'node-localstorage'
import type { LoginCreds } from '@textshq/platform-sdk'

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
  client: any

  onMessage: Function

  async login(creds: LoginCreds) {
    this.client = sdk.createClient({ baseUrl: creds['custom'] })
    try {
      const res = await this.client.login('m.login.password', { user: creds['username'], password: creds['password'] })
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
      if (state === 'PREPARED') {
        this.onPrepared()
      }
    })
  }

  onPrepared() {
    this.onMessage('prepared')

    this.client.on('Room', (event, room) => {
      this.onMessage('Room', room)
    })
    this.client.on('Room.timeline', (event, room, toStartOfTimeline) => {
      this.onMessage('Room.timeline', { room, event })
    })
    this.client.on(
      'Room.localEchoUpdated',
      (event, room, oldEventId, oldStatus) => {
        // oldEventId is sometimes a Room object.
        if (typeof oldEventId === 'string') {
          this.onMessage('Room.localEchoUpdated', { room, event, oldEventId, oldStatus })
        }
      },
    )
    this.client.on('RoomMember.typing', (event, member) => {
      this.onMessage('RoomMember.typing', { event, member })
    })
  }

  upload(file) {
    return this.client._http.uploadContent(file, {
      rawResponse: false,
      onlyContentUri: true,
    })
  }
}
