#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const STATE_DIR = path.join(process.cwd(), '.runtime-shell-state')
const STATE_PATH = path.join(STATE_DIR, 'sessions.json')
const DEFAULT_WAIT_MS = 3000
const MAX_TAIL_BYTES = 64 * 1024

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const ensureStateDir = () => {
  fs.mkdirSync(STATE_DIR, { recursive: true })
}

const readState = () => {
  ensureStateDir()
  if (!fs.existsSync(STATE_PATH)) {
    return { sessions: {} }
  }
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.sessions && typeof parsed.sessions === 'object') {
      return parsed
    }
  } catch {}
  return { sessions: {} }
}

const writeState = (state) => {
  ensureStateDir()
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8')
}

const parseArgv = (argv) => {
  const parsed = {}
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (!current.startsWith('--')) {
      continue
    }
    const key = current.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      parsed[key] = true
      continue
    }
    parsed[key] = next
    index += 1
  }
  return parsed
}

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return parsed
}

const sanitizePart = (value) => String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_')

const buildSessionId = (runtime, label) => `${runtime}::${label || '__default__'}`

const isAlive = (pid) => {
  if (!pid || typeof pid !== 'number') {
    return false
  }
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const terminate = async (pid) => {
  if (!isAlive(pid)) {
    return
  }
  try {
    process.kill(pid, 'SIGTERM')
  } catch {}
  for (let index = 0; index < 10; index += 1) {
    if (!isAlive(pid)) {
      return
    }
    await sleep(80)
  }
  try {
    process.kill(pid, 'SIGKILL')
  } catch {}
}

const readTail = (filePath) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return ''
  }
  const content = fs.readFileSync(filePath, 'utf8')
  return content.length > MAX_TAIL_BYTES ? content.slice(content.length - MAX_TAIL_BYTES) : content
}

const buildRuntimeLaunch = (runtime, commandText) => {
  if (runtime === 'node') {
    const executable = process.env.SKILL_NODE_EXECUTABLE
    if (!executable) {
      throw new Error('Node runtime is unavailable')
    }
    return {
      executable,
      args: ['-e', commandText],
    }
  }
  if (runtime === 'python') {
    const executable = process.env.SKILL_PYTHON_EXECUTABLE
    if (!executable) {
      throw new Error('Python runtime is unavailable')
    }
    return {
      executable,
      args: ['-c', commandText],
    }
  }
  throw new Error('runtime must be node or python')
}

const prependPath = (baseValue, prependValue) => {
  if (!prependValue) {
    return baseValue || ''
  }
  return baseValue ? `${prependValue}:${baseValue}` : prependValue
}

const ensureDirectory = (directoryPath) => {
  fs.mkdirSync(directoryPath, { recursive: true })
}

const buildRuntimeEnvironment = (executable, baseEnv) => {
  const nextEnv = { ...baseEnv }
  const runtimeBinDir = path.dirname(executable)
  const runtimeRoot = path.dirname(runtimeBinDir)
  const runtimeLibDir = path.join(runtimeRoot, 'lib')
  const runtimeVarDir = path.join(runtimeRoot, 'var')
  const runtimeHomeDir = path.join(runtimeVarDir, 'home')
  const certFile = path.join(runtimeRoot, 'etc', 'tls', 'cert.pem')
  const opensslConf = path.join(runtimeRoot, 'etc', 'tls', 'openssl.cnf')
  const certDir = path.join(runtimeRoot, 'etc', 'ssl', 'certs')
  const isPythonRuntime = path.basename(executable).toLowerCase().startsWith('python')

  nextEnv.PATH = prependPath(nextEnv.PATH, runtimeBinDir)
  if (fs.existsSync(runtimeLibDir)) {
    nextEnv.LD_LIBRARY_PATH = prependPath(nextEnv.LD_LIBRARY_PATH, runtimeLibDir)
  }
  ensureDirectory(runtimeHomeDir)
  nextEnv.HOME = nextEnv.HOME || runtimeHomeDir
  if (fs.existsSync(certFile)) {
    nextEnv.SSL_CERT_FILE = certFile
    nextEnv.NODE_EXTRA_CA_CERTS = certFile
  }
  if (fs.existsSync(opensslConf)) {
    nextEnv.OPENSSL_CONF = opensslConf
  }
  if (fs.existsSync(certDir)) {
    nextEnv.SSL_CERT_DIR = certDir
  }
  if (isPythonRuntime) {
    const matplotlibConfigDir = path.join(runtimeVarDir, 'matplotlib')
    const pipCacheDir = path.join(runtimeVarDir, 'pip-cache')
    ensureDirectory(matplotlibConfigDir)
    ensureDirectory(pipCacheDir)
    nextEnv.PYTHONHOME = runtimeRoot
    nextEnv.MPLBACKEND = nextEnv.MPLBACKEND || 'Agg'
    nextEnv.MPLCONFIGDIR = nextEnv.MPLCONFIGDIR || matplotlibConfigDir
    nextEnv.PIP_CACHE_DIR = nextEnv.PIP_CACHE_DIR || pipCacheDir
  }
  return nextEnv
}

const wrapWithAndroidLinker = (executable, args) => {
  const linkerCandidates = ['/system/bin/linker64', '/apex/com.android.runtime/bin/linker64']
  const linker = linkerCandidates.find((candidate) => fs.existsSync(candidate))
  if (!linker) {
    return { executable, args }
  }
  return {
    executable: linker,
    args: [executable, ...args],
  }
}

const buildSessionFiles = (runtime, label) => {
  const fileToken = `${sanitizePart(runtime)}-${sanitizePart(label || '__default__')}`
  return {
    stdoutPath: path.join(STATE_DIR, `${fileToken}.stdout.log`),
    stderrPath: path.join(STATE_DIR, `${fileToken}.stderr.log`),
  }
}

const output = (payload, exitCode = 0) => {
  process.stdout.write(`${JSON.stringify(payload)}\n`)
  process.exit(exitCode)
}

const run = async () => {
  const args = parseArgv(process.argv.slice(2))
  const mode = String(args.mode || '').trim().toLowerCase()
  const runtime = String(args.runtime || '').trim().toLowerCase()
  const label = typeof args.label === 'string' && args.label.trim() ? args.label.trim() : ''
  const sessionId = buildSessionId(runtime, label)
  const waitMs = Math.max(0, toInt(args['wait-ms'], DEFAULT_WAIT_MS))

  if (mode !== 'command' && mode !== 'view') {
    throw new Error('mode must be command or view')
  }
  if (runtime !== 'node' && runtime !== 'python') {
    throw new Error('runtime must be node or python')
  }

  const state = readState()
  const previousSession = state.sessions[sessionId]

  if (mode === 'command') {
    const commandText = typeof args.command === 'string' ? args.command : ''
    if (!commandText.trim()) {
      throw new Error('command mode requires --command')
    }

    if (previousSession?.pid) {
      await terminate(previousSession.pid)
    }

    const launch = buildRuntimeLaunch(runtime, commandText)
    const files = buildSessionFiles(runtime, label)
    fs.writeFileSync(files.stdoutPath, '', 'utf8')
    fs.writeFileSync(files.stderrPath, '', 'utf8')

    const stdoutFd = fs.openSync(files.stdoutPath, 'a')
    const stderrFd = fs.openSync(files.stderrPath, 'a')
    const launchCommand = wrapWithAndroidLinker(launch.executable, launch.args)
    const child = spawn(launchCommand.executable, launchCommand.args, {
      cwd: process.cwd(),
      detached: true,
      stdio: ['ignore', stdoutFd, stderrFd],
      env: buildRuntimeEnvironment(launch.executable, process.env),
    })
    child.unref()
    fs.closeSync(stdoutFd)
    fs.closeSync(stderrFd)

    const startedAt = Date.now()
    state.sessions[sessionId] = {
      sessionId,
      runtime,
      label,
      pid: child.pid,
      command: commandText,
      stdoutPath: files.stdoutPath,
      stderrPath: files.stderrPath,
      startedAt,
      updatedAt: startedAt,
    }
    writeState(state)

    const waitUntil = Date.now() + waitMs
    while (Date.now() < waitUntil && isAlive(child.pid)) {
      await sleep(120)
    }

    const running = isAlive(child.pid)
    state.sessions[sessionId].updatedAt = Date.now()
    writeState(state)
    output({
      ok: true,
      mode,
      runtime,
      label: label || null,
      sessionId,
      running,
      pid: child.pid,
      command: commandText,
      startedAt,
      updatedAt: state.sessions[sessionId].updatedAt,
      stdout: readTail(files.stdoutPath),
      stderr: readTail(files.stderrPath),
      waitedMs: waitMs,
    })
    return
  }

  if (!previousSession) {
    output(
      {
        ok: false,
        mode,
        runtime,
        label: label || null,
        sessionId,
        error: 'session not found',
      },
      1,
    )
    return
  }

  const viewWaitMs = Math.max(0, waitMs)
  const waitUntil = Date.now() + viewWaitMs
  while (Date.now() < waitUntil && isAlive(previousSession.pid)) {
    await sleep(120)
  }

  const running = isAlive(previousSession.pid)
  previousSession.updatedAt = Date.now()
  state.sessions[sessionId] = previousSession
  writeState(state)

  output({
    ok: true,
    mode,
    runtime,
    label: label || null,
    sessionId,
    running,
    pid: previousSession.pid,
    command: previousSession.command,
    startedAt: previousSession.startedAt,
    updatedAt: previousSession.updatedAt,
    stdout: readTail(previousSession.stdoutPath),
    stderr: readTail(previousSession.stderrPath),
    waitedMs: viewWaitMs,
  })
}

run().catch((error) => {
  output(
    {
      ok: false,
      error: error instanceof Error ? error.message : 'runtime-shell failed',
    },
    1,
  )
})
