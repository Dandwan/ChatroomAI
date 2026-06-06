import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from './logger.js';
import type { ProxyDiffConfig, PendingSession, RunRecord, DiffResult } from './types.js';

const log = createLogger('recorder');

let runRecord: RunRecord | null = null;
let outputDir = '';

/** Initialise a new run record. */
export function initRecorder(config: ProxyDiffConfig): void {
  outputDir = join(
    config.testSuite.outputDir,
    new Date().toISOString().replace(/[:.]/g, '-'),
  );
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(join(outputDir, 'raw'), { recursive: true });

  runRecord = {
    config,
    sessions: [],
    diffs: [],
    startedAt: new Date().toISOString(),
  };

  log.info(`Recording to ${outputDir}`);
}

/**
 * Add a completed session to the run record and save ALL raw data.
 *
 * Nine (9) files saved per session, covering every recorded hop:
 *
 *   1.  user-request        — original user input
 *   2a. dispatcher-cpa-outbound  — exact HTTP request sent to CPA
 *   2b. dispatcher-actinet-outbound — exact HTTP request sent to ActiNet
 *   3a. cpa-upstream        — CPA's translated upstream request
 *   3b. actinet-upstream    — ActiNet's translated upstream request
 *   4.  real-upstream-response — complete real upstream response (status+headers+body)
 *   5a. upstream-to-cpa     — response relayed back to CPA
 *   5b. upstream-to-actinet — response relayed back to ActiNet
 *   6a. cpa-final           — CPA's final translated response to user
 *   6b. actinet-final       — ActiNet's final translated response to user
 */
export function recordSession(session: PendingSession): void {
  if (!runRecord) return;

  // Store a cleaned copy for the run record (strip non-serializable fields)
  const cleanSession: PendingSession = { ...session };
  runRecord.sessions.push(cleanSession);

  // Save raw data per session
  const rawDir = join(outputDir, 'raw');
  const prefix = session.id;

  // Record point 1: User request
  writeFileSync(
    join(rawDir, `${prefix}-user-request.json`),
    JSON.stringify(session.userRequest, null, 2),
  );

  // Record points 2a/2b: Dispatcher outbound requests
  if (session.cpaOutbound) {
    writeFileSync(
      join(rawDir, `${prefix}-dispatcher-cpa-outbound.json`),
      JSON.stringify(session.cpaOutbound, null, 2),
    );
  }
  if (session.actiNetOutbound) {
    writeFileSync(
      join(rawDir, `${prefix}-dispatcher-actinet-outbound.json`),
      JSON.stringify(session.actiNetOutbound, null, 2),
    );
  }

  // Record points 3a/3b: Upstream transactions (CPA/ActiNet → upstream)
  if (session.cpaTransaction) {
    writeFileSync(
      join(rawDir, `${prefix}-cpa-upstream.json`),
      JSON.stringify(session.cpaTransaction, null, 2),
    );
  }
  if (session.actiNetTransaction) {
    writeFileSync(
      join(rawDir, `${prefix}-actinet-upstream.json`),
      JSON.stringify(session.actiNetTransaction, null, 2),
    );
  }

  // Record point 4: Real upstream response (complete: status + headers + body)
  if (session.realUpstreamResponse) {
    writeFileSync(
      join(rawDir, `${prefix}-real-upstream-response.json`),
      JSON.stringify(session.realUpstreamResponse, null, 2),
    );
  }

  // Record points 5a/5b: Relay responses (upstream simulator → CPA/ActiNet)
  if (session.cpaRelayResponse) {
    writeFileSync(
      join(rawDir, `${prefix}-upstream-to-cpa.json`),
      JSON.stringify(session.cpaRelayResponse, null, 2),
    );
  }
  if (session.actiNetRelayResponse) {
    writeFileSync(
      join(rawDir, `${prefix}-upstream-to-actinet.json`),
      JSON.stringify(session.actiNetRelayResponse, null, 2),
    );
  }

  // Record points 6a/6b: Final responses (CPA/ActiNet → user)
  if (session.cpaFinalResponse) {
    writeFileSync(
      join(rawDir, `${prefix}-cpa-final.json`),
      JSON.stringify(session.cpaFinalResponse, null, 2),
    );
  }
  if (session.actiNetFinalResponse) {
    writeFileSync(
      join(rawDir, `${prefix}-actinet-final.json`),
      JSON.stringify(session.actiNetFinalResponse, null, 2),
    );
  }
}

/** Finalize the run and write the master record. */
export function finalizeRun(diffs: DiffResult[]): string {
  if (!runRecord) throw new Error('Recorder not initialized');

  runRecord.diffs = diffs;
  runRecord.completedAt = new Date().toISOString();

  const path = join(outputDir, 'run-record.json');
  writeFileSync(path, JSON.stringify(runRecord, null, 2));
  log.info(`Run record saved to ${path}`);
  return outputDir;
}

export function getOutputDir(): string {
  return outputDir;
}
