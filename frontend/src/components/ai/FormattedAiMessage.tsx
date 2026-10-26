import { memo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface FormattedAiMessageProps {
  content: string
}

function renderInlineText(text: string): ReactNode[] {
  // Regex to split text into tokens: bold (**text**), italic (*text*), code (`code`), markdown link ([title](url))
  const parts: ReactNode[] = []
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]

    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index} className="kk-ai-strong">{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={match.index} className="kk-ai-em">{token.slice(1, -1)}</em>)
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(<code key={match.index} className="kk-ai-code">{token.slice(1, -1)}</code>)
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const splitIdx = token.indexOf('](')
      const label = token.slice(1, splitIdx)
      const url = token.slice(splitIdx + 2, -1)

      if (url.startsWith('/')) {
        parts.push(
          <Link key={match.index} to={url} className="kk-ai-link">
            {label}
          </Link>
        )
      } else {
        parts.push(
          <a
            key={match.index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="kk-ai-link"
          >
            {label}
          </a>
        )
      }
    }

    lastIndex = tokenRegex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

export const FormattedAiMessage = memo(function FormattedAiMessage({ content }: FormattedAiMessageProps) {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []

  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null

  function flushList() {
    if (!currentList) return
    if (currentList.type === 'ul') {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="kk-ai-ul">
          {currentList.items.map((item, idx) => (
            <li key={idx} className="kk-ai-li">
              {renderInlineText(item)}
            </li>
          ))}
        </ul>
      )
    } else {
      blocks.push(
        <ol key={`ol-${blocks.length}`} className="kk-ai-ol">
          {currentList.items.map((item, idx) => (
            <li key={idx} className="kk-ai-li">
              {renderInlineText(item)}
            </li>
          ))}
        </ol>
      )
    }
    currentList = null
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    if (!trimmed) {
      flushList()
      continue
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList()
      blocks.push(
        <h4 key={`h4-${i}`} className="kk-ai-h4">
          {renderInlineText(trimmed.slice(4))}
        </h4>
      )
      continue
    }

    if (trimmed.startsWith('## ')) {
      flushList()
      blocks.push(
        <h3 key={`h3-${i}`} className="kk-ai-h3">
          {renderInlineText(trimmed.slice(3))}
        </h3>
      )
      continue
    }

    if (trimmed.startsWith('# ')) {
      flushList()
      blocks.push(
        <h2 key={`h2-${i}`} className="kk-ai-h2">
          {renderInlineText(trimmed.slice(2))}
        </h2>
      )
      continue
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      flushList()
      blocks.push(
        <blockquote key={`quote-${i}`} className="kk-ai-blockquote">
          {renderInlineText(trimmed.slice(2))}
        </blockquote>
      )
      continue
    }

    // Unordered list
    const ulMatch = trimmed.match(/^([•\-\*])\s+(.*)$/)
    if (ulMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushList()
        currentList = { type: 'ul', items: [] }
      }
      currentList.items.push(ulMatch[2])
      continue
    }

    // Ordered list
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)
    if (olMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList()
        currentList = { type: 'ol', items: [] }
      }
      currentList.items.push(olMatch[2])
      continue
    }

    // Regular paragraph
    flushList()
    blocks.push(
      <p key={`p-${i}`} className="kk-ai-p">
        {renderInlineText(trimmed)}
      </p>
    )
  }

  flushList()

  return <div className="kk-ai-formatted">{blocks}</div>
})
