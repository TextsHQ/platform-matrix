import { Attribute, MessageDeletionMode, PlatformInfo } from '@textshq/platform-sdk'

import { supportedReactions } from './constants'

const info: PlatformInfo = {
  name: 'matrix',
  version: '1.0.0',
  displayName: 'Matrix',
  icon: `<svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="16" height="16" rx="5" fill="black"/>
<path d="M5.4773 5.55539V6.23116H5.49615C5.67654 5.9727 5.89461 5.77347 6.14769 5.63347C6.40077 5.49078 6.69423 5.42078 7.02269 5.42078C7.33769 5.42078 7.62576 5.4827 7.88692 5.60385C8.14807 5.72501 8.34461 5.94308 8.48192 6.25001C8.62999 6.03193 8.83192 5.83808 9.08499 5.67116C9.33807 5.50424 9.63961 5.42078 9.98692 5.42078C10.2508 5.42078 10.4958 5.45308 10.7219 5.5177C10.9481 5.58231 11.1392 5.68462 11.3008 5.82731C11.4623 5.97001 11.5861 6.15308 11.6777 6.38193C11.7665 6.61078 11.8123 6.88539 11.8123 7.20847V10.5496H10.4419V7.72001C10.4419 7.55308 10.4365 7.39424 10.4231 7.24616C10.4096 7.09808 10.3746 6.96885 10.3181 6.86116C10.2588 6.75078 10.1754 6.66462 10.0623 6.60001C9.94922 6.53539 9.79576 6.50308 9.60461 6.50308C9.41076 6.50308 9.25461 6.54078 9.13615 6.61347C9.01769 6.68885 8.92346 6.78308 8.85615 6.90424C8.78884 7.0227 8.74307 7.15731 8.72153 7.31078C8.69999 7.46155 8.68653 7.61501 8.68653 7.76847V10.5496H7.31615V7.74962C7.31615 7.60155 7.31346 7.45616 7.30538 7.31078C7.3 7.16539 7.27038 7.03347 7.22192 6.90962C7.17346 6.78847 7.09269 6.68885 6.97961 6.61616C6.86653 6.54347 6.7023 6.50578 6.48153 6.50578C6.41692 6.50578 6.33077 6.51924 6.22577 6.54885C6.12077 6.57847 6.01577 6.63231 5.91615 6.71308C5.81654 6.79385 5.73038 6.90962 5.66038 7.06039C5.59038 7.21116 5.55538 7.41039 5.55538 7.65539V10.5523H4.185V5.55539H5.4773Z" fill="white"/>
</svg>`,
  loginMode: 'custom',
  reactions: {
    supported: supportedReactions,
    canReactWithAllEmojis: true,
  },
  deletionMode: MessageDeletionMode.DELETE_FOR_EVERYONE,
  typingDurationMs: 3000,
  attributes: new Set([Attribute.SUPPORTS_QUOTED_MESSAGES]),
}

export default info
