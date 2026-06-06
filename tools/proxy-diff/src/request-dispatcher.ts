import type {
  UserRequest,
  FinalResponse,
  ProxyDiffConfig,
  PendingSession,
  CapturedHttpTransaction,
  UpstreamResponse,
} from './types.js'
import { sessionRegistry } from './upstream-simulator.js'
import { createLogger } from './logger.js'

const log = createLogger('dispatcher')

/**
 * Send the user's request to a proxy (CPA or ActiNet) and return its final response.
 *
 * The proxy will translate the request and forward to its configured upstream
 * (our upstream simulator), which suspends the response until the real upstream
 * replies.
 */
async function sendToProxy(
  target: { baseUrl: string; apiKey: string },
  request: UserRequest,
  sessionId: string,
  source: 'cpa' | 'actinet',
): Promise<FinalResponse> {
  const base = target.baseUrl.replace(/\/+$/, '')
  const url = `${base}${request.path}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${target.apiKey}`,
    ...request.headers,
  }

  // Add session tracking headers (best-effort — proxies may or may not forward these)
  // Even if they don't forward them, we use sessionRegistry for correlation.
  headers['x-proxy-diff-session'] = sessionId
  headers['x-proxy-diff-source'] = source

  const body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body)

  log.info(`Sending ${request.method} ${url} to ${source} (stream=${request.stream ?? false})`)

  const startTime = Date.now()

  try {
    // Register expectation BEFORE sending so the upstream simulator knows what to expect
    if (source === 'cpa') {
      sessionRegistry.expectCpa(sessionRegistry.get(sessionId)!)
    } else {
      sessionRegistry.expectActiNet(sessionRegistry.get(sessionId)!)
    }

    const resp = await fetch(url, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? body : undefined,
      signal: AbortSignal.timeout(120_000), // 2-minute timeout
    })

    const latencyMs = Date.now() - startTime
    const respHeaders: Record<string, string> = {}
    resp.headers.forEach((val, key) => {
      respHeaders[key] = val
    })

    let respBody: unknown
    const respText = await resp.text()

    try {
      respBody = JSON.parse(respText)
    } catch {
      respBody = respText
    }

    log.info(`Got response from ${source}: ${resp.status} in ${latencyMs}ms`)

    return {
      status: resp.status,
      headers: respHeaders,
      body: respBody,
    }
  } catch (err) {
    const latencyMs = Date.now() - startTime
    const msg = err instanceof Error ? err.message : String(err)
    log.error(`Request to ${source} failed: ${msg}`)

    return {
      status: 502,
      headers: {},
      body: { error: msg },
    }
  }
}

/**
 * Dispatch a user request to both CPA and ActiNet, and wait for both to complete.
 *
 * The flow:
 * 1. Send to CPA (blocks until CPA's upstream request arrives at simulator, gets real upstream response, CPA translates back)
 * 2. Send to ActiNet (same flow)
 *
 * Note: requests are sent sequentially because the upstream simulator expects
 * one source at a time. The timing of each is still independently measured.
 */
export async function dispatchRequest(
  config: ProxyDiffConfig,
  session: PendingSession,
): Promise<void> {
  const { cpa, actiNet } = config

  // Fire both requests concurrently
  const [cpaResp, actiResp] = await Promise.all([
    sendToProxy(
      { baseUrl: cpa.baseUrl, apiKey: cpa.apiKey },
      session.userRequest,
      session.id,
      'cpa',
    ),
    sendToProxy(
      { baseUrl: actiNet.baseUrl, apiKey: actiNet.apiKey },
      session.userRequest,
      session.id,
      'actinet',
    ),
  ])

  session.cpaFinalResponse = cpaResp
  session.actiNetFinalResponse = actiResp
  session.completedAt = Date.now()
  session.status = 'complete'

  log.info(`Session ${session.id} complete — CPA: ${cpaResp.status}, ActiNet: ${actiResp.status}`)
}
