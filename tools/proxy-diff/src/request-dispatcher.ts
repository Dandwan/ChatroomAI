import { sessionRegistry } from './upstream-simulator.js';
import { createLogger } from './logger.js';
import type {
  ProxyDiffConfig,
  PendingSession,
  FinalResponse,
  DispatcherOutbound,
} from './types.js';

const log = createLogger('dispatcher');

/**
 * Send the user's request to a proxy (CPA or ActiNet) and return its final response.
 *
 * Records the exact outbound HTTP request before sending (record point 2a/2b).
 * The proxy will translate the request and forward to its configured upstream
 * (our upstream simulator), which suspends the response until the real upstream
 * replies.
 */
async function sendToProxy(
  target: { baseUrl: string; apiKey: string },
  request: PendingSession['userRequest'],
  sessionId: string,
  source: 'cpa' | 'actinet',
): Promise<{ finalResponse: FinalResponse; outbound: DispatcherOutbound }> {
  const base = target.baseUrl.replace(/\/+$/, '');
  const url = `${base}${request.path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${target.apiKey}`,
    ...request.headers,
  };

  // Add session tracking headers (best-effort — proxies may or may not forward these)
  headers['x-proxy-diff-session'] = sessionId;
  headers['x-proxy-diff-source'] = source;

  const body: string =
    typeof request.body === 'string' ? request.body : JSON.stringify(request.body);

  // ── Record point 2a/2b: capture the exact outbound request ──
  const outbound: DispatcherOutbound = {
    source,
    url,
    method: request.method,
    headers: { ...headers },
    body,
  };

  log.info(`Sending ${request.method} ${url} to ${source} (stream=${request.stream ?? false})`);

  const startTime = Date.now();
  try {
    // Register expectation BEFORE sending so the upstream simulator knows what to expect
    if (source === 'cpa') {
      sessionRegistry.expectCpa(sessionRegistry.get(sessionId)!);
    } else {
      sessionRegistry.expectActiNet(sessionRegistry.get(sessionId)!);
    }

    const resp = await fetch(url, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? body : undefined,
      signal: AbortSignal.timeout(120_000), // 2-minute timeout
    });

    const latencyMs = Date.now() - startTime;

    const respHeaders: Record<string, string> = {};
    resp.headers.forEach((val, key) => {
      respHeaders[key] = val;
    });

    let respBody: unknown;
    const respText = await resp.text();
    try {
      respBody = JSON.parse(respText);
    } catch {
      respBody = respText;
    }

    log.info(`Got response from ${source}: ${resp.status} in ${latencyMs}ms`);

    const finalResponse: FinalResponse = {
      status: resp.status,
      headers: respHeaders,
      body: respBody,
    };

    return { finalResponse, outbound };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Request to ${source} failed: ${msg}`);

    const finalResponse: FinalResponse = {
      status: 502,
      headers: {},
      body: { error: msg },
    };

    return { finalResponse, outbound };
  }
}

/**
 * Dispatch a user request to both CPA and ActiNet concurrently, and wait for
 * both to complete.
 *
 * Each proxy translates the request → forwards to upstream simulator (which
 * suspends until the real upstream replies) → receives relayed response →
 * translates back → returns final response.
 *
 * Both outbound requests and both final responses are recorded.
 */
export async function dispatchRequest(
  config: ProxyDiffConfig,
  session: PendingSession,
): Promise<void> {
  const { cpa, actiNet } = config;

  // Fire both requests concurrently
  const [cpaResult, actiResult] = await Promise.all([
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
  ]);

  // ── Store recorded data ──
  session.cpaOutbound = cpaResult.outbound;
  session.actiNetOutbound = actiResult.outbound;
  session.cpaFinalResponse = cpaResult.finalResponse;
  session.actiNetFinalResponse = actiResult.finalResponse;
  session.completedAt = Date.now();
  session.status = 'complete';

  log.info(
    `Session ${session.id} complete — CPA: ${cpaResult.finalResponse.status}, ActiNet: ${actiResult.finalResponse.status}`,
  );
}
