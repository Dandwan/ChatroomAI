export type InternalActionLocation = 'skill' | 'workspace' | 'home' | 'absolute'
export type ExternalActionLocation = 'skill' | 'workspace' | 'home' | 'root'

const INTERNAL_TO_EXTERNAL_LOCATION: Record<InternalActionLocation, ExternalActionLocation> = {
  skill: 'skill',
  workspace: 'workspace',
  home: 'home',
  absolute: 'root',
}

const EXTERNAL_TO_INTERNAL_LOCATION: Record<ExternalActionLocation, InternalActionLocation> = {
  skill: 'skill',
  workspace: 'workspace',
  home: 'home',
  root: 'absolute',
}

export const toExternalActionLocation = (
  value: InternalActionLocation | undefined,
): ExternalActionLocation | undefined =>
  value ? INTERNAL_TO_EXTERNAL_LOCATION[value] : undefined

export const parseInternalActionLocation = (
  value: string | undefined,
): InternalActionLocation | undefined => {
  if (!value) {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }

  if (normalized === 'absolute') {
    return 'absolute'
  }

  if (normalized === 'root') {
    return 'absolute'
  }

  if (normalized === 'skill' || normalized === 'workspace' || normalized === 'home') {
    return EXTERNAL_TO_INTERNAL_LOCATION[normalized]
  }

  return undefined
}

export const isInternalActionLocation = (value: string | undefined): value is InternalActionLocation =>
  value === 'skill' || value === 'workspace' || value === 'home' || value === 'absolute'

export interface ResolvedEnvVarPath {
  root: InternalActionLocation
  skill?: string
  relativePath: string
}

const ENV_VAR_PATTERN = /^\$(skill|workspace|home)(?:\/|$)/

const isAbsolutePath = (value: string): boolean => {
  const normalized = value.replace(/\\/g, '/').trim()
  return normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)
}

export const resolveEnvVarPath = (
  rawPath: string | undefined,
): ResolvedEnvVarPath | null => {
  if (!rawPath) {
    return null
  }

  const normalized = rawPath.replace(/\\/g, '/').trim()
  if (!normalized) {
    return null
  }

  if (isAbsolutePath(normalized)) {
    return {
      root: 'absolute',
      relativePath: normalized.replace(/\/{2,}/g, '/'),
    }
  }

  const match = normalized.match(ENV_VAR_PATTERN)
  if (!match) {
    return null
  }

  const envVar = match[1] as 'skill' | 'workspace' | 'home'
  const rest = normalized.slice(match[0].length)

  if (envVar === 'skill') {
    const slashIndex = rest.indexOf('/')
    const skillName = slashIndex === -1 ? rest : rest.slice(0, slashIndex)
    const relativePath = slashIndex === -1 ? '.' : rest.slice(slashIndex + 1)
    if (!skillName) {
      return null
    }
    return {
      root: 'skill',
      skill: skillName,
      relativePath: relativePath || '.',
    }
  }

  return {
    root: envVar,
    relativePath: rest || '.',
  }
}

export const deriveRootFromPath = (
  rawPath: string | undefined,
): { root: InternalActionLocation; skill?: string } | null => {
  const resolved = resolveEnvVarPath(rawPath)
  if (!resolved) {
    return null
  }
  return {
    root: resolved.root,
    skill: resolved.skill,
  }
}

export const buildEnvVarPath = (
  root: InternalActionLocation,
  skill: string | undefined,
  relativePath: string | undefined,
): string | undefined => {
  if (relativePath === undefined) {
    return undefined
  }
  if (root === 'absolute') {
    return relativePath
  }
  if (root === 'skill' && skill) {
    return relativePath === '.' ? `$skill/${skill}` : `$skill/${skill}/${relativePath}`
  }
  if (root === 'workspace') {
    return relativePath === '.' ? '$workspace' : `$workspace/${relativePath}`
  }
  if (root === 'home') {
    return relativePath === '.' ? '$home' : `$home/${relativePath}`
  }
  return relativePath
}

export const buildEnvVarCwd = (
  root: InternalActionLocation,
  skill: string | undefined,
  cwd: string | undefined,
): string | undefined => {
  if (cwd === undefined) {
    return undefined
  }
  return buildEnvVarPath(root, skill, cwd)
}
