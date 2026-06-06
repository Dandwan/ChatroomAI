import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProxyDiffConfig, ProxyTargetConfig, ProxyForwardConfig, RealUpstreamConfig, TestSuiteConfig } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const DEFAULT_CONFIG: ProxyDiffConfig = {
  cpa: {
    baseUrl: 'http://127.0.0.1:8080',
    apiKey: '',
  },
  actiNet: {
    baseUrl: 'http://127.0.0.1:3000',
    apiKey: '',
  },
  proxy: {
    mihomoUrl: 'http://127.0.0.1:7890',
    forwardSource: 'cpa',
  },
  realUpstream: {
    baseUrl: 'https://api.openai.com',
  },
  testSuite: {
    port: 9000,
    outputDir: resolve(projectRoot, 'outputs'),
  },
};

function mergeConfig(defaults: ProxyDiffConfig, overrides: Partial<ProxyDiffConfig>): ProxyDiffConfig {
  return {
    cpa: { ...defaults.cpa, ...overrides.cpa } as ProxyTargetConfig,
    actiNet: { ...defaults.actiNet, ...overrides.actiNet } as ProxyTargetConfig,
    proxy: { ...defaults.proxy, ...overrides.proxy } as ProxyForwardConfig,
    realUpstream: { ...defaults.realUpstream, ...overrides.realUpstream } as RealUpstreamConfig,
    testSuite: { ...defaults.testSuite, ...overrides.testSuite } as TestSuiteConfig,
  };
}

export function loadConfig(configPath?: string): ProxyDiffConfig {
  const paths = configPath
    ? [configPath]
    : [
        resolve(projectRoot, 'proxy-diff.config.json'),
        resolve(projectRoot, 'proxy-diff.config.local.json'),
      ];

  let merged: ProxyDiffConfig = { ...DEFAULT_CONFIG };

  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, 'utf-8');
        const overrides = JSON.parse(raw) as Partial<ProxyDiffConfig>;
        merged = mergeConfig(merged, overrides);
      } catch (err) {
        console.error(
          `Warning: failed to load config from ${p}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  // Resolve outputDir relative to project root if not absolute
  if (!merged.testSuite.outputDir.startsWith('/')) {
    merged.testSuite.outputDir = resolve(projectRoot, merged.testSuite.outputDir);
  }

  return merged;
}
