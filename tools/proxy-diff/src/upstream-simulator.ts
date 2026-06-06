import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createLogger } from './logger.js';
import type {
  ProxyDiffConfig,
  PendingSession,
  CapturedHttpTransaction,
  UpstreamResponse,
  UpstreamRelayResponse,
} from './types.js';

const log = createLogger('upstream-sim');

/**
 * Session registry — matches incoming upstream requests from CPA/ActiNet
 * to the currently active test session. Uses a single-slot-per-source model:
 * at most one session is "waiting for CPA" and one "waiting for ActiNet"
 * at any given time. This avoids needing CPA/ActiNet to forward custom headers.
 */
class SessionRegistry {
  private waitingForCpa: PendingSession | null = null;
  private waitingForActiNet: PendingSession | null = null;
  private sessionById = new Map<string, PendingSession>();

  register(session: PendingSession): void {
    this.sessionById.set(session.id, session);
  }

  expectCpa(session: PendingSession): void {
    this.waitingForCpa = session;
  }

  expectActiNet(session: PendingSession): void {
    this.waitingForActiNet = session;
  }

  matchIncoming(source: 'cpa' | 'actinet'): PendingSession | null {
    if (source === 'cpa') return this.waitingForCpa;
    return this.waitingForActiNet;
  }

  clearExpectation(source: 'cpa' | 'actinet'): void {
    if (source === 'cpa') {
      this.waitingForCpa = null;
    } else {
      this.waitingForActiNet = null;
    }
  }

  get(id: string): PendingSession | undefined {
    return this.sessionById.get(id);
  }

  /** Remove all registrations — used for cleanup. */
  clear(): void {
    this.waitingForCpa = null;
    this.waitingForActiNet = null;
    this.sessionById.clear();
  }
}

export const sessionRegistry = new SessionRegistry();

/** Headers to strip when recording (hop-by-hop or internal). */
const STRIP_HEADERS = new Set([
  'host',
  'connection',
  'transfer-encoding',
  'content-length',
  'keep-alive',
  'x-proxy-diff-session',
  'x-proxy-diff-source',
]);

function filterHeaders(headers: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(headers)) {
    if (STRIP_HEADERS.has(key.toLowerCase())) continue;
    if (val === undefined) continue;
    out[key] = Array.isArray(val) ? val.join(', ') : String(val);
  }
  return out;
}

/**
 * Create the upstream simulator Express app.
 *
 * This is a wildcard HTTP server acting as the "fake upstream" for both
 * CPA and ActiNet. It captures their upstream HTTP transactions verbatim
 * (method, path, headers, body — zero format assumptions), suspends
 * the HTTP response until the real upstream responds, then relays
 * the real upstream response back.
 *
 * Every hop is recorded with its endpoint and complete raw content.
 */
export function createUpstreamSimulator(
  config: ProxyDiffConfig,
  forwardToRealUpstream: (tx: CapturedHttpTransaction) => Promise<UpstreamResponse>,
): express.Express {
  const app = express();

  // Use text parser so req.body is always a plain string (regardless of Content-Type)
  app.use(express.text({ type: '*/*', limit: '16mb' }));

  // ── Wildcard catch-all: handles ANY HTTP method + ANY path ──
  app.use(async (req: Request, res: Response) => {
    const rawBody: string =
      typeof req.body === 'string'
        ? req.body
        : req.body
          ? JSON.stringify(req.body)
          : '';

    log.debug(`Incoming: ${req.method} ${req.path} (${rawBody.length} bytes)`);

    // Match to a session by expected source order.
    let source: 'cpa' | 'actinet';
    let session: PendingSession | null;

    session = sessionRegistry.matchIncoming('cpa');
    if (session) {
      source = 'cpa';
      sessionRegistry.clearExpectation('cpa');
    } else {
      session = sessionRegistry.matchIncoming('actinet');
      if (session) {
        source = 'actinet';
        sessionRegistry.clearExpectation('actinet');
      } else {
        // No pending test session — return a valid response so the upstream
        // doesn't get marked unhealthy.
        if (req.path === '/v1/models' || req.path === '/models') {
          res.json({ object: 'list', data: [{ id: 'proxy-diff-upstream', object: 'model' }] });
          return;
        }
        // For chat completions without a test session, return a friendly 200
        res.json({
          id: 'no-session',
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'proxy-diff-upstream',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'No active test session' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        });
        return;
      }
    }

    // ── Record point 3a/3b: capture the transaction verbatim ──
    const tx: CapturedHttpTransaction = {
      source,
      method: req.method,
      path: req.path,
      headers: filterHeaders((req.headers ?? {}) as Record<string, unknown>),
      body: rawBody,
    };

    // Attach to session
    if (source === 'cpa') {
      session.cpaTransaction = tx;
      session.cpaUpstreamArrivedAt = Date.now();
      log.info(`CPA upstream: ${tx.method} ${tx.path} (body ${tx.body.length}B)`);
    } else {
      session.actiNetTransaction = tx;
      session.actiNetUpstreamArrivedAt = Date.now();
      log.info(`ActiNet upstream: ${tx.method} ${tx.path} (body ${tx.body.length}B)`);
    }

    // Both sides arrived?
    if (session.cpaTransaction && session.actiNetTransaction) {
      log.info('Both proxies forwarded — relaying via real upstream');

      const chosen =
        config.proxy.forwardSource === 'cpa'
          ? session.cpaTransaction
          : session.actiNetTransaction;

      try {
        const upstreamResp: UpstreamResponse = await forwardToRealUpstream(chosen);

        // ── Record point 4: real upstream response (complete) ──
        session.realUpstreamResponse = upstreamResp;
        session.upstreamResolvedAt = Date.now();

        // ── Record point 5a/5b: relay response to CPA and ActiNet ──
        const relayResponse: UpstreamRelayResponse = {
          status: upstreamResp.status,
          headers: { ...upstreamResp.headers },
          body: upstreamResp.body,
        };
        session.cpaRelayResponse = relayResponse;
        session.actiNetRelayResponse = relayResponse;

        // Relay to both proxies — set headers from real upstream
        for (const [key, val] of Object.entries(upstreamResp.headers)) {
          res.setHeader(key, val);
        }

        // For the other proxy (which is waiting on its own Express Response),
        // we need to find and respond to it. Since we're inside the handler for
        // whichever proxy arrived second, `res` is that proxy's connection.
        // The first proxy's Express Response is stored on the session.
        //
        // Actually both proxies' connections are still open. We're inside
        // the handler of the LAST one to arrive. We respond to THIS connection
        // via `res`, and the other connection is still suspended — we need to
        // track both Express Response objects.
        //
        // Simple approach: store the Express Response on the session when each
        // arrives, then respond to both when the upstream replies.

        // We need to track Express Response objects per-source. Add them as
        // temporary non-serialized fields on the session.
        const sess = session as PendingSession & {
          _cpaRes?: Response;
          _actiRes?: Response;
        };

        // Store this response
        if (source === 'cpa') {
          sess._cpaRes = res;
        } else {
          sess._actiRes = res;
        }

        const cpaRes = sess._cpaRes;
        const actiRes = sess._actiRes;

        // Set headers on both
        for (const [key, val] of Object.entries(upstreamResp.headers)) {
          if (cpaRes && !cpaRes.headersSent) cpaRes.setHeader(key, val);
          if (actiRes && !actiRes.headersSent) actiRes.setHeader(key, val);
        }

        // Respond to both
        if (cpaRes && !cpaRes.headersSent) {
          cpaRes.status(upstreamResp.status).send(upstreamResp.body);
        }
        if (actiRes && !actiRes.headersSent) {
          actiRes.status(upstreamResp.status).send(upstreamResp.body);
        }

        log.info('Upstream response relayed to CPA and ActiNet');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`Real upstream failed: ${msg}`);
        session.status = 'error';
        session.error = msg;

        const sess = session as PendingSession & {
          _cpaRes?: Response;
          _actiRes?: Response;
        };
        if (source === 'cpa') {
          sess._cpaRes = res;
        } else {
          sess._actiRes = res;
        }

        const cpaRes = sess._cpaRes;
        const actiRes = sess._actiRes;

        if (cpaRes && !cpaRes.headersSent) {
          cpaRes.status(502).json({ error: 'Upstream forwarding failed' });
        }
        if (actiRes && !actiRes.headersSent) {
          actiRes.status(502).json({ error: 'Upstream forwarding failed' });
        }
      }
    } else {
      // First proxy arrived — store its Express Response and wait for the second
      const sess = session as PendingSession & {
        _cpaRes?: Response;
        _actiRes?: Response;
      };
      if (source === 'cpa') {
        sess._cpaRes = res;
      } else {
        sess._actiRes = res;
      }
      log.info(`${source === 'cpa' ? 'CPA' : 'ActiNet'} arrived first — waiting for the other proxy`);
      // Express keeps this connection open — we'll call res.send() when the second arrives.
    }
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    log.error(`Unhandled error: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal upstream simulator error' });
    }
  });

  return app;
}

/** Start the upstream simulator and return the HTTP server instance. */
export function startUpstreamSimulator(
  app: express.Express,
  port: number,
): Promise<ReturnType<typeof app.listen>> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      log.info(`Upstream simulator listening on port ${port} (ALL methods, ALL paths)`);
      resolve(server);
    });
    server.on('error', reject);
  });
}
