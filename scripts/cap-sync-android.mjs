import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(currentDir, '..')
const androidAssetsPublicDir = resolve(projectRoot, 'android', 'app', 'src', 'main', 'assets', 'public')
const requiredBundledRuntimeAssets = [
  {
    path: resolve(projectRoot, 'public', 'runtime-packages', 'nodejs-termux-aarch64.zip'),
    buildHint: 'npm run runtime:package:node',
  },
  {
    path: resolve(projectRoot, 'public', 'runtime-packages', 'python-termux-aarch64-scientific.zip'),
    buildHint: 'npm run runtime:package:python -- --output-dir public/runtime-packages',
  },
]

const missingRuntimeAssets = requiredBundledRuntimeAssets.filter((asset) => !existsSync(asset.path))

if (missingRuntimeAssets.length > 0) {
  const details = missingRuntimeAssets
    .map((asset) => `- missing: ${asset.path}\n  build with: ${asset.buildHint}`)
    .join('\n')
  throw new Error(
    `Bundled runtime assets are missing.\n${details}\n` +
      'Generate the missing runtime packages before syncing Android assets.',
  )
}

await rm(androidAssetsPublicDir, {
  recursive: true,
  force: true,
}).catch(() => {
  // Ignore best-effort cleanup errors before Capacitor rewrites the assets directory.
})

const command =
  process.platform === 'win32'
    ? {
        bin: 'cmd.exe',
        args: ['/d', '/s', '/c', 'npx cap sync android'],
      }
    : {
        bin: 'npx',
        args: ['cap', 'sync', 'android'],
      }

const child = spawn(command.bin, command.args, {
  cwd: projectRoot,
  stdio: 'inherit',
})

child.on('error', (error) => {
  console.error(error.message)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
