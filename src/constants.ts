import type { SupportedReaction } from '@textshq/platform-sdk'

export const supportedReactions: Record<string, SupportedReaction> = {
  '❤️': { title: 'Heart', render: '❤️' },
  '👍': { title: 'Like', render: '👍' },
  '👎': { title: 'Dislike', render: '👎' },
  '😂': { title: 'Laugh', render: '😂' },
  '😲': { title: 'Surprised', render: '😲' },
  '😢': { title: 'Cry', render: '😢' },
}
