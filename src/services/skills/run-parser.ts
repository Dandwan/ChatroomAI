export interface ParsedRunSimpleCommand {
  env: Record<string, string>
  argv: string[]
}

const SHELL_OPERATOR_CHARACTERS = new Set(['|', '&', ';', '<', '>', '(', ')', '$'])
const ENV_ASSIGNMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*=.*/

const isWhitespace = (value: string): boolean => /\s/.test(value)

export const parseRunSimpleCommand = (command: string): ParsedRunSimpleCommand => {
  const trimmed = command.trim()
  if (!trimmed) {
    return {
      env: {},
      argv: [],
    }
  }

  const argv: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null

  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index]

    if (quote) {
      if (character === quote) {
        quote = null
        continue
      }
      if (character === '\\' && quote === '"' && index + 1 < trimmed.length) {
        current += trimmed[index + 1]
        index += 1
        continue
      }
      current += character
      continue
    }

    if (character === '"' || character === "'") {
      quote = character
      continue
    }

    if (character === '\\' && index + 1 < trimmed.length) {
      current += trimmed[index + 1]
      index += 1
      continue
    }

    if (SHELL_OPERATOR_CHARACTERS.has(character)) {
      throw new Error(`当前 run 暂不支持该 shell 操作符：${character}`)
    }

    if (isWhitespace(character)) {
      if (current) {
        argv.push(current)
        current = ''
      }
      continue
    }

    current += character
  }

  if (quote) {
    throw new Error('命令中的引号未闭合')
  }

  if (current) {
    argv.push(current)
  }

  const env: Record<string, string> = {}
  let cursor = 0
  while (cursor < argv.length) {
    const currentToken = argv[cursor]
    if (!ENV_ASSIGNMENT_PATTERN.test(currentToken)) {
      break
    }
    const separatorIndex = currentToken.indexOf('=')
    env[currentToken.slice(0, separatorIndex)] = currentToken.slice(separatorIndex + 1)
    cursor += 1
  }

  return {
    env,
    argv: argv.slice(cursor),
  }
}
