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
