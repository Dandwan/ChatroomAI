import { memo, useMemo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

const REMARK_PLUGINS = [remarkGfm, remarkMath]
const REHYPE_PLUGINS = [rehypeKatex]

const MARKDOWN_COMPONENTS: Components = {
  img: ({ node, ...props }) => {
    void node
    return (
      <span className="markdown-media-scroll">
        <img {...props} />
      </span>
    )
  },
  table: ({ node, ...props }) => {
    void node
    return (
      <div className="markdown-table-scroll">
        <table {...props} />
      </div>
    )
  },
}

const normalizeLatexDelimiters = (text: string): string =>
  text
    .replace(/\\\[((?:.|\n)*?)\\\]/g, (_, captured: string) => `$$${captured}$$`)
    .replace(/\\\(((?:.|\n)*?)\\\)/g, (_, captured: string) => `$${captured}$`)

const MarkdownMessage = memo(({ text }: { text: string }) => {
  const normalizedText = useMemo(() => normalizeLatexDelimiters(text), [text])

  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={MARKDOWN_COMPONENTS}
    >
      {normalizedText}
    </ReactMarkdown>
  )
})

MarkdownMessage.displayName = 'MarkdownMessage'

export default MarkdownMessage
