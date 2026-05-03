const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const DEFAULT_BROWSER_TIMEOUT_MS = 20000
const DEFAULT_VIRTUAL_TIME_BUDGET_MS = 8000

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? fallback), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function getNested(source, pathSegments, fallback) {
  let current = source
  for (const segment of pathSegments) {
    if (!isRecord(current) || !(segment in current)) {
      return fallback
    }
    current = current[segment]
  }
  return current === undefined ? fallback : current
}

function uniqueItems(items) {
  return Array.from(new Set(items.filter(Boolean)))
}

function isAbsoluteExecutable(value) {
  return /^(?:[A-Za-z]:[\\/]|\/)/.test(String(value || ''))
}

function getConfiguredExecutable(config, options) {
  const cliExecutable = normalizeWhitespace(options && options.browserExecutable)
  if (cliExecutable) {
    return cliExecutable
  }

  const envExecutable =
    normalizeWhitespace(process.env.UNION_SEARCH_BROWSER_EXECUTABLE) ||
    normalizeWhitespace(process.env.CHROME_PATH) ||
    normalizeWhitespace(process.env.EDGE_PATH)
  if (envExecutable) {
    return envExecutable
  }

  const configExecutable =
    normalizeWhitespace(getNested(config, ['fetchUrl', 'browserExecutable'], '')) ||
    normalizeWhitespace(getNested(config, ['fetchUrl', 'browserExecutablePath'], ''))
  if (configExecutable) {
    return configExecutable
  }

  return ''
}

function getBrowserCandidates() {
  if (process.platform === 'win32') {
    return uniqueItems([
      path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ])
  }

  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      'google-chrome',
      'chromium',
      'microsoft-edge',
      'msedge',
    ]
  }

  return [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
    'microsoft-edge',
    'msedge',
  ]
}

function resolveBrowserExecutable(config, options) {
  const configured = getConfiguredExecutable(config, options)
  if (configured) {
    if (isAbsoluteExecutable(configured) && !fs.existsSync(configured)) {
      throw new Error(`Configured browser executable does not exist: ${configured}`)
    }
    return configured
  }

  const candidates = getBrowserCandidates()
  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }
    if (!isAbsoluteExecutable(candidate) || fs.existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    'No supported browser executable found for visit_url --extract browser. Set UNION_SEARCH_BROWSER_EXECUTABLE to Chrome or Edge.',
  )
}

function collectBrowserArguments(config) {
  const raw = getNested(config, ['fetchUrl', 'browserArguments'], [])
  return Array.isArray(raw)
    ? raw.map((item) => normalizeWhitespace(item)).filter(Boolean)
    : []
}

function runBrowserDump(executable, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    const stdoutChunks = []
    const stderrChunks = []
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.stdout.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)))
    child.stderr.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)))
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const stdout = Buffer.concat(stdoutChunks).toString('utf8')
      const stderr = Buffer.concat(stderrChunks).toString('utf8')
      if (timedOut) {
        reject(new Error(`Browser DOM capture timed out after ${timeoutMs}ms`))
        return
      }
      if (code !== 0) {
        reject(
          new Error(
            `Browser DOM capture failed with exit code ${code}${
              stderr ? `: ${stderr.trim()}` : ''
            }`,
          ),
        )
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

async function fetchRenderedHtmlWithBrowser(url, config, options) {
  const executable = resolveBrowserExecutable(config, options)
  const virtualTimeBudgetMs = parsePositiveInt(
    options && options.browserVirtualTimeBudgetMs,
    getNested(config, ['fetchUrl', 'browserVirtualTimeBudgetMs'], DEFAULT_VIRTUAL_TIME_BUDGET_MS),
  )
  const timeoutMs = Math.max(
    parsePositiveInt(
      getNested(config, ['fetchUrl', 'browserTimeoutMs'], DEFAULT_BROWSER_TIMEOUT_MS),
      DEFAULT_BROWSER_TIMEOUT_MS,
    ),
    parsePositiveInt(options && options.browserTimeoutMs, DEFAULT_BROWSER_TIMEOUT_MS),
  )
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'union-search-browser-'))
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--dump-dom',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--mute-audio',
    '--hide-scrollbars',
    '--window-size=1280,720',
    `--user-data-dir=${profileDir}`,
    `--virtual-time-budget=${virtualTimeBudgetMs}`,
    ...collectBrowserArguments(config),
    url,
  ]

  try {
    const { stdout } = await runBrowserDump(executable, args, timeoutMs)
    const html = String(stdout || '').trim()
    if (!html) {
      throw new Error('Browser DOM capture returned empty HTML')
    }
    return {
      executable,
      finalUrl: url,
      html,
      warnings: [],
    }
  } finally {
    fs.rmSync(profileDir, { recursive: true, force: true })
  }
}

module.exports = {
  fetchRenderedHtmlWithBrowser,
}
