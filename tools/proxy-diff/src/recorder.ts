import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { PendingSession, RunRecord, ProxyDiffConfig } from './types.js'
import { createLogger } from './logger.js'

const log = createLogger('recorder')

let runRecord: RunRecord | null = null
let outputDir = ''

/** Initialise a new run record. */
export function initRecorder(config: ProxyDiffConfig): void {
  outputDir = join(
    config.testSuite.outputDir,
    new Date().toISOString().replace(/[:.]/g, '-'),
  )
  mkdirSync(outputDir, { recursive: true })
  mkdirSync(join(outputDir, 'raw'), { recursive: true })

  runRecord = {
    config,
    sessions: [],
    diffs: [],
    startedAt: new Date().toISOString(),
  }
  log.info(`Recording to ${outputDir}`)
}

/** Add a completed session to the run record and save raw data. */
export function recordSession(session: PendingSession): void {
  if (!runRecord) return

  runRecord.sessions.push(session)

  // Save raw data per session
  const rawDir = join(outputDir, 'raw')
  const prefix = session.id

  // User request
  writeFileSync(
    join(rawDir, `${prefix}-user-request.json`),
    JSON.stringify(session.userRequest, null, 2),
  )

  // CPA upstream transaction
  if (session.cpaTransaction) {
    writeFileSync(
      join(rawDir, `${prefix}-cpa-upstream.json`),
      JSON.stringify(session.cpaTransaction, null, 2),
    )
  }

  // ActiNet upstream transaction
  if (session.actiNetTransaction) {
    writeFileSync(
      join(rawDir, `${prefix}-actinet-upstream.json`),
      JSON.stringify(session.actiNetTransaction, null, 2),
    )
  }

  // CPA final response
  if (session.cpaFinalResponse) {
    writeFileSync(
      join(rawDir, `${prefix}-cpa-final.json`),
      JSON.stringify(session.cpaFinalResponse, null, 2),
    )
  }

  // ActiNet final response
  if (session.actiNetFinalResponse) {
    writeFileSync(
      join(rawDir, `${prefix}-actinet-final.json`),
      JSON.stringify(session.actiNetFinalResponse, null, 2),
    )
  }

  // Real upstream response
  if (session.realUpstreamResponse) {
    writeFileSync(
      join(rawDir, `${prefix}-upstream-response.txt`),
      session.realUpstreamResponse.body,
    )
  }
}

/** Finalize the run and write the master record. */
export function finalizeRun(diffs: RunRecord['diffs']): string {
  if (!runRecord) throw new Error('Recorder not initialized')

  runRecord.diffs = diffs
  runRecord.completedAt = new Date().toISOString()

  const path = join(outputDir, 'run-record.json')
  writeFileSync(path, JSON.stringify(runRecord, null, 2))
  log.info(`Run record saved to ${path}`)
  return outputDir
}

export function getOutputDir(): string {
  return outputDir
}
