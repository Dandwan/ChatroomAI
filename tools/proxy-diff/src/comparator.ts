import { diffJson, diffWords } from 'diff';
import type { PendingSession, DiffResult } from './types.js';

/**
 * Compare CPA and ActiNet results for one session across all recorded stages.
 * Produces a structured DiffResult with endpoint, body, timing, and error comparisons.
 */
export function compareSession(session: PendingSession): DiffResult {
  const result: DiffResult = {
    sessionId: session.id,
    userRequest: session.userRequest,
    sameEndpoint: false,
    sameResponse: false,
  };

  // ── Stage A: Endpoint comparison (CPA vs ActiNet upstream targets) ──
  if (session.cpaTransaction) {
    result.cpaUpstreamEndpoint = {
      method: session.cpaTransaction.method,
      path: session.cpaTransaction.path,
    };
  }
  if (session.actiNetTransaction) {
    result.actiNetUpstreamEndpoint = {
      method: session.actiNetTransaction.method,
      path: session.actiNetTransaction.path,
    };
  }

  if (
    result.cpaUpstreamEndpoint &&
    result.actiNetUpstreamEndpoint &&
    result.cpaUpstreamEndpoint.method === result.actiNetUpstreamEndpoint.method &&
    result.cpaUpstreamEndpoint.path === result.actiNetUpstreamEndpoint.path
  ) {
    result.sameEndpoint = true;
  }

  // ── Stage B: Upstream request body diff (CPA vs ActiNet translated requests) ──
  if (session.cpaTransaction?.body && session.actiNetTransaction?.body) {
    try {
      const cpaParsed = JSON.parse(session.cpaTransaction.body);
      const actiParsed = JSON.parse(session.actiNetTransaction.body);
      const cpaPretty = JSON.stringify(cpaParsed, null, 2);
      const actiPretty = JSON.stringify(actiParsed, null, 2);
      if (cpaPretty !== actiPretty) {
        result.requestBodyDiff = buildUnifiedDiff(
          cpaPretty,
          actiPretty,
          'CPA upstream body',
          'ActiNet upstream body',
        );
      }
    } catch {
      // Raw text diff if not valid JSON
      if (session.cpaTransaction.body !== session.actiNetTransaction.body) {
        result.requestBodyDiff = buildUnifiedDiff(
          session.cpaTransaction.body,
          session.actiNetTransaction.body,
          'CPA upstream body',
          'ActiNet upstream body',
        );
      }
    }
  }

  // ── Stage C: Final response body diff (CPA vs ActiNet final responses) ──
  if (session.cpaFinalResponse?.body && session.actiNetFinalResponse?.body) {
    const cpaBody = session.cpaFinalResponse.body;
    const actiBody = session.actiNetFinalResponse.body;

    if (typeof cpaBody === 'object' && typeof actiBody === 'object') {
      const cpaPretty = JSON.stringify(cpaBody, null, 2);
      const actiPretty = JSON.stringify(actiBody, null, 2);
      if (cpaPretty !== actiPretty) {
        result.responseBodyDiff = buildUnifiedDiff(
          cpaPretty,
          actiPretty,
          'CPA final response',
          'ActiNet final response',
        );
      } else {
        result.sameResponse = true;
      }
    } else if (typeof cpaBody === 'string' && typeof actiBody === 'string') {
      if (cpaBody !== actiBody) {
        result.responseBodyDiff = buildUnifiedDiff(
          cpaBody,
          actiBody,
          'CPA final response',
          'ActiNet final response',
        );
      } else {
        result.sameResponse = true;
      }
    } else {
      const cpaStr = JSON.stringify(cpaBody, null, 2);
      const actiStr = JSON.stringify(actiBody, null, 2);
      if (cpaStr !== actiStr) {
        result.responseBodyDiff = buildUnifiedDiff(
          cpaStr,
          actiStr,
          'CPA final response',
          'ActiNet final response',
        );
      } else {
        result.sameResponse = true;
      }
    }
  } else if (session.cpaFinalResponse && !session.actiNetFinalResponse) {
    result.actiNetError = 'No final response received';
  } else if (!session.cpaFinalResponse && session.actiNetFinalResponse) {
    result.cpaError = 'No final response received';
  }

  // ── Stage D: Timing comparison ──
  if (session.cpaUpstreamArrivedAt && session.actiNetUpstreamArrivedAt) {
    result.cpaLatencyMs = session.cpaUpstreamArrivedAt - session.startedAt;
    result.actiNetLatencyMs = session.actiNetUpstreamArrivedAt - session.startedAt;
  }

  // ── Stage E: Error summary ──
  if (session.error) {
    result.upstreamError = session.error;
  }
  if (
    session.cpaFinalResponse?.status &&
    session.cpaFinalResponse.status >= 400
  ) {
    result.cpaError = `HTTP ${session.cpaFinalResponse.status}: ${JSON.stringify(session.cpaFinalResponse.body)}`;
  }
  if (
    session.actiNetFinalResponse?.status &&
    session.actiNetFinalResponse.status >= 400
  ) {
    result.actiNetError = `HTTP ${session.actiNetFinalResponse.status}: ${JSON.stringify(session.actiNetFinalResponse.body)}`;
  }

  return result;
}

function buildUnifiedDiff(
  a: string,
  b: string,
  _labelA: string,
  _labelB: string,
): string {
  // Try diffJson for structured comparison if both are valid JSON objects
  let aObj: unknown;
  let bObj: unknown;
  try {
    aObj = JSON.parse(a);
  } catch {
    aObj = null;
  }
  try {
    bObj = JSON.parse(b);
  } catch {
    bObj = null;
  }

  if (
    aObj &&
    bObj &&
    typeof aObj === 'object' &&
    typeof bObj === 'object'
  ) {
    const changes = diffJson(aObj as object, bObj as object);
    return changes
      .map((part) => {
        const prefix = part.added ? '+' : part.removed ? '-' : ' ';
        return part.value
          .split('\n')
          .map((line: string) => `${prefix} ${line}`)
          .join('\n');
      })
      .join('');
  }

  // Fallback: word diff
  const changes = diffWords(a, b);
  return changes
    .map((part) => {
      if (part.added) return `+ ${part.value}`;
      if (part.removed) return `- ${part.value}`;
      return `  ${part.value}`;
    })
    .join('');
}

/** Run comparison on all sessions and return sorted results. */
export function compareAll(sessions: PendingSession[]): DiffResult[] {
  return sessions.map(compareSession);
}
