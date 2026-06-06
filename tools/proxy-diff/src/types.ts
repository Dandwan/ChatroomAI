/** User-provided HTTP request descriptor (JSON file or stdin). */
export interface UserRequest {
  method: string
  path: string // e.g. '/v1/chat/completions', '/v1/messages'
  headers: Record<string, string>
  body: unknown // arbitrary JSON body
  stream?: boolean
}

/** An HTTP transaction captured by the upstream simulator from CPA or ActiNet. */
export interface CapturedHttpTransaction {
  source: 'cpa' | 'actinet'
  method: string // GET, POST, etc.
  path: string // /v1/chat/completions, /v1/messages, /v1beta/models/..., etc.
  headers: Record<string, string>
  body: string // raw body text — never parsed, never assumed
}

/** Response from the real upstream. */
export interface UpstreamResponse {
  status: number
  headers: Record<string, string>
  body: string // raw body text
}

/** Final response from CPA or ActiNet back to the user. */
export interface FinalResponse {
  status: number
  headers: Record<string, string>
  body: unknown // parsed JSON (or string if non-JSON)
}

/** Session lifecycle states. */
export type SessionStatus =
  | 'waiting_cpa'
  | 'waiting_actinet'
  | 'waiting_upstream'
  | 'complete'
  | 'error'

/** One comparison session — ties together one user input, both proxies, and the real upstream. */
export interface PendingSession {
  id: string
  userRequest: UserRequest

  // CPA side
  cpaTransaction?: CapturedHttpTransaction
  cpaUpstreamRes?: unknown // express.Response — kept as unknown to avoid coupling

  // ActiNet side
  actiNetTransaction?: CapturedHttpTransaction
  actiNetUpstreamRes?: unknown

  // Real upstream result
  realUpstreamResponse?: UpstreamResponse

  // Final outputs
  cpaFinalResponse?: FinalResponse
  actiNetFinalResponse?: FinalResponse

  // Timestamps
  startedAt: number
  cpaUpstreamArrivedAt?: number
  actiNetUpstreamArrivedAt?: number
  upstreamResolvedAt?: number
  completedAt?: number

  status: SessionStatus
  error?: string
}

/** Per-side configuration for one proxy under test. */
export interface ProxyTargetConfig {
  baseUrl: string // e.g. 'http://127.0.0.1:8080'
  apiKey: string
  /** Upstream URL that this proxy is configured to forward to.
   *  This should point at the test suite's upstream simulator. */
  upstreamBaseUrl?: string
}

/** Proxy forwarding configuration. */
export interface ProxyForwardConfig {
  mihomoUrl: string // e.g. 'http://127.0.0.1:7890'
  /** Which proxy's translated request to forward to the real upstream. */
  forwardSource: 'cpa' | 'actinet'
}

/** Real upstream target configuration. */
export interface RealUpstreamConfig {
  baseUrl: string // e.g. 'https://api.openai.com'
  apiKey?: string // optional: override API key for real upstream
}

/** Test suite self-configuration. */
export interface TestSuiteConfig {
  port: number
  outputDir: string
}

/** Full configuration for a proxy-diff run. */
export interface ProxyDiffConfig {
  cpa: ProxyTargetConfig
  actiNet: ProxyTargetConfig
  proxy: ProxyForwardConfig
  realUpstream: RealUpstreamConfig
  testSuite: TestSuiteConfig
}

/** Structured comparison result between CPA and ActiNet. */
export interface DiffResult {
  sessionId: string
  userRequest: UserRequest

  // Endpoint comparison
  cpaUpstreamEndpoint?: { method: string; path: string }
  actiNetUpstreamEndpoint?: { method: string; path: string }
  sameEndpoint: boolean

  // Request body comparison (parsed JSON diff)
  requestBodyDiff?: string // unified diff string

  // Final response comparison
  responseBodyDiff?: string
  sameResponse: boolean

  // Timing
  cpaLatencyMs?: number
  actiNetLatencyMs?: number

  // Errors
  cpaError?: string
  actiNetError?: string
  upstreamError?: string
}

/** Complete run record saved to output directory. */
export interface RunRecord {
  config: ProxyDiffConfig
  sessions: PendingSession[]
  diffs: DiffResult[]
  startedAt: string
  completedAt?: string
}
