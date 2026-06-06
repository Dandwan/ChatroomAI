import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Command } from 'commander'
import type { PendingSession, UserRequest } from './types.js'
import { loadConfig } from './config.js'
import {
  createUpstreamSimulator,
  startUpstreamSimulator,
  sessionRegistry,
} from './upstream-simulator.js'
import { dispatchRequest } from './request-dispatcher.js'
import { forwardToRealUpstream } from './proxy-forwarder.js'
import { initRecorder, recordSession, finalizeRun, getOutputDir } from './recorder.js'
import { compareAll } from './comparator.js'
import { printConsoleReport, writeMarkdownReport } from './reporter.js'
import { createLogger } from './logger.js'

const log = createLogger('main')

function generateSessionId(): string {
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

async function main() {
  const program = new Command()
    .name('proxy-diff')
    .description('CPA vs ActiNet proxy translation behavior comparison test suite')
    .argument(
      '[request-file]',
      'Path to a JSON file containing the user request ({method, path, headers, body, stream?})',
    )
    .option('-c, --config <path>', 'Path to config file', 'proxy-diff.config.json')
    .option('-s, --stdin', 'Read request from stdin instead of a file')
    .option('-o, --output <dir>', 'Override output directory')
    .option('--cpa-base-url <url>', 'Override CPA base URL')
    .option('--actinet-base-url <url>', 'Override ActiNet base URL')
    .option('--cpa-api-key <key>', 'Override CPA API key')
    .option('--actinet-api-key <key>', 'Override ActiNet API key')
    .option('--mihomo <url>', 'Override mihomo proxy URL')
    .option('--forward-source <source>', 'Which proxy to forward: cpa or actinet', 'cpa')
    .option('--real-upstream <url>', 'Override real upstream base URL')
    .option('--real-upstream-key <key>', 'Override real upstream API key')
    .parse()

  const opts = program.opts()
  const requestFile = program.args[0]

  // ── Load config ──
  const config = loadConfig(opts.config)

  // CLI overrides
  if (opts.cpaBaseUrl) config.cpa.baseUrl = opts.cpaBaseUrl
  if (opts.actinetBaseUrl) config.actiNet.baseUrl = opts.actinetBaseUrl
  if (opts.cpaApiKey) config.cpa.apiKey = opts.cpaApiKey
  if (opts.actinetApiKey) config.actiNet.apiKey = opts.actinetApiKey
  if (opts.mihomo) config.proxy.mihomoUrl = opts.mihomo
  if (opts.forwardSource) {
    if (opts.forwardSource !== 'cpa' && opts.forwardSource !== 'actinet') {
      console.error(`Invalid forward source: ${opts.forwardSource}. Must be 'cpa' or 'actinet'.`)
      process.exit(1)
    }
    config.proxy.forwardSource = opts.forwardSource as 'cpa' | 'actinet'
  }
  if (opts.realUpstream) config.realUpstream.baseUrl = opts.realUpstream
  if (opts.realUpstreamKey) config.realUpstream.apiKey = opts.realUpstreamKey
  if (opts.output) config.testSuite.outputDir = opts.output

  // ── Load user request ──
  let userRequest: UserRequest
  try {
    if (opts.stdin) {
      // Read from stdin
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
      }
      userRequest = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
    } else if (requestFile) {
      const path = resolve(requestFile)
      if (!existsSync(path)) {
        console.error(`Request file not found: ${path}`)
        process.exit(1)
      }
      userRequest = JSON.parse(readFileSync(path, 'utf-8'))
    } else {
      console.error('No request file specified. Provide a file path or use --stdin.')
      console.error('Example: proxy-diff fixtures/openai-basic.json')
      process.exit(1)
    }
  } catch (err) {
    console.error(`Failed to load user request: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }

  // Validate required fields
  if (!userRequest.method || !userRequest.path) {
    console.error('User request must have "method" and "path" fields.')
    process.exit(1)
  }

  log.info(`Loaded request: ${userRequest.method} ${userRequest.path}`)

  // ── Initialize recorder ──
  initRecorder(config)

  // ── Create upstream simulator ──
  const simApp = createUpstreamSimulator(
    config,
    (tx) =>
      forwardToRealUpstream(
        tx,
        config.realUpstream.baseUrl,
        config.proxy.mihomoUrl,
        config.realUpstream.apiKey,
      ),
  )

  const server = await startUpstreamSimulator(simApp, config.testSuite.port)

  // ── Create session and dispatch ──
  const session: PendingSession = {
    id: generateSessionId(),
    userRequest,
    status: 'waiting_cpa',
    startedAt: Date.now(),
  }

  sessionRegistry.register(session)
  log.info(`Session ${session.id} created`)

  try {
    await dispatchRequest(config, session)

    // ── Compare ──
    const diffs = compareAll([session])
    recordSession(session)
    const outputDir = finalizeRun(diffs)

    // ── Report ──
    printConsoleReport(diffs)
    const reportPath = writeMarkdownReport(
      {
        config,
        sessions: [session],
        diffs,
        startedAt: new Date(session.startedAt).toISOString(),
        completedAt: new Date().toISOString(),
      },
      outputDir,
    )
    log.info(`Markdown report saved to ${reportPath}`)
  } catch (err) {
    log.error(`Test failed: ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
  } finally {
    // ── Cleanup ──
    server.close()
    sessionRegistry.clear()
    log.info('Upstream simulator stopped')
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
