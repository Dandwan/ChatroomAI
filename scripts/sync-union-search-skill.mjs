import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const currentDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(currentDir, '..')
const sourceRoot = resolve(projectRoot, 'codex-skills', 'union-search')
const builtinRoot = resolve(projectRoot, 'builtin-skills', 'union-search')
const publicRoot = resolve(projectRoot, 'public', 'builtin-skills', 'union-search')

const collectRelativeFiles = async (root, current = root) => {
  const entries = await readdir(current, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolutePath = resolve(current, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectRelativeFiles(root, absolutePath)))
      continue
    }
    const relativePath = absolutePath
      .slice(root.length + 1)
      .replace(/\\/g, '/')
    files.push(relativePath)
  }
  return files.sort((left, right) => left.localeCompare(right))
}

const shouldIncludePublicRuntimePath = (relativePath) => {
  const normalized = relativePath.replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 0) {
    return false
  }
  if (segments.some((segment) => segment.startsWith('.'))) {
    return false
  }
  if (segments.some((segment) => /^(test|tests|__tests__|coverage)$/i.test(segment))) {
    return false
  }
  if (segments.some((segment) => segment.toLowerCase() === '.github' || segment.toLowerCase() === '.yarn')) {
    return false
  }

  const basename = segments[segments.length - 1].toLowerCase()
  if (
    basename === 'readme.md' ||
    basename === 'changelog.md' ||
    basename === 'contributing.md' ||
    basename === 'tsconfig.json' ||
    basename === '.gitmodules' ||
    basename === '.nvmrc' ||
    basename === '.mocharc.json'
  ) {
    return false
  }
  if (basename.endsWith('.map') || basename.endsWith('.d.ts') || basename.endsWith('.d.cts')) {
    return false
  }

  return true
}

const buildManifest = async (root) => {
  const files = await collectRelativeFiles(root)
  const hash = createHash('sha256')
  for (const relativePath of files) {
    if (relativePath === 'manifest.json') {
      continue
    }
    hash.update(relativePath)
    hash.update('\n')
    hash.update(await readFile(resolve(root, relativePath)))
    hash.update('\n')
  }
  return {
    signature: hash.digest('hex'),
    files: files.filter((relativePath) => relativePath !== 'manifest.json'),
  }
}

await rm(builtinRoot, {
  recursive: true,
  force: true,
})

await mkdir(builtinRoot, {
  recursive: true,
})

await cp(sourceRoot, builtinRoot, {
  recursive: true,
  force: true,
})

await rm(publicRoot, {
  recursive: true,
  force: true,
})

await mkdir(publicRoot, {
  recursive: true,
})

const publicFiles = (await collectRelativeFiles(sourceRoot)).filter(shouldIncludePublicRuntimePath)
for (const relativePath of publicFiles) {
  const destination = resolve(publicRoot, relativePath)
  await mkdir(dirname(destination), {
    recursive: true,
  })
  await writeFile(destination, await readFile(resolve(sourceRoot, relativePath)))
}

const configExamplePath = resolve(sourceRoot, 'config.example.json')
const configTemplatePath = resolve(builtinRoot, 'config-template.json')
const configExample = await readFile(configExamplePath, 'utf8')
await writeFile(configTemplatePath, configExample)
await writeFile(resolve(publicRoot, 'config-template.json'), configExample)

const manifest = await buildManifest(publicRoot)
await writeFile(resolve(publicRoot, 'manifest.json'), JSON.stringify(manifest, null, 2))
