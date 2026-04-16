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
