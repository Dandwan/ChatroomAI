/** User-provided HTTP request descriptor (JSON file or stdin). */
export interface UserRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
  stream?: boolean;
}

/** An HTTP transaction captured by the upstream simulator from CPA or ActiNet. */
export interface CapturedHttpTransaction {
  source: 'cpa' | 'actinet';
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
}

/** The raw outbound HTTP request sent by the dispatcher to CPA or ActiNet. */
export interface DispatcherOutbound {
  source: 'cpa' | 'actinet';
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

/** Response from the real upstream (status + headers + body — complete raw response). */
export interface UpstreamResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Response relayed by the upstream simulator back to CPA or ActiNet. */
export interface UpstreamRelayResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Final response from CPA or ActiNet back to the user. */
export interface FinalResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

/** Session lifecycle states. */
export type SessionStatus =
  | 'waiting_cpa'
  | 'waiting_actinet'
  | 'waiting_upstream'
  | 'complete'
  | 'error';

/**
 * One comparison session — ties together one user input, both proxies,
 * every recorded hop, and the real upstream.  Every field that can be
 * recorded is recorded verbatim (body as raw string) so that the
 * comparison is complete and format-agnostic.
 */
export interface PendingSession {
  id: string;
  userRequest: UserRequest;

  // ── Dispatcher outbound (record point 2a / 2b) ──
  cpaOutbound?: DispatcherOutbound;
  actiNetOutbound?: DispatcherOutbound;

  // ── Upstream transactions captured from CPA / ActiNet (record point 3a / 3b) ──
  cpaTransaction?: CapturedHttpTransaction;
  actiNetTransaction?: CapturedHttpTransaction;

  // ── Response relayed back to CPA / ActiNet (record point 5a / 5b) ──
  cpaRelayResponse?: UpstreamRelayResponse;
  actiNetRelayResponse?: UpstreamRelayResponse;

  // ── Real upstream response (record point 4) ──
  realUpstreamResponse?: UpstreamResponse;

  // ── Final translated responses (record point 6a / 6b) ──
  cpaFinalResponse?: FinalResponse;
  actiNetFinalResponse?: FinalResponse;

  // ── Timing ──
  startedAt: number;
  cpaUpstreamArrivedAt?: number;
  actiNetUpstreamArrivedAt?: number;
  upstreamResolvedAt?: number;
  completedAt?: number;

  // ── Lifecycle ──
  status: SessionStatus;
  error?: string;
}

/** Per-side configuration for one proxy under test. */
export interface ProxyTargetConfig {
  baseUrl: string;
  apiKey: string;
  /** Upstream URL that this proxy is configured to forward to.
   *  This should point at the test suite's upstream simulator. */
  upstreamBaseUrl?: string;
}

/** Proxy forwarding configuration. */
export interface ProxyForwardConfig {
  mihomoUrl: string;
  /** Which proxy's translated request to forward to the real upstream. */
  forwardSource: 'cpa' | 'actinet';
}

/** Real upstream target configuration. */
export interface RealUpstreamConfig {
  baseUrl: string;
  apiKey?: string;
}

/** Test suite self-configuration. */
export interface TestSuiteConfig {
  port: number;
  outputDir: string;
}

/** Full configuration for a proxy-diff run. */
export interface ProxyDiffConfig {
  cpa: ProxyTargetConfig;
  actiNet: ProxyTargetConfig;
  proxy: ProxyForwardConfig;
  realUpstream: RealUpstreamConfig;
  testSuite: TestSuiteConfig;
}

/** Structured comparison result between CPA and ActiNet. */
export interface DiffResult {
  sessionId: string;
  userRequest: UserRequest;
  cpaUpstreamEndpoint?: {
    method: string;
    path: string;
  };
  actiNetUpstreamEndpoint?: {
    method: string;
    path: string;
  };
  sameEndpoint: boolean;
  requestBodyDiff?: string;
  responseBodyDiff?: string;
  sameResponse: boolean;
  cpaLatencyMs?: number;
  actiNetLatencyMs?: number;
  cpaError?: string;
  actiNetError?: string;
  upstreamError?: string;
}

/** Complete run record saved to output directory. */
export interface RunRecord {
  config: ProxyDiffConfig;
  sessions: PendingSession[];
  diffs: DiffResult[];
  startedAt: string;
  completedAt?: string;
}
