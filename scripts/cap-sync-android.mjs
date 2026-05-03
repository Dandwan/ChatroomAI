import { spawn } from 'node:child_process'
import { cp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(currentDir, '..')
const androidAssetsPublicDir = resolve(projectRoot, 'android', 'app', 'src', 'main', 'assets', 'public')
const androidAssetsDir = resolve(projectRoot, 'android', 'app', 'src', 'main', 'assets')
const distDir = resolve(projectRoot, 'dist')
const distIndexHtml = resolve(distDir, 'index.html')
const androidIndexHtml = resolve(androidAssetsPublicDir, 'index.html')
const capacitorConfigJson = resolve(androidAssetsDir, 'capacitor.config.json')
const capacitorConfigSource = resolve(projectRoot, 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json')

const ensureAndroidAssetsMirror = async () => {
  await rm(androidAssetsPublicDir, {
    recursive: true,
    force: true,
  }).catch(() => {
    // Ignore best-effort cleanup errors before rewriting the assets directory.
  })

  await cp(distDir, androidAssetsPublicDir, {
    recursive: true,
    force: true,
  })

  try {
    const configJson = await readFile(capacitorConfigSource)
    await writeFile(capacitorConfigJson, configJson)
  } catch {
    // If Capacitor did not generate the config yet, the next sync attempt will recreate it.
  }
}

await ensureAndroidAssetsMirror()

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
  if (code !== 0) {
    process.exit(code ?? 1)
    return
  }

  void (async () => {
    try {
      const [expectedIndexHtml, actualIndexHtml] = await Promise.all([
        readFile(distIndexHtml, 'utf8'),
        readFile(androidIndexHtml, 'utf8').catch(() => ''),
      ])

      if (expectedIndexHtml !== actualIndexHtml) {
        await ensureAndroidAssetsMirror()
      }
      process.exit(0)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })()
})
