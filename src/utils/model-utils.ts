import type { ModelHealth } from '../state/types'

export const createProviderModelKey = (providerId: string, modelId: string): string =>
  `${providerId}::${modelId}`

export const modelHealthLabel = (state: ModelHealth | undefined): string => {
  switch (state) {
    case 'testing':
      return '检测中'
    case 'ok':
      return '可用'
    case 'error':
      return '失败'
    default:
      return '检测'
  }
}
