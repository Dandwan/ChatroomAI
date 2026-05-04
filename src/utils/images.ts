export interface ImageAttachment {
  id: string
  name: string
  mimeType: string
  size: number
  dataUrl: string
}

type ImageDataUrlTransformer = (input: { dataUrl: string; file: File }) => string | Promise<string>

interface CreateImageAttachmentsOptions {
  transformDataUrl?: ImageDataUrlTransformer
}

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('图片读取失败'))
      }
    }
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })

const clampCompressionRate = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value)))

const resolveCompressionMimeType = (mimeType: string): string => {
  const normalized = mimeType.trim().toLowerCase()
  if (normalized === 'image/jpeg' || normalized === 'image/webp') {
    return normalized
  }
  return 'image/jpeg'
}

const loadImageElement = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解码失败'))
    image.src = dataUrl
  })

export const estimateDataUrlByteSize = (dataUrl: string): number => {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) {
    return 0
  }
  const encoded = dataUrl.slice(commaIndex + 1)
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding)
}

export const compressImageDataUrl = async (input: {
  dataUrl: string
  mimeType: string
  compressionRate: number
}): Promise<{ dataUrl: string; mimeType: string; size: number }> => {
  const compressionRate = clampCompressionRate(input.compressionRate)
  if (compressionRate === 0) {
    return {
      dataUrl: input.dataUrl,
      mimeType: input.mimeType,
      size: estimateDataUrlByteSize(input.dataUrl),
    }
  }

  const image = await loadImageElement(input.dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('图片压缩失败：无法创建画布上下文')
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  const mimeType = resolveCompressionMimeType(input.mimeType)
  const quality = Math.max(0.08, 1 - (compressionRate / 100) * 0.9)
  const nextDataUrl = canvas.toDataURL(mimeType, quality)
  return {
    dataUrl: nextDataUrl,
    mimeType,
    size: estimateDataUrlByteSize(nextDataUrl),
  }
}

export const createImageAttachments = async (
  files: File[],
  options: CreateImageAttachmentsOptions = {},
): Promise<ImageAttachment[]> => {
  const transformDataUrl =
    options.transformDataUrl ??
    (({ dataUrl }: { dataUrl: string; file: File }) => dataUrl)

  return Promise.all(
    files.map(async (file) => {
      const dataUrl = await readFileAsDataUrl(file)
      const transformed = await transformDataUrl({ dataUrl, file })
      return {
        id: createId(),
        name: file.name,
        mimeType: file.type || 'image/*',
        size: file.size,
        dataUrl: transformed,
      }
    }),
  )
}
