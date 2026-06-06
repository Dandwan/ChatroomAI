import { fetch as undiciFetch, ProxyAgent } from 'undici'
import type { CapturedHttpTransaction, ProxyDiffConfig } from './types.js'
import { createLogger } from './logger.js'

const log = createLogger('forwarder')

/**
 * Forward a captured HTTP transaction to the real upstream via mihomo proxy.
 *
 * Uses the EXACT same method, path, headers, and body that CPA/ActiNet sent
 * to the upstream simulator. No format parsing or transformation.
 */
export async function forwardToRealUpstream(
  tx: CapturedHttpTransaction,
  realUpstreamBaseUrl: string,
  mihomoUrl: string,
  realUpstreamApiKey?: string,
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const upstreamBase = realUpstreamBaseUrl.replace(/\/+$/, '')
  const targetUrl = `${upstreamBase}${tx.path}`

  log.info(`Forwarding to real upstream: ${tx.method} ${targetUrl}`)

  // Clean headers: remove hop-by-hop, add auth if configured
  const forwardHeaders: Record<string, string> = { ...tx.headers }

  // Remove headers that should not be forwarded
  const stripKeys = ['host', 'connection', 'transfer-encoding', 'content-length', 'x-proxy-diff-session', 'x-proxy-diff-source']
  for (const key of stripKeys) {
    delete forwardHeaders[key]
    // Also try lowercase
    delete forwardHeaders[key.toLowerCase()]
  }

  // Override auth if configured
  if (realUpstreamApiKey) {
    forwardHeaders['authorization'] = `Bearer ${realUpstreamApiKey}`
  }

  const startTime = Date.now()

  try {
    // Use undici ProxyAgent for mihomo (SOCKS5/HTTP proxy)
    const proxyAgent = new ProxyAgent(mihomoUrl)

    const resp = await undiciFetch(targetUrl, {
      method: tx.method,
      headers: forwardHeaders,
      body: tx.method !== 'GET' && tx.method !== 'HEAD' ? tx.body : undefined,
      dispatcher: proxyAgent,
      signal: AbortSignal.timeout(120_000),
    })

    const respHeaders: Record<string, string> = {}
    resp.headers.forEach((val, key) => {
      respHeaders[key] = val
    })

    const body = await resp.text()
    const latencyMs = Date.now() - startTime

    log.info(`Real upstream responded: ${resp.status} in ${latencyMs}ms (${body.length} bytes)`)

    return {
      status: resp.status,
      headers: respHeaders,
      body,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error(`Real upstream request failed: ${msg}`)
    throw err
  }
}
