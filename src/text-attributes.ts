import { TextEntity } from '@textshq/platform-sdk'
import { Parser } from 'commonmark'

const reader = new Parser({ safe: true })

// All types: text, softbreak, linebreak, emph, strong, html_inline, link,
// image, code, document, paragraph, block_quote, item, list, heading,
// code_block, html_block, thematic_break
const TOKEN_TYPES = ['emph', 'strong', 'link', 'code']

export function mapTextAttributes(src: string) {
  if (!src) return
  const parsed = reader.parse(src)
  const walker = parsed.walker()

  let output = ''
  const entities: TextEntity[] = []

  let tokenStack = []
  let event
  while ((event = walker.next())) {
    const { node } = event
    if (event.entering) {
      if (TOKEN_TYPES.includes(node.type)) {
        tokenStack.push({
          type: node.type,
          from: output.length,
        })
      } else if (node.type === 'html_inline') {
        if (node.literal.toLowerCase() === '<del>') {
          tokenStack.push({
            type: 'del',
            from: output.length,
          })
        } else if (node.literal.toLowerCase() === '</del>') {
          const lastToken = tokenStack.pop()
          if (!lastToken) continue
          if (lastToken.type !== 'del') {
            tokenStack.push(lastToken)
            continue
          }
          entities.push({
            from: lastToken.from,
            to: output.length,
            strikethrough: true,
          })
        }
      } else if (['softbreak', 'linkebreak'].includes(node.type)) {
        output += '\n'
      } else if (node.type === 'text') {
        output += node.literal
      }
    } else {
      if (node.type === 'paragraph') {
        output += '\n\n'
        continue
      }
      const lastToken = tokenStack.pop()
      if (!lastToken) continue
      const entity: TextEntity = {
        from: lastToken.from,
        to: output.length,
      }
      switch (lastToken.type) {
        case 'emph':
          entity.italic = true
          break
        case 'strong':
          entity.bold = true
          break
        case 'link':
          entity.link = node.destination
          break
      }
      entities.push(entity)
    }
  }
  return {
    text: output.trim(),
    textAttributes: entities.length ? { entities } : undefined,
  }
}
