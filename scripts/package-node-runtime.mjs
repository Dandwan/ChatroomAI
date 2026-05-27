import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import JSZip from 'jszip'

const TERMUX_BASE_URL = 'https://packages.termux.dev/apt/termux-main'
const PACKAGE_INDEX_PATH = 'dists/stable/main/binary-aarch64/Packages'
const DEFAULT_ARCH = 'aarch64'
const REQUIRED_PACKAGES = ['nodejs', 'libc++', 'openssl', 'c-ares', 'libicu', 'libsqlite', 'zlib', 'ca-certificates']
const TERMUX_PREFIX = 'data/data/com.termux/files/usr'
const DEFAULT_CACHE_DIR = '.local/runtime-package-cache/node'
const AR_ARCHIVE_MAGIC = '!<arch>\n'

const sanitizeCacheFileName = (value) =>
  value
    .replace(/\\/g, '/')
    .replace(/[^a-zA-Z0-9._/-]+/g, '-')
    .replace(/\//g, '__')

const toArgMap = (argv) => {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (!current.startsWith('--')) {
      continue
    }
    const key = current.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      values.set(key, 'true')
      continue
    }
    values.set(key, next)
    index += 1
  }
  return values
}

const run = async (command, args, options = {}) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options,
    })
    child.on('error', rejectPromise)
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      rejectPromise(new Error(`${command} exited with code ${code}`))
    })
  })

const fetchText = async (url) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }
  return response.text()
}

const fetchFile = async (url, destination) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, Buffer.from(await response.arrayBuffer()))
}

const readCachedText = async (path) => (await readFile(path, 'utf8')).replace(/\r\n/g, '\n')

const isArArchiveBuffer = (buffer) =>
  buffer.length >= AR_ARCHIVE_MAGIC.length &&
  buffer.subarray(0, AR_ARCHIVE_MAGIC.length).toString('ascii') === AR_ARCHIVE_MAGIC

const parsePackagesIndex = (content) => {
  const packages = new Map()
  for (const block of content.split('\n\n')) {
    const entry = {}
    for (const line of block.split('\n')) {
      if (!line.includes(': ')) {
        continue
      }
      const separator = line.indexOf(': ')
      entry[line.slice(0, separator)] = line.slice(separator + 2)
    }
    if (entry.Package) {
      packages.set(entry.Package, entry)
    }
  }
  return packages
}

const loadPackageIndex = async ({ indexCacheDir, offline }) => {
  await mkdir(indexCacheDir, { recursive: true })
  const cachePath = join(indexCacheDir, sanitizeCacheFileName(PACKAGE_INDEX_PATH))

  let content = ''
  if (offline) {
    content = await readCachedText(cachePath)
    console.log(`Loaded cached package index ${cachePath}`)
  } else {
    const url = `${TERMUX_BASE_URL}/${PACKAGE_INDEX_PATH}`
    console.log(`Fetching package index ${url}...`)
    try {
      content = await fetchText(url)
      await writeFile(cachePath, content)
    } catch (error) {
      try {
        const cached = await readCachedText(cachePath)
        console.warn(
          `Warning: failed to fetch live index; using cache ${cachePath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
        content = cached
      } catch {
        throw error
      }
    }
  }

  return parsePackagesIndex(content)
}

const downloadPackage = async (packageName, entry, downloadsDir, packageCacheDir, offline) => {
  if (!entry?.Filename) {
    throw new Error(`Package metadata missing for ${packageName}`)
  }

  await mkdir(downloadsDir, { recursive: true })
  await mkdir(packageCacheDir, { recursive: true })

  const debCachePath = join(
    packageCacheDir,
    `${sanitizeCacheFileName(packageName)}--${sanitizeCacheFileName(entry.Version ?? 'unknown')}.deb`,
  )

  let cachedBuffer = null
  try {
    cachedBuffer = await readFile(debCachePath)
    if (!isArArchiveBuffer(cachedBuffer)) {
      throw new Error(`Cached package is not a valid ar archive: ${debCachePath}`)
    }
    console.log(`Using cached package ${packageName}@${entry.Version} from ${debCachePath}`)
  } catch (error) {
    if (offline) {
      throw new Error(
        `Offline mode is enabled and package cache is unavailable or invalid for ${packageName}@${entry.Version}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
    console.log(`Downloading ${packageName}@${entry.Version}...`)
    await fetchFile(`${TERMUX_BASE_URL}/${entry.Filename}`, debCachePath)
    cachedBuffer = await readFile(debCachePath)
    if (!isArArchiveBuffer(cachedBuffer)) {
      throw new Error(`Downloaded package is not a valid ar archive: ${debCachePath}`)
    }
  }

  const debPath = join(downloadsDir, `${packageName}.deb`)
  await writeFile(debPath, cachedBuffer)
  return debPath
}

const copyResolvedFile = async (source, destination) => {
  const sourceStat = await stat(source)
  if (sourceStat.isDirectory()) {
    await mkdir(destination, { recursive: true })
    const children = await readdir(source)
    for (const child of children) {
      await copyResolvedFile(join(source, child), join(destination, child))
    }
    return
  }

  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, await readFile(source))
}

const addDirectoryToZip = async (zip, root, current = root) => {
  const currentStat = await stat(current)
  if (currentStat.isDirectory()) {
    const children = await readdir(current)
    for (const child of children) {
      await addDirectoryToZip(zip, root, join(current, child))
    }
    return
  }

  zip.file(relative(root, current).replaceAll('\\', '/'), createReadStream(current))
}

const main = async () => {
  const args = toArgMap(process.argv.slice(2))
  const arch = args.get('arch') ?? DEFAULT_ARCH
  if (arch !== DEFAULT_ARCH) {
    throw new Error(`Only ${DEFAULT_ARCH} is currently supported.`)
  }

  const runtimeId = args.get('runtime-id') ?? `nodejs-termux-${arch}`
  const outputDir = resolve(args.get('output-dir') ?? 'dist/runtime-packages')
  const cacheDir = resolve(args.get('cache-dir') ?? DEFAULT_CACHE_DIR)
  const offline = args.get('offline') === 'true'
  const workRoot = await mkdtemp(join(tmpdir(), 'chatroom-node-runtime-'))
  const downloadsDir = join(workRoot, 'downloads')
  const unpackDir = join(workRoot, 'unpacked')
  const runtimeRoot = join(workRoot, runtimeId)
  const runtimeBinDir = join(runtimeRoot, 'bin')
  const runtimeLibDir = join(runtimeRoot, 'lib')
  const runtimeEtcDir = join(runtimeRoot, 'etc')
  const runtimeShareDir = join(runtimeRoot, 'share')
  const indexCacheDir = join(cacheDir, 'indexes')
  const packageCacheDir = join(cacheDir, 'packages')

  try {
    const packagesIndex = await loadPackageIndex({ indexCacheDir, offline })
    if (packagesIndex.size === 0) {
      throw new Error('No package metadata could be fetched from Termux repository')
    }

    await mkdir(downloadsDir, { recursive: true })
    await mkdir(unpackDir, { recursive: true })
    await mkdir(runtimeBinDir, { recursive: true })
    await mkdir(runtimeLibDir, { recursive: true })
    await mkdir(runtimeEtcDir, { recursive: true })
    await mkdir(runtimeShareDir, { recursive: true })

    for (const packageName of REQUIRED_PACKAGES) {
      const entry = packagesIndex.get(packageName)
      if (!entry?.Filename) {
        throw new Error(`Package metadata missing for ${packageName}`)
      }

      const debPath = await downloadPackage(packageName, entry, downloadsDir, packageCacheDir, offline)
      const packageDir = join(unpackDir, packageName)
      await mkdir(packageDir, { recursive: true })
      await run('ar', ['x', debPath], { cwd: packageDir })

      const tarball = (await readdir(packageDir)).find((item) => item.startsWith('data.tar.'))
      if (!tarball) {
        throw new Error(`No data archive found in ${packageName}`)
      }

      const extractDir = join(packageDir, 'payload')
      await mkdir(extractDir, { recursive: true })
      await run('tar', ['-xf', join(packageDir, tarball), '-C', extractDir])
    }

    const nodeBinary = join(unpackDir, 'nodejs', 'payload', TERMUX_PREFIX, 'bin', 'node')
    await copyResolvedFile(nodeBinary, join(runtimeBinDir, 'node'))

    for (const packageName of REQUIRED_PACKAGES) {
      const libDir = join(unpackDir, packageName, 'payload', TERMUX_PREFIX, 'lib')
      try {
        const entries = await readdir(libDir)
        for (const entry of entries) {
          if (!entry.includes('.so')) {
            continue
          }
          await copyResolvedFile(join(libDir, entry), join(runtimeLibDir, entry))
        }
      } catch {
        // Package may not ship additional shared libraries.
      }

      const shareNode = join(unpackDir, packageName, 'payload', TERMUX_PREFIX, 'share')
      try {
        const entries = await readdir(shareNode)
        for (const entry of entries) {
          if (packageName !== 'nodejs' && entry !== 'doc') {
            continue
          }
          await copyResolvedFile(join(shareNode, entry), join(runtimeShareDir, entry))
        }
      } catch {
        // Optional shared assets.
      }

      const etcNode = join(unpackDir, packageName, 'payload', TERMUX_PREFIX, 'etc')
      try {
        const entries = await readdir(etcNode)
        for (const entry of entries) {
          await copyResolvedFile(join(etcNode, entry), join(runtimeEtcDir, entry))
        }
      } catch {
        // Optional configuration assets.
      }
    }

    const nodePackage = packagesIndex.get('nodejs')
    await writeFile(
      join(runtimeRoot, 'runtime.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          id: runtimeId,
          type: 'node',
          displayName: `Node.js Runtime (${arch})`,
          version: nodePackage?.Version ?? runtimeId,
          entrypoint: 'bin/node',
          arch,
          packages: Object.fromEntries(
            REQUIRED_PACKAGES.map((packageName) => {
              const entry = packagesIndex.get(packageName)
              return [packageName, entry?.Version ?? 'unknown']
            }),
          ),
        },
        null,
        2,
      ),
    )

    await mkdir(outputDir, { recursive: true })
    const zip = new JSZip()
    await addDirectoryToZip(zip, workRoot, runtimeRoot)
    const archive = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    })
    const outputPath = join(outputDir, `${runtimeId}.zip`)
    await writeFile(outputPath, archive)
    console.log(outputPath)
  } finally {
    if (args.get('keep-workdir') !== 'true') {
      await rm(workRoot, { recursive: true, force: true })
    } else {
      console.log(`Kept workdir: ${workRoot}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
