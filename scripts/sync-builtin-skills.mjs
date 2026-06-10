import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(currentDir, '..')
const builtinSkillsRoot = resolve(projectRoot, 'builtin-skills')
const publicSkillsRoot = resolve(projectRoot, 'public', 'builtin-skills')

const skills = ['device-info']

for (const skill of skills) {
  const source = resolve(builtinSkillsRoot, skill)
  const dest = resolve(publicSkillsRoot, skill)
  await rm(dest, { recursive: true, force: true })
  await mkdir(dest, { recursive: true })
  await cp(source, dest, { recursive: true, force: true })
}

console.log('Synced builtin skills to public/')
