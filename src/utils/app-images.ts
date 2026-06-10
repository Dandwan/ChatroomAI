/**
 * 图片查看器工具函数
 * 从 src/App.tsx 提取
 */

import type { ImageViewerItem } from '../components/ImageViewer'
import type { ChatMessage, ImageAttachment, PendingImageAttachment, Conversation } from '../state/types'

export const buildMessageImageViewerKey = (messageId: string, imageId: string): string =>
  `message:${messageId}:${imageId}`

export const buildPendingImageViewerKey = (imageId: string): string => `pending:${imageId}`

export const toImageViewerItem = (
  key: string,
  image: Pick<ImageAttachment, 'name' | 'dataUrl'>,
): ImageViewerItem | null => {
  const dataUrl = image.dataUrl.trim()
  if (!dataUrl) {
    return null
  }

  return {
    key,
    name: image.name.trim() || '图片预览',
    dataUrl,
  }
}

export const collectConversationImageViewerItems = (
  messages: ChatMessage[],
  pendingImages: PendingImageAttachment[],
): ImageViewerItem[] => {
  const items: ImageViewerItem[] = []

  for (const message of messages) {
    for (const image of message.images ?? []) {
      const item = toImageViewerItem(buildMessageImageViewerKey(message.id, image.id), image)
      if (item) {
        items.push(item)
      }
    }
  }

  for (const image of pendingImages) {
    const item = toImageViewerItem(buildPendingImageViewerKey(image.id), image)
    if (item) {
      items.push(item)
    }
  }

  return items
}

export const applyAssignedImageStorageKeys = (
  conversations: Conversation[],
  assignments: Array<{
    conversationId: string
    messageId: string
    imageId: string
    storageKey: string
  }>,
): Conversation[] => {
  if (assignments.length === 0) {
    return conversations
  }

  return conversations.map((conversation) => {
    const conversationAssignments = assignments.filter((item) => item.conversationId === conversation.id)
    if (conversationAssignments.length === 0) {
      return conversation
    }

    let conversationChanged = false
    const nextTranscript = conversation.transcript.map((event) => {
      if (event.kind !== 'user_message') {
        return event
      }

      const messageAssignments = conversationAssignments.filter((item) => item.messageId === event.id)
      if (messageAssignments.length === 0) {
        return event
      }

      let eventChanged = false
      const nextContent = event.content.map((part) => {
        if (part.type !== 'image') {
          return part
        }
        const matched = messageAssignments.find((item) => item.imageId === part.image.id)
        if (!matched || part.image.storageKey === matched.storageKey) {
          return part
        }
        eventChanged = true
        return {
          type: 'image' as const,
          image: {
            ...part.image,
            storageKey: matched.storageKey,
          },
        }
      })

      if (!eventChanged) {
        return event
      }

      conversationChanged = true
      return {
        ...event,
        content: nextContent,
      }
    })

    return conversationChanged ? { ...conversation, transcript: nextTranscript } : conversation
  })
}
