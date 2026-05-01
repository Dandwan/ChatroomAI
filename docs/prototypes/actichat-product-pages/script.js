const landscapePool = [
  {
    id: 'alpine-lake',
    title: 'Alpine Lake',
    photographer: 'Jplenio',
    source: 'Pexels curated',
    description: 'A still opening image with long air and clean water.',
    image: '../assets/landscapes/alpine-lake.jpg',
  },
  {
    id: 'mirror-mountain',
    title: 'Mirror Mountain',
    photographer: 'Eberhard Grossgasteiger',
    source: 'Pexels curated',
    description: 'A colder, more editorial cover with restrained contrast.',
    image: '../assets/landscapes/mirror-mountain.jpg',
  },
  {
    id: 'crater-lake',
    title: 'Crater Lake',
    photographer: 'Sanaan Mazhar',
    source: 'Pexels curated',
    description: 'A calm opening image for a fresh conversation.',
    image: '../assets/landscapes/crater-lake.jpg',
  },
  {
    id: 'autumn-ridge',
    title: 'Autumn Ridge',
    photographer: 'Nenad Rakicevic',
    source: 'Pexels curated',
    description: 'For days that need more warmth without losing control.',
    image: '../assets/landscapes/autumn-ridge.jpg',
  },
]

const homepageStatPriority = ['tokenUsage', 'conversationHistory', 'toolCalls']
const homepageStatBackup = ['imagesSent', 'messageCount']

const homepageStats = [
  {
    id: 'tokenUsage',
    label: 'Total token use',
    value: '1.26M',
    meta: '词元消耗',
    count: 1260000,
  },
  {
    id: 'conversationHistory',
    label: 'Conversation archive',
    value: '127',
    meta: '历史会话',
    count: 127,
  },
  {
    id: 'toolCalls',
    label: 'Tool calls',
    value: '54',
    meta: '工具调用',
    count: 54,
  },
  {
    id: 'imagesSent',
    label: 'Images sent',
    value: '38',
    meta: '发送图片',
    count: 38,
  },
  {
    id: 'messageCount',
    label: 'Messages sent',
    value: '892',
    meta: '消息数量',
    count: 892,
  },
]

const dateHash = (dateString) => {
  const compact = dateString.replaceAll('-', '')
  let total = 0
  for (let index = 0; index < compact.length; index += 1) {
    total += Number(compact[index]) * (index + 7)
  }
  return total
}

const getItemByDate = (dateString) => {
  const index = dateHash(dateString) % landscapePool.length
  return landscapePool[index]
}

const fillCollection = (target) => {
  if (!target) return
  target.innerHTML = ''
  landscapePool.forEach((item) => {
    const figure = document.createElement('figure')
    figure.className = 'thumb'
    figure.innerHTML = `
      <img src="${item.image}" alt="${item.title}" />
      <span>${item.title}</span>
    `
    target.appendChild(figure)
  })
}

const selectHomepageStats = () => {
  const statById = new Map(homepageStats.map((stat) => [stat.id, stat]))
  const orderedIds = [...homepageStatPriority, ...homepageStatBackup]
  const positiveStats = orderedIds
    .map((id) => statById.get(id))
    .filter((stat) => stat && stat.count > 0)

  if (positiveStats.length === 0) {
    return homepageStatPriority.map((id) => statById.get(id)).filter(Boolean).slice(0, 3)
  }

  const selected = positiveStats.slice(0, 3)
  if (selected.length >= 3) {
    return selected
  }

  const fallback = orderedIds
    .map((id) => statById.get(id))
    .filter((stat) => stat && !selected.includes(stat))

  return [...selected, ...fallback].slice(0, 3)
}

const renderHomepageStats = () => {
  const target = document.getElementById('homepageStats')
  if (!target) return

  target.innerHTML = ''
  selectHomepageStats().forEach((stat) => {
    const article = document.createElement('article')
    article.className = 'legacy-stat'
    article.innerHTML = `
      <span class="label">${stat.label}</span>
      <span class="value">${stat.value}</span>
      <span class="meta">${stat.meta}</span>
    `
    target.appendChild(article)
  })
}

const homepageModeContent = {
  skill: {
    state: '技能模式',
    cardLabel: 'gpt-5.4 · 技能模式',
  },
  text: {
    state: '文本模式',
    cardLabel: 'gpt-5.4 · 文本模式',
  },
}

const resolveSystemTheme = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const formatThemeLabel = (preference, resolvedTheme) => {
  if (preference === 'system') {
    return `System · ${resolvedTheme === 'dark' ? 'Dark' : 'Light'}`
  }
  return preference === 'light' ? 'Light' : 'Dark'
}

const applyHomepageMode = (mode) => {
  const content = homepageModeContent[mode] || homepageModeContent.skill
  document.querySelectorAll('[data-home-mode]').forEach((button) => {
    button.classList.toggle('is-active', button.getAttribute('data-home-mode') === mode)
  })

  document.querySelectorAll('[data-home-mode-summary]').forEach((element) => {
    element.textContent = content.state
  })

  document.querySelectorAll('[data-home-model-label]').forEach((element) => {
    element.textContent = content.cardLabel
  })
}

const applyThemePreview = (preference) => {
  const screen = document.querySelector('.page-new-conversation .screen')
  if (!screen) return

  const resolvedTheme = preference === 'system' ? resolveSystemTheme() : preference
  screen.setAttribute('data-screen-theme', resolvedTheme)

  if (document.body) {
    document.body.setAttribute('data-demo-theme-preference', preference)
  }

  document.querySelectorAll('[data-theme-preview]').forEach((button) => {
    button.classList.toggle('is-active', button.getAttribute('data-theme-preview') === preference)
  })

  document.querySelectorAll('[data-theme-preview-state]').forEach((element) => {
    element.textContent = formatThemeLabel(preference, resolvedTheme)
  })
}

const getDefaultDateValue = () => {
  const today = new Date()
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return localToday.toISOString().slice(0, 10)
}

const updateCover = () => {
  const dateInput = document.getElementById('demoDate')
  const dateValue = dateInput?.value || getDefaultDateValue()
  if (!dateValue) return

  const item = getItemByDate(dateValue)

  document.querySelectorAll('[data-cover-image]').forEach((element) => {
    element.setAttribute('src', item.image)
    element.setAttribute('alt', item.title)
  })

  document.querySelectorAll('[data-cover-title]').forEach((element) => {
    element.textContent = item.title
  })

  document.querySelectorAll('[data-cover-photographer]').forEach((element) => {
    element.textContent = item.photographer
  })

  document.querySelectorAll('[data-cover-source]').forEach((element) => {
    element.textContent = item.source
  })

  document.querySelectorAll('[data-cover-description]').forEach((element) => {
    element.textContent = item.description
  })

  document.querySelectorAll('[data-cover-date]').forEach((element) => {
    element.textContent = dateValue
  })
}

window.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('demoDate')
  if (dateInput) {
    dateInput.value = dateInput.value || getDefaultDateValue()
    dateInput.addEventListener('change', updateCover)
  }

  document.querySelectorAll('[data-home-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.getAttribute('data-home-mode') || 'skill'
      applyHomepageMode(mode)
    })
  })

  document.querySelectorAll('[data-theme-preview]').forEach((button) => {
    button.addEventListener('click', () => {
      const preference = button.getAttribute('data-theme-preview') || 'dark'
      applyThemePreview(preference)
    })
  })

  if (typeof window.matchMedia === 'function') {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleThemeChange = () => {
      if (document.body?.getAttribute('data-demo-theme-preference') === 'system') {
        applyThemePreview('system')
      }
    }

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleThemeChange)
    } else if (typeof media.addListener === 'function') {
      media.addListener(handleThemeChange)
    }
  }

  fillCollection(document.getElementById('settingsThumbs'))
  fillCollection(document.getElementById('collectionThumbs'))
  renderHomepageStats()
  applyHomepageMode('skill')
  applyThemePreview(document.body?.getAttribute('data-demo-theme-preference') || 'dark')
  updateCover()
})
