import { lstat, mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import JSZip from 'jszip'

const DEFAULT_ARCH = 'aarch64'
const TERMUX_PREFIX = 'data/data/com.termux/files/usr'
const TERMUX_REPOSITORIES = [
  {
    id: 'termux-main',
    baseUrl: 'https://packages.termux.dev/apt/termux-main',
    indexPaths: [
      `dists/stable/main/binary-${DEFAULT_ARCH}/Packages`,
      'dists/stable/main/binary-all/Packages',
    ],
    priority: 10,
  },
  {
    id: 'tur',
    baseUrl: 'https://tur.kcubeterm.com',
    indexPaths: [
      `dists/tur-packages/tur/binary-${DEFAULT_ARCH}/Packages`,
      'dists/tur-packages/tur/binary-all/Packages',
      `dists/tur-packages/tur-on-device/binary-${DEFAULT_ARCH}/Packages`,
      'dists/tur-packages/tur-on-device/binary-all/Packages',
      `dists/tur-packages/tur-continuous/binary-${DEFAULT_ARCH}/Packages`,
      'dists/tur-packages/tur-continuous/binary-all/Packages',
    ],
    priority: 20,
  },
]

const PACKAGE_GROUPS = [
  {
    id: 'python',
    required: true,
    candidates: ['python'],
  },
  {
    id: 'pip',
    required: true,
    candidates: ['python-pip', 'pip'],
  },
  {
    id: 'setuptools',
    required: false,
    candidates: ['python-setuptools', 'setuptools'],
  },
  {
    id: 'wheel',
    required: false,
    candidates: ['python-wheel', 'wheel'],
  },
  {
    id: 'numpy',
    required: true,
    candidates: ['python-numpy', 'numpy'],
  },
  {
    id: 'pandas',
    required: true,
    candidates: ['python-pandas', 'pandas'],
  },
  {
    id: 'matplotlib',
    required: true,
    candidates: ['matplotlib', 'python-matplotlib'],
  },
  {
    id: 'lxml',
    required: false,
    candidates: ['python-lxml', 'lxml'],
  },
  {
    id: 'httpx',
    required: false,
    candidates: ['python-httpx', 'httpx'],
  },
  {
    id: 'openai',
    required: false,
    candidates: ['python-openai', 'openai'],
  },
  {
    id: 'pydantic',
    required: false,
    candidates: ['python-pydantic', 'pydantic'],
  },
  {
    id: 'python-dotenv',
    required: false,
    candidates: ['python-dotenv', 'dotenv'],
  },
  {
    id: 'beautifulsoup4',
    required: false,
    candidates: ['python-beautifulsoup4', 'python-bs4', 'beautifulsoup4'],
  },
  {
    id: 'requests',
    required: false,
    candidates: ['python-requests', 'requests'],
  },
  {
    id: 'pyyaml',
    required: false,
    candidates: ['python-pyyaml', 'python-yaml', 'pyyaml'],
  },
  {
    id: 'rich',
    required: false,
    candidates: ['python-rich', 'rich'],
  },
  {
    id: 'click',
    required: false,
    candidates: ['python-click', 'click'],
  },
  {
    id: 'markdown',
    required: false,
    candidates: ['python-markdown', 'markdown'],
  },
  {
    id: 'tqdm',
    required: false,
    candidates: ['python-tqdm', 'tqdm'],
  },
]

const RUNTIME_ROOT_DIRECTORIES = ['bin', 'lib', 'etc', 'include', 'share']
const SHARE_SKIP_PREFIXES = ['doc', 'man', 'info']
const DEFAULT_CACHE_DIR = '.local/runtime-package-cache/python'
const AR_ARCHIVE_MAGIC = '!<arch>\n'
const SUPPLEMENTAL_WHEEL_SPECS = [
  {
    id: 'python-dateutil',
    required: true,
    prefixes: ['python_dateutil-'],
  },
  {
    id: 'six',
    required: true,
    prefixes: ['six-'],
  },
  {
    id: 'cycler',
    required: true,
    prefixes: ['cycler-'],
  },
  {
    id: 'fonttools',
    required: true,
    prefixes: ['fonttools-'],
  },
  {
    id: 'packaging',
    required: true,
    prefixes: ['packaging-'],
  },
  {
    id: 'pyparsing',
    required: true,
    prefixes: ['pyparsing-'],
  },
  {
    id: 'kiwisolver',
    required: false,
    prefixes: ['kiwisolver-'],
  },
]

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
    let currentKey = ''
    for (const rawLine of block.split('\n')) {
      const line = rawLine.replace(/\r$/, '')
      if (!line) {
        continue
      }
      if (/^\s/.test(line) && currentKey) {
        entry[currentKey] = `${entry[currentKey] ?? ''}\n${line.trim()}`
        continue
      }
      const separator = line.indexOf(': ')
      if (separator === -1) {
        continue
      }
      currentKey = line.slice(0, separator)
      entry[currentKey] = line.slice(separator + 2)
    }
    if (entry.Package) {
      packages.set(entry.Package, entry)
    }
  }
  return packages
}

const splitDependencyAlternatives = (value) =>
  value
    .split('|')
    .map((item) =>
      item
        .replace(/\(.*?\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/<.*?>/g, '')
        .replace(/:any\b/g, '')
        .trim(),
    )
    .map((item) => item.replace(/\s+/g, ''))
    .filter(Boolean)

const parseDependencyNames = (entry) => {
  const values = [entry['Pre-Depends'], entry.Depends].filter(Boolean)
  const dependencies = []
  for (const value of values) {
    for (const chunk of value.split(',')) {
      const alternatives = splitDependencyAlternatives(chunk)
      if (alternatives.length === 0) {
        continue
      }
      dependencies.push(alternatives)
    }
  }
  return dependencies
}

const copyResolvedFile = async (source, destination) => {
  const sourceLinkStat = await lstat(source)
  if (sourceLinkStat.isSymbolicLink()) {
    try {
      return copyResolvedFile(await realpath(source), destination)
    } catch {
      return
    }
  }

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

const shouldSkipShareEntry = (entry) => SHARE_SKIP_PREFIXES.some((prefix) => entry === prefix)

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

const mergePackageIndex = (registry, repo, packages) => {
  for (const [name, entry] of packages) {
    const existing = registry.get(name)
    if (existing && existing.priority <= repo.priority) {
      continue
    }
    registry.set(name, {
      ...entry,
      repoId: repo.id,
      repoBaseUrl: repo.baseUrl,
      priority: repo.priority,
    })
  }
}

const loadPackageRegistry = async ({ indexCacheDir, offline }) => {
  const registry = new Map()
  await mkdir(indexCacheDir, { recursive: true })

  for (const repo of TERMUX_REPOSITORIES) {
    for (const indexPath of repo.indexPaths) {
      const url = `${repo.baseUrl}/${indexPath}`
      const cachePath = join(indexCacheDir, `${sanitizeCacheFileName(repo.id)}--${sanitizeCacheFileName(indexPath)}`)
      try {
        let content = ''
        if (offline) {
          content = await readCachedText(cachePath)
          console.log(`Loaded cached package index ${cachePath}`)
        } else {
          console.log(`Fetching package index ${url}...`)
          content = await fetchText(url)
          await writeFile(cachePath, content)
        }
        mergePackageIndex(registry, repo, parsePackagesIndex(content))
      } catch (error) {
        try {
          const cached = await readCachedText(cachePath)
          console.warn(
            `Warning: failed to load ${offline ? 'cached' : 'live'} index ${url}; using cache ${cachePath}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
          mergePackageIndex(registry, repo, parsePackagesIndex(cached))
        } catch (cacheError) {
          console.warn(
            `Warning: failed to load package index ${url}: ${
              error instanceof Error ? error.message : String(error)
            }${
              cacheError ? `; no usable cache at ${cachePath}` : ''
            }`,
          )
        }
      }
    }
  }

  return registry
}

const resolveSelectedPackages = (registry) => {
  const selected = new Map()
  const missingRequired = []
  const missingOptionalGroups = []
  const resolvedGroups = []

  for (const group of PACKAGE_GROUPS) {
    const matchedName = group.candidates.find((candidate) => registry.has(candidate))
    if (!matchedName) {
      if (group.required) {
        missingRequired.push(group.id)
      } else {
        missingOptionalGroups.push(group.id)
      }
      continue
    }
    selected.set(matchedName, registry.get(matchedName))
    resolvedGroups.push({
      id: group.id,
      packageName: matchedName,
      required: group.required,
    })
  }

  if (missingRequired.length > 0) {
    throw new Error(`Missing required Python package groups: ${missingRequired.join(', ')}`)
  }

  if (missingOptionalGroups.length > 0) {
    console.warn(`Optional Python package groups unavailable: ${missingOptionalGroups.join(', ')}`)
  }

  return {
    selectedPackages: selected,
    missingOptionalGroups,
    resolvedGroups,
  }
}

const collectPackageClosure = (registry, selected) => {
  const queue = Array.from(selected.keys())
  const resolved = new Map(selected)
  const missingDependencies = new Set()

  while (queue.length > 0) {
    const packageName = queue.shift()
    const entry = resolved.get(packageName)
    if (!entry) {
      continue
    }

    for (const alternatives of parseDependencyNames(entry)) {
      const dependencyName = alternatives.find((candidate) => registry.has(candidate))
      if (!dependencyName) {
        missingDependencies.add(`${packageName} -> ${alternatives.join(' | ')}`)
        continue
      }
      if (resolved.has(dependencyName)) {
        continue
      }
      resolved.set(dependencyName, registry.get(dependencyName))
      queue.push(dependencyName)
    }
  }

  if (missingDependencies.size > 0) {
    throw new Error(
      `Missing transitive Termux dependencies: ${Array.from(missingDependencies).sort().join(', ')}`,
    )
  }

  return resolved
}

const extractPackagePayload = async (packageName, entry, downloadsDir, unpackDir, packageCacheDir, offline) => {
  if (!entry?.Filename) {
    throw new Error(`Package metadata missing for ${packageName}`)
  }

  await mkdir(downloadsDir, { recursive: true })
  await mkdir(packageCacheDir, { recursive: true })

  const debCachePath = join(
    packageCacheDir,
    `${sanitizeCacheFileName(packageName)}--${sanitizeCacheFileName(entry.Version ?? 'unknown')}--${sanitizeCacheFileName(entry.repoId ?? 'repo')}.deb`,
  )
  const debPath = join(downloadsDir, `${packageName}.deb`)
  const packageDir = join(unpackDir, packageName)
  await mkdir(packageDir, { recursive: true })

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
    console.log(`Downloading ${packageName}@${entry.Version} from ${entry.repoId}...`)
    await fetchFile(`${entry.repoBaseUrl}/${entry.Filename}`, debCachePath)
    cachedBuffer = await readFile(debCachePath)
    if (!isArArchiveBuffer(cachedBuffer)) {
      throw new Error(`Downloaded package is not a valid ar archive: ${debCachePath}`)
    }
  }

  await writeFile(debPath, cachedBuffer)
  await run('ar', ['x', debPath], { cwd: packageDir })

  const tarball = (await readdir(packageDir)).find((item) => item.startsWith('data.tar.'))
  if (!tarball) {
    throw new Error(`No data archive found in ${packageName}`)
  }

  const extractDir = join(packageDir, 'payload')
  await mkdir(extractDir, { recursive: true })
  await run('tar', ['-xf', join(packageDir, tarball), '-C', extractDir])
  return extractDir
}

const mergePayloadIntoRuntime = async (extractDir, runtimeRoot) => {
  for (const directoryName of RUNTIME_ROOT_DIRECTORIES) {
    const sourcePath = join(extractDir, TERMUX_PREFIX, directoryName)
    let entries
    try {
      entries = await readdir(sourcePath)
    } catch {
      // Directory is optional per package.
      continue
    }

    for (const entry of entries) {
      if (directoryName === 'share' && shouldSkipShareEntry(entry)) {
        continue
      }
      await copyResolvedFile(join(sourcePath, entry), join(runtimeRoot, directoryName, entry))
    }
  }
}

const parseWheelVersion = (filename, prefix) => {
  const baseName = filename.replace(/\.whl$/i, '')
  return baseName.slice(prefix.length).split('-')[0] ?? ''
}

const compareVersionsDescending = (left, right) =>
  right.localeCompare(left, undefined, {
    numeric: true,
    sensitivity: 'base',
  })

const selectSupplementalWheelFiles = async (wheelCacheDir) => {
  await mkdir(wheelCacheDir, { recursive: true })
  const wheelFiles = (await readdir(wheelCacheDir)).filter((name) => name.endsWith('.whl'))
  const selected = []
  const missing = []

  for (const spec of SUPPLEMENTAL_WHEEL_SPECS) {
    const candidates = wheelFiles
      .filter((name) => spec.prefixes.some((prefix) => name.startsWith(prefix)))
      .sort((left, right) => {
        const leftPrefix = spec.prefixes.find((prefix) => left.startsWith(prefix)) ?? ''
        const rightPrefix = spec.prefixes.find((prefix) => right.startsWith(prefix)) ?? ''
        return compareVersionsDescending(
          parseWheelVersion(left, leftPrefix),
          parseWheelVersion(right, rightPrefix),
        )
      })

    if (candidates.length === 0) {
      if (spec.required) {
        missing.push(spec.id)
      }
      continue
    }

    selected.push({
      id: spec.id,
      fileName: candidates[0],
    })
  }

  if (missing.length > 0) {
    throw new Error(`Missing required supplemental wheels: ${missing.join(', ')}`)
  }

  return selected
}

const copyWheelDirectoryContents = async (sourceDir, destinationDir) => {
  const entries = await readdir(sourceDir)
  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry)
    const destinationPath = join(destinationDir, entry)
    await copyResolvedFile(sourcePath, destinationPath)
  }
}

const installSupplementalWheels = async ({
  wheelCacheDir,
  pythonLibDir,
}) => {
  const selectedWheels = await selectSupplementalWheelFiles(wheelCacheDir)
  if (selectedWheels.length === 0) {
    return []
  }

  const sitePackagesDir = join(pythonLibDir, 'site-packages')
  await mkdir(sitePackagesDir, { recursive: true })

  for (const wheel of selectedWheels) {
    const wheelPath = join(wheelCacheDir, wheel.fileName)
    const archive = await JSZip.loadAsync(await readFile(wheelPath))
    const wheelEntries = Object.values(archive.files).filter((entry) => !entry.dir)
    const wheelWorkDir = await mkdtemp(join(tmpdir(), 'chatroom-python-wheel-'))

    try {
      for (const entry of wheelEntries) {
        const normalized = entry.name.replace(/\\/g, '/')
        if (normalized.includes('..')) {
          throw new Error(`Wheel contains unsafe path: ${entry.name}`)
        }

        let relativeDestination = normalized
        if (normalized.includes('.data/purelib/')) {
          relativeDestination = normalized.slice(normalized.indexOf('.data/purelib/') + '.data/purelib/'.length)
        } else if (normalized.includes('.data/platlib/')) {
          relativeDestination = normalized.slice(normalized.indexOf('.data/platlib/') + '.data/platlib/'.length)
        } else if (normalized.includes('.data/scripts/')) {
          continue
        } else if (normalized.includes('.data/headers/')) {
          continue
        } else if (normalized.includes('.data/data/')) {
          continue
        }

        const destinationPath = join(wheelWorkDir, relativeDestination)
        await mkdir(dirname(destinationPath), { recursive: true })
        await writeFile(destinationPath, Buffer.from(await entry.async('uint8array')))
      }

      await copyWheelDirectoryContents(wheelWorkDir, sitePackagesDir)
    } finally {
      await rm(wheelWorkDir, { recursive: true, force: true })
    }
  }

  return selectedWheels
}

const patchMatplotlibOptionalKiwisolver = async (pythonLibDir) => {
  const matplotlibInitPath = join(pythonLibDir, 'site-packages', 'matplotlib', '__init__.py')
  const layoutEnginePath = join(pythonLibDir, 'site-packages', 'matplotlib', 'layout_engine.py')
  let content
  try {
    content = await readFile(matplotlibInitPath, 'utf8')
  } catch {
    return false
  }

  const targetLine = '            ("kiwisolver", "1.3.1"),\n'
  if (!content.includes(targetLine)) {
    return false
  }

  let patched = false
  if (content.includes(targetLine)) {
    await writeFile(matplotlibInitPath, content.replace(targetLine, ''))
    patched = true
  }

  try {
    const layoutEngineContent = await readFile(layoutEnginePath, 'utf8')
    const importReplacement = [
      'try:\n',
      '    from matplotlib._constrained_layout import do_constrained_layout\n',
      'except ModuleNotFoundError:\n',
      '    do_constrained_layout = None\n',
    ].join('')
    const executeReplacement = [
      '        if do_constrained_layout is None:\n',
      '            raise RuntimeError(\n',
      '                "constrained layout requires the optional kiwisolver dependency"\n',
      '            )\n',
      '        width, height = fig.get_size_inches()\n',
    ].join('')

    let nextLayoutEngineContent = layoutEngineContent
    if (nextLayoutEngineContent.includes('from matplotlib._constrained_layout import do_constrained_layout')) {
      nextLayoutEngineContent = nextLayoutEngineContent.replace(
        /from matplotlib\._constrained_layout import do_constrained_layout\r?\n/,
        importReplacement,
      )
    }
    if (
      nextLayoutEngineContent.includes('class ConstrainedLayoutEngine') &&
      nextLayoutEngineContent.includes('        width, height = fig.get_size_inches()')
    ) {
      nextLayoutEngineContent = nextLayoutEngineContent.replace(
        /        width, height = fig\.get_size_inches\(\)\r?\n/,
        executeReplacement,
      )
    }
    if (nextLayoutEngineContent !== layoutEngineContent) {
      await writeFile(layoutEnginePath, nextLayoutEngineContent)
      patched = true
    }
  } catch {
    // Ignore if matplotlib layout engine source layout changes.
  }

  return patched
}

const findPythonBinary = async (runtimeBinDir) => {
  const entries = await readdir(runtimeBinDir)
  const ranked = entries
    .filter((entry) => /^python(?:\d+(?:\.\d+)*)?$/.test(entry))
    .sort((left, right) => {
      const score = (value) => {
        if (/^python\d+\.\d+$/.test(value)) {
          return 300 + Number.parseFloat(value.slice('python'.length))
        }
        if (/^python\d+$/.test(value)) {
          return 200 + Number.parseInt(value.slice('python'.length), 10)
        }
        if (value === 'python3') {
          return 150
        }
        if (value === 'python') {
          return 100
        }
        return 0
      }
      return score(right) - score(left)
    })

  if (ranked.length === 0) {
    throw new Error('Python executable was not copied into the runtime bundle')
  }

  return ranked[0]
}

const detectPythonLibVersion = async (runtimeLibDir) => {
  const entries = await readdir(runtimeLibDir)
  const versions = entries
    .filter((entry) => /^python\d+\.\d+$/.test(entry))
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
  if (versions.length === 0) {
    throw new Error('Python stdlib directory is missing from the runtime bundle')
  }
  return versions[0]
}

const readPythonVersionFromStdlib = (pythonLibVersion) => pythonLibVersion.replace(/^python/, '')

const buildRuntimeManifest = ({
  runtimeId,
  arch,
  pythonBinaryName,
  pythonVersion,
  pythonPackageVersion,
  selectedPackages,
  resolvedGroups,
  missingOptionalGroups,
  supplementalWheels,
  matplotlibPatchedForOptionalKiwisolver,
  allPackages,
}) => ({
  schemaVersion: 1,
  id: runtimeId,
  type: 'python',
  displayName: `Python Scientific Runtime (${arch})`,
  version: pythonPackageVersion || pythonVersion,
  entrypoint: `bin/${pythonBinaryName}`,
  arch,
  bundledProfiles: ['scientific', 'common-tools'],
  resolvedGroups,
  missingOptionalGroups,
  supplementalWheels,
  matplotlibPatchedForOptionalKiwisolver,
  selectedPackages: Object.fromEntries(
    Array.from(selectedPackages.entries()).map(([name, entry]) => [name, entry.Version ?? 'unknown']),
  ),
  packages: Object.fromEntries(
    Array.from(allPackages.entries()).map(([name, entry]) => [
      name,
      {
        version: entry.Version ?? 'unknown',
        source: entry.repoId,
      },
    ]),
  ),
})

const main = async () => {
  const args = toArgMap(process.argv.slice(2))
  const arch = args.get('arch') ?? DEFAULT_ARCH
  if (arch !== DEFAULT_ARCH) {
    throw new Error(`Only ${DEFAULT_ARCH} is currently supported.`)
  }

  const runtimeId = args.get('runtime-id') ?? `python-termux-${arch}-scientific`
  const outputDir = resolve(args.get('output-dir') ?? 'dist/runtime-packages')
  const cacheDir = resolve(args.get('cache-dir') ?? DEFAULT_CACHE_DIR)
  const offline = args.get('offline') === 'true'
  const workRoot = await mkdtemp(join(tmpdir(), 'chatroom-python-runtime-'))
  const downloadsDir = join(workRoot, 'downloads')
  const unpackDir = join(workRoot, 'unpacked')
  const runtimeRoot = join(workRoot, runtimeId)
  const runtimeBinDir = join(runtimeRoot, 'bin')
  const runtimeLibDir = join(runtimeRoot, 'lib')
  const indexCacheDir = join(cacheDir, 'indexes')
  const packageCacheDir = join(cacheDir, 'packages')
  const wheelCacheDir = join(cacheDir, 'wheels')

  try {
    await mkdir(downloadsDir, { recursive: true })
    await mkdir(unpackDir, { recursive: true })
    await mkdir(runtimeBinDir, { recursive: true })
    await mkdir(runtimeLibDir, { recursive: true })
    await mkdir(join(runtimeRoot, 'etc'), { recursive: true })
    await mkdir(join(runtimeRoot, 'share'), { recursive: true })

    const registry = await loadPackageRegistry({
      indexCacheDir,
      offline,
    })
    if (registry.size === 0) {
      throw new Error('No package metadata could be fetched from Termux repositories')
    }

    const { selectedPackages, missingOptionalGroups, resolvedGroups } = resolveSelectedPackages(registry)
    const allPackages = collectPackageClosure(registry, selectedPackages)

    for (const [packageName, entry] of allPackages) {
      const extractDir = await extractPackagePayload(
        packageName,
        entry,
        downloadsDir,
        unpackDir,
        packageCacheDir,
        offline,
      )
      await mergePayloadIntoRuntime(extractDir, runtimeRoot)
    }

    const pythonBinaryName = await findPythonBinary(runtimeBinDir)
    const pythonLibVersion = await detectPythonLibVersion(runtimeLibDir)
    const pythonVersion = readPythonVersionFromStdlib(pythonLibVersion)
    const pythonLibDir = join(runtimeLibDir, pythonLibVersion)
    const supplementalWheels = await installSupplementalWheels({
      wheelCacheDir,
      pythonLibDir,
    })
    const matplotlibPatchedForOptionalKiwisolver = await patchMatplotlibOptionalKiwisolver(pythonLibDir)
    const manifest = buildRuntimeManifest({
      runtimeId,
      arch,
      pythonBinaryName,
      pythonVersion,
      pythonPackageVersion: selectedPackages.get('python')?.Version ?? pythonVersion,
      selectedPackages,
      resolvedGroups,
      missingOptionalGroups,
      supplementalWheels,
      matplotlibPatchedForOptionalKiwisolver,
      allPackages,
    })

    await writeFile(join(runtimeRoot, 'runtime.json'), JSON.stringify(manifest, null, 2))

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
