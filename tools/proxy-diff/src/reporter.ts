import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DiffResult, RunRecord } from './types.js';

/**
 * Generate a terminal-friendly summary of the comparison results.
 */
export function printConsoleReport(diffs: DiffResult[]): void {
  console.log('\n' + '═'.repeat(72));
  console.log('  CPA vs ActiNet — Proxy Translation Diff Report');
  console.log('═'.repeat(72));

  if (diffs.length === 0) {
    console.log('  No test sessions to report.\n');
    return;
  }

  for (const diff of diffs) {
    console.log(`\n── Session: ${diff.sessionId} ──`);
    console.log(`  Request: ${diff.userRequest.method} ${diff.userRequest.path}`);

    // Endpoint comparison
    const cpaEp = diff.cpaUpstreamEndpoint
      ? `${diff.cpaUpstreamEndpoint.method} ${diff.cpaUpstreamEndpoint.path}`
      : 'N/A';
    const actEp = diff.actiNetUpstreamEndpoint
      ? `${diff.actiNetUpstreamEndpoint.method} ${diff.actiNetUpstreamEndpoint.path}`
      : 'N/A';

    console.log(`  CPA upstream endpoint:    ${cpaEp}`);
    console.log(`  ActiNet upstream endpoint: ${actEp}`);
    console.log(`  Same endpoint: ${diff.sameEndpoint ? '✅ YES' : '❌ NO — different target!'}`);

    // Request body diff
    if (diff.requestBodyDiff) {
      console.log(`\n  ── Upstream Request Body Diff ──`);
      console.log(truncate(diff.requestBodyDiff, 1200));
    } else {
      console.log(`  Upstream request body: ✅ Identical`);
    }

    // Response diff
    if (diff.responseBodyDiff) {
      console.log(`\n  ── Final Response Diff ──`);
      console.log(truncate(diff.responseBodyDiff, 1200));
    } else if (diff.sameResponse) {
      console.log(`  Final response: ✅ Identical`);
    }

    // Timing
    if (diff.cpaLatencyMs !== undefined && diff.actiNetLatencyMs !== undefined) {
      const delta = Math.abs(diff.cpaLatencyMs - diff.actiNetLatencyMs);
      console.log(`  Latency: CPA ${diff.cpaLatencyMs}ms | ActiNet ${diff.actiNetLatencyMs}ms | Δ ${delta}ms`);
    }

    // Errors
    if (diff.cpaError) console.log(`  ❌ CPA Error: ${diff.cpaError}`);
    if (diff.actiNetError) console.log(`  ❌ ActiNet Error: ${diff.actiNetError}`);
    if (diff.upstreamError) console.log(`  ❌ Upstream Error: ${diff.upstreamError}`);

    console.log();
  }

  // Summary
  const identicalEndpoints = diffs.filter((d) => d.sameEndpoint).length;
  const identicalResponses = diffs.filter((d) => d.sameResponse).length;
  const errors = diffs.filter((d) => d.cpaError || d.actiNetError || d.upstreamError).length;

  console.log('═'.repeat(72));
  console.log(`  Sessions: ${diffs.length}`);
  console.log(`  Same endpoint:  ${identicalEndpoints}/${diffs.length}`);
  console.log(`  Same response:  ${identicalResponses}/${diffs.length}`);
  console.log(`  With errors:    ${errors}/${diffs.length}`);
  console.log('═'.repeat(72) + '\n');
}

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + `\n  ... [truncated, ${s.length - maxLen} more chars]`;
}

/**
 * Generate a Markdown report file with full session details.
 */
export function writeMarkdownReport(runRecord: RunRecord, outputDir: string): string {
  const { sessions, diffs, startedAt, completedAt } = runRecord;
  const lines: string[] = [];

  lines.push('# CPA vs ActiNet — Proxy Translation Diff Report');
  lines.push('');
  lines.push(`- **Started**: ${startedAt}`);
  lines.push(`- **Completed**: ${completedAt ?? 'N/A'}`);
  lines.push(`- **Sessions**: ${diffs.length}`);
  lines.push(`- **Forward source**: \`${runRecord.config.proxy.forwardSource}\``);
  lines.push(`- **Mihomo proxy**: \`${runRecord.config.proxy.mihomoUrl}\``);
  lines.push('');

  for (let i = 0; i < diffs.length; i++) {
    const diff = diffs[i];
    const session = sessions[i];

    lines.push(`## Session ${i + 1}: \`${diff.sessionId}\``);
    lines.push('');
    lines.push(`**Request**: \`${diff.userRequest.method} ${diff.userRequest.path}\``);
    lines.push('');

    // ── Dispatcher Outbound ──
    if (session?.cpaOutbound || session?.actiNetOutbound) {
      lines.push('### Dispatcher Outbound (Record Points 2a/2b)');
      lines.push('');
      lines.push('| Proxy   | Target URL | Method | Body Length |');
      lines.push('|---------|------------|--------|-------------|');
      if (session.cpaOutbound) {
        lines.push(
          `| CPA     | \`${session.cpaOutbound.url}\` | ${session.cpaOutbound.method} | ${session.cpaOutbound.body.length}B |`,
        );
      }
      if (session.actiNetOutbound) {
        lines.push(
          `| ActiNet | \`${session.actiNetOutbound.url}\` | ${session.actiNetOutbound.method} | ${session.actiNetOutbound.body.length}B |`,
        );
      }
      lines.push('');
    }

    // ── Upstream Endpoints ──
    lines.push('### Upstream Endpoints (Record Points 3a/3b)');
    lines.push('');
    lines.push('| Proxy   | Method | Path |');
    lines.push('|---------|--------|------|');
    lines.push(
      `| CPA     | ${diff.cpaUpstreamEndpoint?.method ?? 'N/A'} | \`${diff.cpaUpstreamEndpoint?.path ?? 'N/A'}\` |`,
    );
    lines.push(
      `| ActiNet | ${diff.actiNetUpstreamEndpoint?.method ?? 'N/A'} | \`${diff.actiNetUpstreamEndpoint?.path ?? 'N/A'}\` |`,
    );
    lines.push('');
    lines.push(`**Same endpoint**: ${diff.sameEndpoint ? '✅ Yes' : '❌ No'}`);
    lines.push('');

    // ── Upstream Request Body Diff ──
    if (diff.requestBodyDiff) {
      lines.push('### Upstream Request Body Diff (Stage B)');
      lines.push('');
      lines.push('```diff');
      lines.push(truncate(diff.requestBodyDiff, 5000));
      lines.push('```');
      lines.push('');
    } else {
      lines.push('### Upstream Request Body: ✅ Identical');
      lines.push('');
    }

    // ── Real Upstream Response ──
    if (session?.realUpstreamResponse) {
      lines.push('### Real Upstream Response (Record Point 4)');
      lines.push('');
      lines.push(`- **Status**: ${session.realUpstreamResponse.status}`);
      lines.push(`- **Body length**: ${session.realUpstreamResponse.body.length}B`);
      lines.push('');
    }

    // ── Relay Responses ──
    if (session?.cpaRelayResponse || session?.actiNetRelayResponse) {
      lines.push('### Relay Responses (Record Points 5a/5b)');
      lines.push('');
      lines.push('| Direction | Status | Body Length |');
      lines.push('|-----------|--------|-------------|');
      if (session.cpaRelayResponse) {
        lines.push(
          `| Upstream → CPA     | ${session.cpaRelayResponse.status} | ${session.cpaRelayResponse.body.length}B |`,
        );
      }
      if (session.actiNetRelayResponse) {
        lines.push(
          `| Upstream → ActiNet | ${session.actiNetRelayResponse.status} | ${session.actiNetRelayResponse.body.length}B |`,
        );
      }
      lines.push('');
    }

    // ── Final Response Diff ──
    if (diff.responseBodyDiff) {
      lines.push('### Final Response Diff (Stage C)');
      lines.push('');
      lines.push('```diff');
      lines.push(truncate(diff.responseBodyDiff, 5000));
      lines.push('```');
      lines.push('');
    } else if (diff.sameResponse) {
      lines.push('### Final Response: ✅ Identical');
      lines.push('');
    }

    // ── Timing ──
    if (diff.cpaLatencyMs !== undefined && diff.actiNetLatencyMs !== undefined) {
      lines.push('### Timing (Stage D)');
      lines.push('');
      const delta = Math.abs(diff.cpaLatencyMs - diff.actiNetLatencyMs);
      lines.push('| Proxy   | Latency |');
      lines.push('|---------|---------|');
      lines.push(`| CPA     | ${diff.cpaLatencyMs}ms |`);
      lines.push(`| ActiNet | ${diff.actiNetLatencyMs}ms |`);
      lines.push(`| **Delta** | **${delta}ms** |`);
      lines.push('');
    }

    // ── Errors ──
    if (diff.cpaError || diff.actiNetError || diff.upstreamError) {
      lines.push('### Errors (Stage E)');
      lines.push('');
      if (diff.cpaError) lines.push(`- **CPA**: ${diff.cpaError}`);
      if (diff.actiNetError) lines.push(`- **ActiNet**: ${diff.actiNetError}`);
      if (diff.upstreamError) lines.push(`- **Upstream**: ${diff.upstreamError}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  const reportPath = join(outputDir, 'report.md');
  writeFileSync(reportPath, lines.join('\n'));
  return reportPath;
}
