import express from 'express'
import type { Request, Response } from 'express'
import type { PendingSession, CapturedHttpTransaction, ProxyDiffConfig } from './types.js'
import { createLogger } from './logger.js'

const log = createLogger('upstream-sim')

/**
 * Session registry — matches incoming upstream requests from CPA/ActiNet
 * to the currently active test session. Uses a single-slot-per-source model:
 * at most one session is "waiting for CPA" and one "waiting for ActiNet"
 * at any given time. This avoids needing CPA/ActiNet to forward custom headers.
 */
class SessionRegistry {
  private waitingForCpa: PendingSession | null = null
  private waitingForActiNet: PendingSession | null = null
  private sessionById = new Map<string, PendingSession>()

  register(session: PendingSession): void {
    this.sessionById.set(session.id, session)
  }

  expectCpa(session: PendingSession): void {
    this.waitingForCpa = session
  }

  expectActiNet(session: PendingSession): void {
    this.waitingForActiNet = session
  }

  matchIncoming(source: 'cpa' | 'actinet'): PendingSession | null {
    if (source === 'cpa') return this.waitingForCpa
    return this.waitingForActiNet
  }

  clearExpectation(source: 'cpa' | 'actinet'): void {
    if (source === 'cpa') {
      this.waitingForCpa = null
    } else {
      this.waitingForActiNet = null
    }
  }

  get(id: string): PendingSession | undefined {
    return this.sessionById.get(id)
  }

  /** Remove all registrations — used for cleanup. */
  clear(): void {
    this.waitingForCpa = null
    this.waitingForActiNet = null
    this.sessionById.clear()
  }
}

export const sessionRegistry = new SessionRegistry()

/** Headers to strip when recording (hop-by-hop or internal). */
const STRIP_HEADERS = new Set([
  'host',
  'connection',
  'transfer-encoding',
  'content-length',
  'keep-alive',
  'x-proxy-diff-session',
  'x-proxy-diff-source',
])

function filterHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, val] of Object.entries(headers)) {
    if (STRIP_HEADERS.has(key.toLowerCase())) continue
    if (val === undefined) continue
    out[key] = Array.isArray(val) ? val.join(', ') : val
  }
  return out
}

/**
 * Create the upstream simulator Express app.
 *
 * This is a wildcard HTTP server acting as the "fake upstream" for both
 * CPA and ActiNet. It captures their upstream HTTP transactions verbatim
 * (method, path, headers, body — zero format assumptions), suspends
 * the HTTP response until the real upstream responds, then relays the real
 * upstream response back.
 */
export function createUpstreamSimulator(
  config: ProxyDiffConfig,
  forwardToRealUpstream: (tx: CapturedHttpTransaction) => Promise<{
    status: number
    headers: Record<string, string>
    body: string
  }>,
): express.Application {
  const app = express()

  // Use text parser so req.body is always a plain string (regardless of Content-Type)
  app.use(express.text({ type: '*/*', limit: '16mb' }))

  // ── Wildcard catch-all: handles ANY HTTP method + ANY path ──
  app.all('*', async (req: Request, res: Response) => {
    const rawBody: string =
      typeof req.body === 'string'
        ? req.body
        : req.body
          ? JSON.stringify(req.body)
          : ''

    log.debug(`Incoming: ${req.method} ${req.path} (${rawBody.length} bytes)`)

    // Match to a session by expected source order
    let source: 'cpa' | 'actinet'
    let session: PendingSession | null

    session = sessionRegistry.matchIncoming('cpa')
    if (session && session.status === 'waiting_cpa') {
      source = 'cpa'
      sessionRegistry.clearExpectation('cpa')
    } else {
      session = sessionRegistry.matchIncoming('actinet')
      if (session && session.status === 'waiting_actinet') {
        source = 'actinet'
        sessionRegistry.clearExpectation('actinet')
      } else {
        log.warn(`Unmatched incoming request: ${req.method} ${req.path}`)
        res.status(503).json({ error: 'No pending test session for this request' })
        return
      }
    }

    const tx: CapturedHttpTransaction = {
      source,
      method: req.method,
      path: req.path,
      headers: filterHeaders(
        (req.headers as Record<string, string | string[] | undefined>) ?? {},
      ),
      body: rawBody,
    }

    // Attach to session
    if (source === 'cpa') {
      session.cpaTransaction = tx
      session.cpaUpstreamRes = res
      session.cpaUpstreamArrivedAt = Date.now()
      log.info(`CPA upstream: ${tx.method} ${tx.path} (body ${tx.body.length}B)`)
    } else {
      session.actiNetTransaction = tx
      session.actiNetUpstreamRes = res
      session.actiNetUpstreamArrivedAt = Date.now()
      log.info(`ActiNet upstream: ${tx.method} ${tx.path} (body ${tx.body.length}B)`)
    }

    // Both sides arrived?
    if (session.cpaTransaction && session.actiNetTransaction) {
      log.info('Both proxies forwarded — relaying via real upstream')

      const chosen =
        config.proxy.forwardSource === 'cpa'
          ? session.cpaTransaction
          : session.actiNetTransaction

      try {
        const upstreamResp = await forwardToRealUpstream(chosen)
        session.realUpstreamResponse = upstreamResp
        session.upstreamResolvedAt = Date.now()

        const cpaRes = session.cpaUpstreamRes as Response | undefined
        const actiRes = session.actiNetUpstreamRes as Response | undefined

        // Relay to both — set headers from real upstream
        for (const [key, val] of Object.entries(upstreamResp.headers)) {
          if (cpaRes) cpaRes.setHeader(key, val)
          if (actiRes) actiRes.setHeader(key, val)
        }

        if (cpaRes && !cpaRes.headersSent) {
          cpaRes.status(upstreamResp.status).send(upstreamResp.body)
        }
        if (actiRes && !actiRes.headersSent) {
          actiRes.status(upstreamResp.status).send(upstreamResp.body)
        }

        log.info('Upstream response relayed to CPA and ActiNet')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        log.error(`Real upstream failed: ${msg}`)
        session.status = 'error'
        session.error = msg

        const cpaRes = session.cpaUpstreamRes as Response | undefined
        const actiRes = session.actiNetUpstreamRes as Response | undefined
        if (cpaRes && !cpaRes.headersSent) {
          cpaRes.status(502).json({ error: 'Upstream forwarding failed' })
        }
        if (actiRes && !actiRes.headersSent) {
          actiRes.status(502).json({ error: 'Upstream forwarding failed' })
        }
      }
    }
    // If the other proxy hasn't forwarded yet, Express keeps this connection
    // open — we'll call res.send() when the second one arrives.
  })

  // Error handler
  app.use(
    (
      err: Error,
      _req: Request,
      res: Response,
      _next: express.NextFunction,
    ) => {
      log.error(`Unhandled error: ${err.message}`)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal upstream simulator error' })
      }
    },
  )

  return app
}

/** Start the upstream simulator and return the HTTP server instance. */
export function startUpstreamSimulator(
  app: express.Application,
  port: number,
): Promise<import('node:http').Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      log.info(`Upstream simulator listening on port ${port} (ALL methods, ALL paths)`)
      resolve(server)
    })
    server.on('error', reject)
  })
}
