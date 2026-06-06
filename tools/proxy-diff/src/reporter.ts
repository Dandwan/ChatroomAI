import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DiffResult, RunRecord } from './types.js'

/**
 * Generate a terminal-friendly summary of the comparison results.
 */
export function printConsoleReport(diffs: DiffResult[]): void {
  console.log('\n' + '═'.repeat(72))
  console.log('  CPA vs ActiNet — Proxy Translation Diff Report')
  console.log('═'.repeat(72))

  if (diffs.length === 0) {
    console.log('  No test sessions to report.\n')
    return
  }

  for (const diff of diffs) {
    console.log(`\n── Session: ${diff.sessionId} ──`)
    console.log(
      `  Request: ${diff.userRequest.method} ${diff.userRequest.path}`,
    )

    // Endpoint comparison
    const cpaEp = diff.cpaUpstreamEndpoint
      ? `${diff.cpaUpstreamEndpoint.method} ${diff.cpaUpstreamEndpoint.path}`
      : 'N/A'
    const actEp = diff.actiNetUpstreamEndpoint
      ? `${diff.actiNetUpstreamEndpoint.method} ${diff.actiNetUpstreamEndpoint.path}`
      : 'N/A'

    console.log(`  CPA upstream endpoint:    ${cpaEp}`)
    console.log(`  ActiNet upstream endpoint: ${actEp}`)
    console.log(
      `  Same endpoint: ${diff.sameEndpoint ? '✅ YES' : '❌ NO — different target!'}`,
    )

    // Request body
    if (diff.requestBodyDiff) {
      console.log(`\n  ── Upstream Request Body Diff ──`)
      console.log(truncate(diff.requestBodyDiff, 1200))
    } else {
      console.log(`  Upstream request body: ✅ Identical`)
    }

    // Response
    if (diff.responseBodyDiff) {
      console.log(`\n  ── Final Response Diff ──`)
      console.log(truncate(diff.responseBodyDiff, 1200))
    } else if (diff.sameResponse) {
      console.log(`  Final response: ✅ Identical`)
    }

    // Timing
    if (diff.cpaLatencyMs !== undefined && diff.actiNetLatencyMs !== undefined) {
      const delta = Math.abs(diff.cpaLatencyMs - diff.actiNetLatencyMs)
      console.log(
        `  Latency: CPA ${diff.cpaLatencyMs}ms | ActiNet ${diff.actiNetLatencyMs}ms | Δ ${delta}ms`,
      )
    }

    // Errors
    if (diff.cpaError) console.log(`  ❌ CPA Error: ${diff.cpaError}`)
    if (diff.actiNetError) console.log(`  ❌ ActiNet Error: ${diff.actiNetError}`)
    if (diff.upstreamError) console.log(`  ❌ Upstream Error: ${diff.upstreamError}`)

    console.log()
  }

  // Summary
  const identicalEndpoints = diffs.filter((d) => d.sameEndpoint).length
  const identicalResponses = diffs.filter((d) => d.sameResponse).length
  const errors = diffs.filter(
    (d) => d.cpaError || d.actiNetError || d.upstreamError,
  ).length

  console.log('═'.repeat(72))
  console.log(`  Sessions: ${diffs.length}`)
  console.log(`  Same endpoint:  ${identicalEndpoints}/${diffs.length}`)
  console.log(`  Same response:  ${identicalResponses}/${diffs.length}`)
  console.log(`  With errors:    ${errors}/${diffs.length}`)
  console.log('═'.repeat(72) + '\n')
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen) + `\n  ... [truncated, ${s.length - maxLen} more chars]`
}

/**
 * Generate a Markdown report file.
 */
export function writeMarkdownReport(runRecord: RunRecord, outputDir: string): string {
  const { sessions, diffs, startedAt, completedAt } = runRecord
  const lines: string[] = []

  lines.push('# CPA vs ActiNet — Proxy Translation Diff Report')
  lines.push('')
  lines.push(`- **Started**: ${startedAt}`)
  lines.push(`- **Completed**: ${completedAt ?? 'N/A'}`)
  lines.push(`- **Sessions**: ${diffs.length}`)
  lines.push(`- **Forward source**: \`${runRecord.config.proxy.forwardSource}\``)
  lines.push(`- **Mihomo proxy**: \`${runRecord.config.proxy.mihomoUrl}\``)
  lines.push('')

  for (let i = 0; i < diffs.length; i++) {
    const diff = diffs[i]
    const session = sessions[i]

    lines.push(`## Session ${i + 1}: \`${diff.sessionId}\``)
    lines.push('')
    lines.push(
      `**Request**: \`${diff.userRequest.method} ${diff.userRequest.path}\``,
    )
    lines.push('')

    // Endpoints
    lines.push('### Upstream Endpoints')
    lines.push('')
    lines.push('| Proxy   | Method | Path |')
    lines.push('|---------|--------|------|')
    lines.push(
      `| CPA     | ${diff.cpaUpstreamEndpoint?.method ?? 'N/A'} | \`${diff.cpaUpstreamEndpoint?.path ?? 'N/A'}\` |`,
    )
    lines.push(
      `| ActiNet | ${diff.actiNetUpstreamEndpoint?.method ?? 'N/A'} | \`${diff.actiNetUpstreamEndpoint?.path ?? 'N/A'}\` |`,
    )
    lines.push('')
    lines.push(
      `**Same endpoint**: ${diff.sameEndpoint ? '✅ Yes' : '❌ No'}`,
    )
    lines.push('')

    // Request body diff
    if (diff.requestBodyDiff) {
      lines.push('### Upstream Request Body Diff')
      lines.push('')
      lines.push('```diff')
      lines.push(truncate(diff.requestBodyDiff, 5000))
      lines.push('```')
      lines.push('')
    } else {
      lines.push('### Upstream Request Body: ✅ Identical')
      lines.push('')
    }

    // Response diff
    if (diff.responseBodyDiff) {
      lines.push('### Final Response Diff')
      lines.push('')
      lines.push('```diff')
      lines.push(truncate(diff.responseBodyDiff, 5000))
      lines.push('```')
      lines.push('')
    } else if (diff.sameResponse) {
      lines.push('### Final Response: ✅ Identical')
      lines.push('')
    }

    // Timing
    if (diff.cpaLatencyMs !== undefined && diff.actiNetLatencyMs !== undefined) {
      lines.push('### Timing')
      lines.push('')
      const delta = Math.abs(diff.cpaLatencyMs - diff.actiNetLatencyMs)
      lines.push('| Proxy   | Latency |')
      lines.push('|---------|---------|')
      lines.push(`| CPA     | ${diff.cpaLatencyMs}ms |`)
      lines.push(`| ActiNet | ${diff.actiNetLatencyMs}ms |`)
      lines.push(`| **Delta** | **${delta}ms** |`)
      lines.push('')
    }

    // Errors
    if (diff.cpaError || diff.actiNetError || diff.upstreamError) {
      lines.push('### Errors')
      lines.push('')
      if (diff.cpaError) lines.push(`- **CPA**: ${diff.cpaError}`)
      if (diff.actiNetError) lines.push(`- **ActiNet**: ${diff.actiNetError}`)
      if (diff.upstreamError) lines.push(`- **Upstream**: ${diff.upstreamError}`)
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  const reportPath = join(outputDir, 'report.md')
  writeFileSync(reportPath, lines.join('\n'))
  return reportPath
}
