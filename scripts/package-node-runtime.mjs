import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import JSZip from 'jszip'

const TERMUX_BASE_URL = 'https://packages.termux.dev/apt/termux-main'
const PACKAGE_INDEX_PATH = 'dists/stable/main/binary-aarch64/Packages'
const DEFAULT_ARCH = 'aarch64'
const REQUIRED_PACKAGES = ['nodejs', 'libc++', 'openssl', 'c-ares', 'libicu', 'libsqlite', 'zlib', 'ca-certificates']
const TERMUX_PREFIX = 'data/data/com.termux/files/usr'

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
  const workRoot = await mkdtemp(join(tmpdir(), 'chatroom-node-runtime-'))
  const downloadsDir = join(workRoot, 'downloads')
  const unpackDir = join(workRoot, 'unpacked')
  const runtimeRoot = join(workRoot, runtimeId)
  const runtimeBinDir = join(runtimeRoot, 'bin')
  const runtimeLibDir = join(runtimeRoot, 'lib')
  const runtimeEtcDir = join(runtimeRoot, 'etc')
  const runtimeShareDir = join(runtimeRoot, 'share')

  try {
    console.log(`Fetching package index for ${arch}...`)
    const packagesIndex = parsePackagesIndex(await fetchText(`${TERMUX_BASE_URL}/${PACKAGE_INDEX_PATH}`))

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

      const debPath = join(downloadsDir, `${packageName}.deb`)
      const packageDir = join(unpackDir, packageName)
      console.log(`Downloading ${packageName}@${entry.Version}...`)
      await fetchFile(`${TERMUX_BASE_URL}/${entry.Filename}`, debPath)
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
