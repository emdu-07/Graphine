import { SaxesParser } from 'saxes'
import type { XmlElement } from './types.ts'

/** Syntax only. No DOM, networking, DTD processing, or Alight semantics. */
export function readXml(xml: string): XmlElement {
  if (xml.length > 20_000_000) throw new Error('XML exceeds the 20 million character limit')
  const parser = new SaxesParser({ xmlns: false })
  const stack: { node: XmlElement; counts: Map<string, number> }[] = []
  let root: XmlElement | undefined
  let count = 0
  let opening = { line: 1, column: 1 }
  parser.on('error', error => { throw error })
  parser.on('doctype', () => { throw new Error('DTD declarations are unsupported') })
  parser.on('opentagstart', () => { opening = { line: parser.line, column: parser.column } })
  parser.on('opentag', tag => {
    if (++count > 250_000 || stack.length >= 128) throw new Error('XML node/depth limit exceeded')
    const parent = stack.at(-1)
    const index = (parent?.counts.get(tag.name) ?? 0) + 1
    parent?.counts.set(tag.name, index)
    const attributes = { ...tag.attributes } as Record<string, string>
    const node: XmlElement = {
      source: {
        element: tag.name,
        path: `${parent?.node.source.path ?? ''}/${tag.name}[${index}]`,
        id: attributes.id,
        propertyName: attributes.name ?? parent?.node.source.propertyName,
        effectId: tag.name === 'effect' ? attributes.id : parent?.node.source.effectId,
        ...opening,
      },
      attributes, children: [], text: '',
    }
    if (parent) parent.node.children.push(node)
    else root = node
    stack.push({ node, counts: new Map() })
  })
  parser.on('closetag', () => { stack.pop() })
  const text = (value: string) => { const current = stack.at(-1); if (current) current.node.text += value }
  parser.on('text', text)
  parser.on('cdata', text)
  parser.write(xml).close()
  if (!root) throw new Error('XML has no root element')
  return root
}
