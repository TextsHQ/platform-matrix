import { mapTextAttributes } from '../text-attributes'

const cases = [
  {
    text: '\n*italic*\n **bold**\n\n plain <del>st</del>.',
    result: {
      text: 'italic\nbold\n\nplain st.',
      textAttributes: {
        entities: [
          {
            from: 0,
            to: 6,
            italic: true,
          },
          {
            from: 7,
            to: 11,
            bold: true,
          },
          {
            from: 19,
            to: 21,
            strikethrough: true,
          },
        ],
      },
    },
  },
  {
    text:
      '**[[tulir/mautrix-wsproxy](https://github.com/tulir/mautrix-wsproxy)]** [Yumekui](https://github.com/Yumekui) opened pull request #1',
    result: {
      text: '[tulir/mautrix-wsproxy] Yumekui opened pull request #1',
      textAttributes: {
        entities: [
          {
            from: 1,
            to: 22,
            link: 'https://github.com/tulir/mautrix-wsproxy',
          },
          {
            from: 0,
            to: 23,
            bold: true,
          },
          {
            from: 24,
            to: 31,
            link: 'https://github.com/Yumekui',
          },
        ],
      },
    },
  },
]

test('text attributes', () => {
  for (const c of cases) {
    expect(mapTextAttributes(c.text)).toEqual(c.result)
  }
})
