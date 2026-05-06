export const stripSkillParsingHintLines = (text: string): string => {
  const withoutHint = text.replace(/模型正在解析\s*skill\s*调用[^\n\r]*/gim, '')
  const compacted = withoutHint.replace(/\n{3,}/g, '\n\n')
  return compacted
}
