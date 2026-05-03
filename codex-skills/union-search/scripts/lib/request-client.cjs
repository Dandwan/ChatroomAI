const http = require('node:http')
const https = require('node:https')
const zlib = require('node:zlib')
const { URL } = require('node:url')

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:'])
const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_MAX_REDIRECTS = 5
const DEFAULT_PURPOSE = 'document'

const DEFAULT_DESKTOP_CHROMIUM_PROFILE = {
  id: 'desktop_chromium_windows',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  acceptLanguage: 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  acceptEncoding: 'gzip, deflate, br',
  secChUa: '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
  secChUaMobile: '?0',
  secChUaPlatform: '"Windows"',
  extraHeaders: {},
}

const PURPOSE_DEFAULTS = {
  document: {
    accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    mode: 'navigate',
    dest: 'document',
    upgradeInsecureRequests: '1',
    cacheControl: 'max-age=0',
    pragma: 'no-cache',
    userActivation: true,
  },
  json: {
    accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    mode: 'cors',
    dest: 'empty',
  },
  feed: {
    accept: 'application/rss+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8',
    mode: 'navigate',
    dest: 'document',
    cacheControl: 'max-age=0',
  },
  binary: {
    accept: '*/*',
    mode: 'no-cors',
    dest: 'empty',
  },
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeHeaderMap(input) {
  if (!isRecord(input)) {
    return {}
  }

  const headers = {}
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = normalizeWhitespace(rawKey).toLowerCase()
    if (!key) {
      continue
    }
    if (rawValue === undefined || rawValue === null) {
      continue
    }
    const value = normalizeWhitespace(rawValue)
    if (!value) {
      continue
    }
    headers[key] = value
  }
  return headers
}

function resolveBrowserProfile(config) {
  const rawProfile = isRecord(config) && isRecord(config.browserProfile) ? config.browserProfile : {}
  return {
    id:
      typeof rawProfile.id === 'string' && rawProfile.id.trim()
        ? rawProfile.id.trim()
        : DEFAULT_DESKTOP_CHROMIUM_PROFILE.id,
    userAgent:
      typeof rawProfile.userAgent === 'string' && rawProfile.userAgent.trim()
        ? rawProfile.userAgent.trim()
        : DEFAULT_DESKTOP_CHROMIUM_PROFILE.userAgent,
    acceptLanguage:
      typeof rawProfile.acceptLanguage === 'string' && rawProfile.acceptLanguage.trim()
        ? rawProfile.acceptLanguage.trim()
        : DEFAULT_DESKTOP_CHROMIUM_PROFILE.acceptLanguage,
    acceptEncoding:
      typeof rawProfile.acceptEncoding === 'string' && rawProfile.acceptEncoding.trim()
        ? rawProfile.acceptEncoding.trim()
        : DEFAULT_DESKTOP_CHROMIUM_PROFILE.acceptEncoding,
    secChUa:
      typeof rawProfile.secChUa === 'string' && rawProfile.secChUa.trim()
        ? rawProfile.secChUa.trim()
        : DEFAULT_DESKTOP_CHROMIUM_PROFILE.secChUa,
    secChUaMobile:
      typeof rawProfile.secChUaMobile === 'string' && rawProfile.secChUaMobile.trim()
        ? rawProfile.secChUaMobile.trim()
        : DEFAULT_DESKTOP_CHROMIUM_PROFILE.secChUaMobile,
    secChUaPlatform:
      typeof rawProfile.secChUaPlatform === 'string' && rawProfile.secChUaPlatform.trim()
        ? rawProfile.secChUaPlatform.trim()
        : DEFAULT_DESKTOP_CHROMIUM_PROFILE.secChUaPlatform,
    extraHeaders: {
      ...DEFAULT_DESKTOP_CHROMIUM_PROFILE.extraHeaders,
      ...normalizeHeaderMap(rawProfile.extraHeaders),
    },
  }
}

function decodeBody(body, encoding) {
  const lower = String(encoding || '').toLowerCase()
  try {
    if (lower.includes('br')) {
      return zlib.brotliDecompressSync(body)
    }
    if (lower.includes('gzip')) {
      return zlib.gunzipSync(body)
    }
    if (lower.includes('deflate')) {
      return zlib.inflateSync(body)
    }
  } catch {
    return body
  }
  return body
}

function looksLikeIpv4(hostname) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(String(hostname || ''))
}

function isLocalLikeHostname(hostname) {
  const normalized = String(hostname || '').trim().toLowerCase()
  if (!normalized) {
    return false
  }
  if (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '[::1]' ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.lan')
  ) {
    return true
  }
  if (looksLikeIpv4(normalized)) {
    const segments = normalized.split('.').map((value) => Number.parseInt(value, 10))
    const [first, second] = segments
    return (
      first === 10 ||
      first === 127 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    )
  }
  return !normalized.includes('.')
}

function getRegistrableDomain(hostname) {
  const normalized = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (!normalized) {
    return ''
  }
  if (isLocalLikeHostname(normalized) || looksLikeIpv4(normalized) || normalized.includes(':')) {
    return normalized
  }

  const parts = normalized.split('.').filter(Boolean)
  if (parts.length <= 2) {
    return normalized
  }

  const last = parts[parts.length - 1]
  const secondLast = parts[parts.length - 2]
  const thirdLast = parts[parts.length - 3]
  if (last.length === 2 && secondLast.length <= 3 && parts.length >= 3) {
    return `${thirdLast}.${secondLast}.${last}`
  }
  return `${secondLast}.${last}`
}

function resolveFetchSite(targetUrl, referer) {
  if (!referer) {
    return 'none'
  }

  try {
    const target = new URL(targetUrl)
    const source = new URL(referer)
    if (target.origin === source.origin) {
      return 'same-origin'
    }
    if (getRegistrableDomain(target.hostname) === getRegistrableDomain(source.hostname)) {
      return 'same-site'
    }
  } catch {
    return 'cross-site'
  }

  return 'cross-site'
}

function getDefaultCookiePath(url) {
  const pathname = url.pathname || '/'
  if (!pathname.startsWith('/') || pathname === '/') {
    return '/'
  }
  const slashIndex = pathname.lastIndexOf('/')
  if (slashIndex <= 0) {
    return '/'
  }
  return pathname.slice(0, slashIndex)
}

function parseSetCookie(rawValue, requestUrl) {
  const value = String(rawValue || '').trim()
  if (!value) {
    return null
  }

  const parts = value.split(';').map((part) => part.trim()).filter(Boolean)
  const first = parts.shift()
  if (!first || !first.includes('=')) {
    return null
  }

  const separator = first.indexOf('=')
  const name = first.slice(0, separator).trim()
  const cookieValue = first.slice(separator + 1).trim()
  if (!name) {
    return null
  }

  const request = new URL(requestUrl)
  const parsed = {
    name,
    value: cookieValue,
    domain: request.hostname.toLowerCase(),
    path: getDefaultCookiePath(request),
    secure: request.protocol === 'https:',
    hostOnly: true,
    expiresAt: undefined,
  }

  for (const part of parts) {
    const [rawAttrName, ...rawAttrValueParts] = part.split('=')
    const attrName = String(rawAttrName || '').trim().toLowerCase()
    const attrValue = rawAttrValueParts.join('=').trim()
    if (!attrName) {
      continue
    }

    switch (attrName) {
      case 'domain':
        if (attrValue) {
          parsed.domain = attrValue.replace(/^\./, '').toLowerCase()
          parsed.hostOnly = false
        }
        break
      case 'path':
        if (attrValue.startsWith('/')) {
          parsed.path = attrValue
        }
        break
      case 'secure':
        parsed.secure = true
        break
      case 'expires': {
        const expiresAt = Date.parse(attrValue)
        if (Number.isFinite(expiresAt)) {
          parsed.expiresAt = expiresAt
        }
        break
      }
      case 'max-age': {
        const seconds = Number.parseInt(attrValue, 10)
        if (Number.isFinite(seconds)) {
          parsed.expiresAt = Date.now() + seconds * 1000
        }
        break
      }
      default:
        break
    }
  }

  return parsed
}

function domainMatches(cookie, hostname) {
  const normalizedHost = String(hostname || '').toLowerCase()
  if (!normalizedHost) {
    return false
  }
  if (cookie.hostOnly) {
    return normalizedHost === cookie.domain
  }
  return normalizedHost === cookie.domain || normalizedHost.endsWith(`.${cookie.domain}`)
}

function pathMatches(cookie, pathname) {
  const requestPath = pathname || '/'
  if (cookie.path === '/') {
    return true
  }
  return requestPath === cookie.path || requestPath.startsWith(`${cookie.path}/`)
}

class CookieJar {
  constructor() {
    this.entries = []
  }

  pruneExpired() {
    const now = Date.now()
    this.entries = this.entries.filter((entry) => entry.expiresAt === undefined || entry.expiresAt > now)
  }

  setCookies(url, setCookieHeader) {
    if (!setCookieHeader) {
      return
    }

    const values = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
    for (const rawValue of values) {
      const parsed = parseSetCookie(rawValue, url)
      if (!parsed) {
        continue
      }

      const existingIndex = this.entries.findIndex(
        (entry) =>
          entry.name === parsed.name &&
          entry.domain === parsed.domain &&
          entry.path === parsed.path,
      )

      if (parsed.expiresAt !== undefined && parsed.expiresAt <= Date.now()) {
        if (existingIndex >= 0) {
          this.entries.splice(existingIndex, 1)
        }
        continue
      }

      if (existingIndex >= 0) {
        this.entries[existingIndex] = parsed
      } else {
        this.entries.push(parsed)
      }
    }

    this.pruneExpired()
  }

  getCookieHeader(url) {
    this.pruneExpired()

    const target = new URL(url)
    const matching = this.entries
      .filter((entry) => {
        if (entry.secure && target.protocol !== 'https:') {
          return false
        }
        if (!domainMatches(entry, target.hostname)) {
          return false
        }
        return pathMatches(entry, target.pathname || '/')
      })
      .sort((left, right) => right.path.length - left.path.length)

    if (matching.length === 0) {
      return ''
    }

    return matching.map((entry) => `${entry.name}=${entry.value}`).join('; ')
  }
}

function buildRequestHeaders(options) {
  const targetUrl = new URL(options.url)
  if (!SUPPORTED_PROTOCOLS.has(targetUrl.protocol)) {
    throw new Error(`request only supports http/https URLs: ${options.url}`)
  }

  const profile = options.profile || DEFAULT_DESKTOP_CHROMIUM_PROFILE
  const purposeKey =
    typeof options.purpose === 'string' && options.purpose in PURPOSE_DEFAULTS
      ? options.purpose
      : DEFAULT_PURPOSE
  const purpose = PURPOSE_DEFAULTS[purposeKey]
  const referer = normalizeWhitespace(options.referer)
  const cookieHeader = normalizeWhitespace(options.cookieHeader)

  const headers = {
    'user-agent': profile.userAgent,
    'accept-language': profile.acceptLanguage,
    'accept-encoding': profile.acceptEncoding,
    'sec-ch-ua': profile.secChUa,
    'sec-ch-ua-mobile': profile.secChUaMobile,
    'sec-ch-ua-platform': profile.secChUaPlatform,
    accept: purpose.accept,
    'sec-fetch-site': resolveFetchSite(options.url, referer),
    'sec-fetch-mode': purpose.mode,
    'sec-fetch-dest': purpose.dest,
    ...(purpose.upgradeInsecureRequests ? { 'upgrade-insecure-requests': purpose.upgradeInsecureRequests } : {}),
    ...(purpose.cacheControl ? { 'cache-control': purpose.cacheControl } : {}),
    ...(purpose.pragma ? { pragma: purpose.pragma } : {}),
    ...(purpose.userActivation || options.userActivation ? { 'sec-fetch-user': '?1' } : {}),
    ...(referer ? { referer } : {}),
    ...(cookieHeader ? { cookie: cookieHeader } : {}),
    ...profile.extraHeaders,
  }

  const overrides = normalizeHeaderMap(options.headers)
  for (const [key, value] of Object.entries(overrides)) {
    headers[key] = value
  }

  return headers
}

function resolveRedirectMethod(method, statusCode) {
  const normalizedMethod = String(method || 'GET').toUpperCase()
  if (statusCode === 303) {
    return 'GET'
  }
  if ((statusCode === 301 || statusCode === 302) && normalizedMethod === 'POST') {
    return 'GET'
  }
  return normalizedMethod
}

function createRequestClient(config) {
  const profile = resolveBrowserProfile(config)
  const jar = new CookieJar()

  async function request(url, options) {
    const finalOptions = options || {}
    const target = new URL(url)
    if (!SUPPORTED_PROTOCOLS.has(target.protocol)) {
      throw new Error(`request only supports http/https URLs: ${url}`)
    }

    const timeoutMs = Number.isFinite(finalOptions.timeoutMs)
      ? finalOptions.timeoutMs
      : DEFAULT_TIMEOUT_MS
    const redirects = Number.isFinite(finalOptions.redirects)
      ? finalOptions.redirects
      : 0
    const maxRedirects = Number.isFinite(finalOptions.maxRedirects)
      ? finalOptions.maxRedirects
      : DEFAULT_MAX_REDIRECTS
    const cookieHeader =
      finalOptions.cookieJar === false ? '' : jar.getCookieHeader(target.toString())
    const headers = buildRequestHeaders({
      url: target.toString(),
      purpose: finalOptions.purpose,
      referer: finalOptions.referer,
      headers: finalOptions.headers,
      cookieHeader,
      profile,
      userActivation: finalOptions.userActivation,
    })
    const transport = target.protocol === 'http:' ? http : https

    return new Promise((resolve, reject) => {
      const req = transport.request(
        target,
        {
          method: finalOptions.method || 'GET',
          headers,
        },
        (res) => {
          const chunks = []
          res.on('data', (chunk) => chunks.push(chunk))
          res.on('end', async () => {
            const status = res.statusCode || 0
            const rawBody = Buffer.concat(chunks)
            const decodedBody = decodeBody(rawBody, res.headers['content-encoding'])

            if (finalOptions.cookieJar !== false) {
              jar.setCookies(target.toString(), res.headers['set-cookie'])
            }

            if (status >= 300 && status < 400 && res.headers.location && redirects < maxRedirects) {
              const redirectUrl = new URL(res.headers.location, target).toString()
              const redirectedMethod = resolveRedirectMethod(finalOptions.method || 'GET', status)
              const nextOptions = {
                ...finalOptions,
                method: redirectedMethod,
                body: redirectedMethod === 'GET' ? undefined : finalOptions.body,
                redirects: redirects + 1,
                referer: target.toString(),
                userActivation: false,
              }

              try {
                const redirectedResponse = await request(redirectUrl, nextOptions)
                resolve(redirectedResponse)
              } catch (error) {
                reject(error)
              }
              return
            }

            resolve({
              status,
              headers: res.headers,
              text: decodedBody.toString('utf-8'),
              url: target.toString(),
            })
          })
        },
      )

      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error(`Request timed out after ${timeoutMs}ms`))
      })
      req.on('error', reject)

      if (finalOptions.body) {
        req.write(finalOptions.body)
      }
      req.end()
    })
  }

  async function requestText(url, options) {
    const response = await request(url, {
      purpose: DEFAULT_PURPOSE,
      ...(options || {}),
    })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Request failed: ${response.status} ${url}`)
    }
    return response.text
  }

  async function requestJson(url, options) {
    const text = await requestText(url, {
      purpose: 'json',
      ...(options || {}),
    })
    try {
      return JSON.parse(text)
    } catch (error) {
      throw new Error(`Invalid JSON response from ${url}: ${error.message}`)
    }
  }

  async function postJson(url, body, options) {
    const headers = {
      'content-type': 'application/json',
      ...(options && options.headers ? options.headers : {}),
    }
    return requestJson(url, {
      ...(options || {}),
      purpose: 'json',
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  }

  return {
    profile,
    jar,
    request,
    requestText,
    requestJson,
    postJson,
    buildHeaders: (url, options) =>
      buildRequestHeaders({
        url,
        profile,
        ...(options || {}),
      }),
  }
}

module.exports = {
  DEFAULT_DESKTOP_CHROMIUM_PROFILE,
  createRequestClient,
}
