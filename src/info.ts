import { Attribute, MessageDeletionMode, Platform } from '@textshq/platform-sdk'

import { mapMessage } from './mappers'
import { AuthForm } from './AuthForm'

const info: Platform = {
  name: 'matrix',
  version: '1.0.0',
  displayName: 'Matrix',
  icon: `<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 520 520" style="enable-background:new 0 0 520 520;" xml:space="preserve">
<path d="M13.7,11.9v496.2h35.7V520H0V0h49.4v11.9H13.7z"/>
<path d="M166.3,169.2v25.1h0.7c6.7-9.6,14.8-17,24.2-22.2c9.4-5.3,20.3-7.9,32.5-7.9c11.7,0,22.4,2.3,32.1,6.8 c9.7,4.5,17,12.6,22.1,24c5.5-8.1,13-15.3,22.4-21.5c9.4-6.2,20.6-9.3,33.5-9.3c9.8,0,18.9,1.2,27.3,3.6c8.4,2.4,15.5,6.2,21.5,11.5 c6,5.3,10.6,12.1,14,20.6c3.3,8.5,5,18.7,5,30.7v124.1h-50.9V249.6c0-6.2-0.2-12.1-0.7-17.6c-0.5-5.5-1.8-10.3-3.9-14.3 c-2.2-4.1-5.3-7.3-9.5-9.7c-4.2-2.4-9.9-3.6-17-3.6c-7.2,0-13,1.4-17.4,4.1c-4.4,2.8-7.9,6.3-10.4,10.8c-2.5,4.4-4.2,9.4-5,15.1 c-0.8,5.6-1.3,11.3-1.3,17v103.3h-50.9v-104c0-5.5-0.1-10.9-0.4-16.3c-0.2-5.4-1.3-10.3-3.1-14.9c-1.8-4.5-4.8-8.2-9-10.9 c-4.2-2.7-10.3-4.1-18.5-4.1c-2.4,0-5.6,0.5-9.5,1.6c-3.9,1.1-7.8,3.1-11.5,6.1c-3.7,3-6.9,7.3-9.5,12.9c-2.6,5.6-3.9,13-3.9,22.1 v107.6h-50.9V169.2H166.3z"/>
<path d="M506.3,508.1V11.9h-35.7V0H520v520h-49.4v-11.9H506.3z"/>
</svg>`,
  loginMode: 'custom',
  auth: AuthForm,
  supportedReactions: {},
  deletionMode: MessageDeletionMode.NONE,
  typingDurationMs: 3000,
  attributes: new Set([]),
  mapMessage,
}

export default info
