export const formatMs = (value: number | undefined): string => {
  if (value === undefined || Number.isNaN(value)) {
    return '--'
  }
  if (value < 1000) {
    return `${Math.round(value)}ms`
  }
  return `${(value / 1000).toFixed(2)}s`
}
