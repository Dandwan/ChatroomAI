import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import MarkdownMessage from '../MarkdownMessage'

describe('MarkdownMessage', () => {
  it('renders plain text content', () => {
    render(<MarkdownMessage text="Hello world" />)
    expect(document.body.textContent).toContain('Hello world')
  })

  it('renders markdown bold text', () => {
    render(<MarkdownMessage text="Hello **world**" />)
    const strong = document.querySelector('strong')
    expect(strong).toBeTruthy()
    expect(strong?.textContent).toBe('world')
  })

  it('renders markdown inline code', () => {
    render(<MarkdownMessage text="Use `const x = 1` here" />)
    const code = document.querySelector('code')
    expect(code).toBeTruthy()
    expect(code?.textContent).toBe('const x = 1')
  })

  it('renders markdown links', () => {
    render(<MarkdownMessage text="Visit [example](https://example.com)" />)
    const link = document.querySelector('a')
    expect(link).toBeTruthy()
    expect(link?.getAttribute('href')).toBe('https://example.com')
  })

  it('renders empty content gracefully', () => {
    expect(() => render(<MarkdownMessage text="" />)).not.toThrow()
  })

  it('renders multiline content', () => {
    render(<MarkdownMessage text={'Line 1\n\nLine 2'} />)
    expect(document.body.textContent).toContain('Line 1')
    expect(document.body.textContent).toContain('Line 2')
  })

  it('renders simple heading', () => {
    render(<MarkdownMessage text={'# Hello Title'} />)
    const heading = document.querySelector('h1')
    expect(heading).toBeTruthy()
    expect(heading?.textContent).toContain('Hello Title')
  })

  it('renders list items', () => {
    render(<MarkdownMessage text={'- First item\n- Second item'} />)
    const items = document.querySelectorAll('li')
    expect(items.length).toBeGreaterThanOrEqual(1)
  })

  it('renders code blocks', () => {
    render(<MarkdownMessage text={'```typescript\nconst x = 1;\n```'} />)
    const codeBlock = document.querySelector('pre code')
    expect(codeBlock).toBeTruthy()
  })
})
