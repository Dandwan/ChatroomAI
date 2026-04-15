const API_BASE_URL = process.env.API_BASE_URL ?? ''
const API_KEY = process.env.API_KEY ?? ''
const FORCE_MODEL = process.env.TEST_MODEL

const buildUrl = (baseUrl, path) => {
  const normalized = baseUrl.trim().replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalized}${normalizedPath}`
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_KEY}`,
}

const isRecord = (value) => value && typeof value === 'object'

const readErrorText = async (response) => {
  const fallback = `${response.status} ${response.statusText}`
  const text = await response.text()
  if (!text) {
    return fallback
  }
  try {
    const parsed = JSON.parse(text)
    if (isRecord(parsed.error) && typeof parsed.error.message === 'string') {
      return parsed.error.message
    }
    if (typeof parsed.message === 'string') {
      return parsed.message
    }
  } catch {
    // Ignore.
  }
  return text
}

const fetchModels = async () => {
  const response = await fetch(buildUrl(API_BASE_URL, '/models'), { headers })
  if (!response.ok) {
    throw new Error(`模型拉取失败: ${await readErrorText(response)}`)
  }
  const payload = await response.json()
  const data = Array.isArray(payload?.data) ? payload.data : []
  const models = data
    .map((item) => (typeof item?.id === 'string' ? item.id : ''))
    .filter(Boolean)
  if (models.length === 0) {
    throw new Error('模型列表为空')
  }
  return models
}

const testNonStream = async (model) => {
  const response = await fetch(buildUrl(API_BASE_URL, '/chat/completions'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0.2,
      max_tokens: 128,
      messages: [{ role: 'user', content: '请回复: non-stream-ok' }],
    }),
  })

  if (!response.ok) {
    throw new Error(`非流式测试失败: ${await readErrorText(response)}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  const text = typeof content === 'string' ? content : JSON.stringify(content ?? '')
  if (!text) {
    throw new Error('非流式响应为空')
  }
  return { text, usage: payload?.usage }
}

const testStream = async (model) => {
  const startedAt = performance.now()
  const response = await fetch(buildUrl(API_BASE_URL, '/chat/completions'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      stream: true,
      stream_options: { include_usage: true },
      temperature: 0.2,
      max_tokens: 192,
      messages: [{ role: 'user', content: '请返回一句含 LaTeX 的话，例如 $a^2+b^2=c^2$。' }],
    }),
  })

  if (!response.ok) {
    throw new Error(`流式测试失败: ${await readErrorText(response)}`)
  }

  if (!response.body) {
    throw new Error('流式测试失败: response.body 为空')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let content = ''
  let firstTokenAt
  let usage
  let doneSignal = false

  while (!doneSignal) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''

    for (const block of blocks) {
      const lines = block.split('\n')
      for (const line of lines) {
        if (!line.trim().startsWith('data:')) {
          continue
        }
        const data = line.trim().slice(5).trim()
        if (!data) {
          continue
        }
        if (data === '[DONE]') {
          doneSignal = true
          break
        }
        let parsed
        try {
          parsed = JSON.parse(data)
        } catch {
          continue
        }
        if (!isRecord(parsed)) {
          continue
        }
        if (isRecord(parsed.usage)) {
          usage = parsed.usage
        }
        const delta = parsed?.choices?.[0]?.delta
        const chunk = typeof delta?.content === 'string' ? delta.content : ''
        if (chunk && !firstTokenAt) {
          firstTokenAt = performance.now()
        }
        content += chunk
      }
      if (doneSignal) {
        break
      }
    }
  }

  const totalMs = performance.now() - startedAt
  const firstTokenMs = firstTokenAt ? firstTokenAt - startedAt : totalMs
  if (!content.trim()) {
    throw new Error('流式响应为空')
  }

  return {
    content,
    usage,
    firstTokenMs,
    totalMs,
  }
}

const tinyPngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAucB9sBfWgAAAABJRU5ErkJggg=='

const testImage = async (model) => {
  const response = await fetch(buildUrl(API_BASE_URL, '/chat/completions'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      stream: false,
      max_tokens: 64,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: '请用一句话描述图像内容。' },
            { type: 'image_url', image_url: { url: tinyPngDataUrl } },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`图片请求失败: ${await readErrorText(response)}`)
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('图片请求返回空内容')
  }
  return content
}

const pickVisionCandidate = (models) => {
  const pattern = /(vision|vl|4o|omni|qwen-vl|gpt-4\.1|gemini)/i
  return models.find((model) => pattern.test(model))
}

const pickWorkingModel = async (models) => {
  if (FORCE_MODEL) {
    return { model: FORCE_MODEL, result: await testNonStream(FORCE_MODEL) }
  }

  for (const model of models) {
    try {
      const result = await testNonStream(model)
      return { model, result }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`   跳过 ${model}: ${message}`)
    }
  }

  throw new Error('未找到可用模型（非流式）')
}

const runStreamOnAnyModel = async (models, preferredModel) => {
  const candidates = [preferredModel, ...models.filter((item) => item !== preferredModel)]
  for (const model of candidates) {
    try {
      const result = await testStream(model)
      return { model, result }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`   流式跳过 ${model}: ${message}`)
    }
  }
  throw new Error('未找到可用模型（流式）')
}

const main = async () => {
  if (!API_BASE_URL.trim()) {
    throw new Error('请先设置 API_BASE_URL 环境变量。')
  }
  if (!API_KEY.trim()) {
    throw new Error('请先设置 API_KEY 环境变量。')
  }

  console.log(`API Base URL: ${API_BASE_URL}`)
  console.log('1) 拉取模型列表...')
  const models = await fetchModels()
  console.log(`   模型数量: ${models.length}`)

  console.log('2) 选择可用模型并执行非流式测试...')
  const { model, result: nonStream } = await pickWorkingModel(models)
  console.log(`   使用模型: ${model}`)
  console.log(`   非流式文本片段: ${String(nonStream.text).slice(0, 80)}`)
  console.log(`   usage: ${JSON.stringify(nonStream.usage ?? {})}`)

  console.log('3) 执行流式测试...')
  const { model: streamModel, result: stream } = await runStreamOnAnyModel(models, model)
  console.log(`   流式模型: ${streamModel}`)
  console.log(`   首 token 延迟: ${Math.round(stream.firstTokenMs)}ms`)
  console.log(`   总耗时: ${Math.round(stream.totalMs)}ms`)
  console.log(`   文本片段: ${stream.content.slice(0, 80)}`)
  console.log(`   usage: ${JSON.stringify(stream.usage ?? {})}`)

  const visionCandidate = pickVisionCandidate(models)
  if (visionCandidate) {
    console.log(`4) 图片测试模型: ${visionCandidate}`)
    const imageResult = await testImage(visionCandidate)
    const imageText = typeof imageResult === 'string' ? imageResult : JSON.stringify(imageResult)
    console.log(`   图片测试文本片段: ${imageText.slice(0, 80)}`)
  } else {
    console.log('4) 图片测试跳过：未找到明显支持视觉的模型标识。')
  }

  console.log('API smoke tests passed.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
