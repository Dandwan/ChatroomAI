# Chat Storage Specification

This document defines ChatroomAI's conversation storage layout for local-first clients.

## Goals

- Each conversation owns one independent storage directory.
- Files belong to exactly one conversation.
- The storage shape must stay easy for future agents to traverse directly.
- Metadata and file payloads must be separated cleanly.
- Older `localStorage`-based chat history must migrate automatically without data loss.

## Root Layout

All chat data lives under the app-private data directory:

```text
chat-data/
  meta.json
  conversations/
    index.json
    <conversation-id>/
      conversation.json
      workspace/
      files/
        <file-id>.<ext>
```

## Files

### `chat-data/meta.json`

Global lightweight metadata.

Current fields:

- `schemaVersion`
- `activeConversationId`

### `chat-data/conversations/index.json`

Conversation summary cache for fast list rendering and cold-start homepage metrics.

Cold-start contract:

- App startup reads `meta.json` and `index.json` first.
- History list rendering must come from `index.json`, not from eagerly reading every `conversation.json`.
- Opening a historical conversation may then read that conversation's `conversation.json` on demand.

Current fields per entry:

- `id`
- `title`
- `titleManuallyEdited`
- `createdAt`
- `updatedAt`
- `preferences`
- `messageCount`
- `userMessageCount`
- `fileCount`
- `imageCount`
- `assistantTokenCount`
- `toolCallCount`
- `draftTextLength`
- `draftAttachmentCount`
- `lastMessagePreview`
- `lastMessageRole`

Current top-level aggregate fields:

- `historyStats.totalConversationCount`
- `historyStats.totalMessageCount`
- `historyStats.totalPhotoCount`
- `historyStats.totalTokenCount`
- `historyStats.totalToolCallCount`

`index.json` is rebuildable. `conversation.json` remains the source of truth.

### `chat-data/conversations/<conversation-id>/conversation.json`

The authoritative record for one conversation.

Current fields:

- `id`
- `title`
- `titleManuallyEdited`
- `createdAt`
- `updatedAt`
- `draft`
- `preferences`
- `transcript`
- `files`

Legacy `messages` payloads may still appear in older records during migration, but new writes should persist `transcript`.

### `chat-data/conversations/<conversation-id>/files/`

Flat file space for that conversation only.

Rules:

- No nested message directories
- No shared files across conversations
- Stable file path based on file id
- Original payload stored as a real binary file, not as a JSON-wrapped data URL

### `chat-data/conversations/<conversation-id>/workspace/`

Per-conversation agent workspace.

Rules:

- Workspace belongs to exactly one conversation
- Empty workspace directories do not need to be materialized eagerly
- Files inside workspace are agent-readable text assets or future tool outputs
- Workspace extends the conversation directory instead of introducing a second root layout

## Conversation Model

Messages reference files by id instead of embedding persisted image payloads.

Example:

```json
{
  "schemaVersion": 1,
  "conversation": {
    "id": "legacy-conv-1",
    "title": "图片对话",
    "titleManuallyEdited": false,
    "createdAt": 1710000000000,
    "updatedAt": 1710000001000,
    "draft": {
      "text": "未发送草稿",
      "attachmentIds": []
    },
    "messages": [
      {
        "id": "msg-user-1",
        "role": "user",
        "text": "看这张图",
        "attachmentIds": ["img-1"],
        "createdAt": 1710000000000
      }
    ],
    "files": [
      {
        "id": "img-1",
        "name": "seed.png",
        "mimeType": "image/png",
        "size": 67,
        "relativePath": "files/img-1.png",
        "createdAt": 1710000000000
      }
    ]
  }
}
```

## Persistence Rules

- Empty workspace placeholders are not persisted unless they contain meaningful state.
- Draft text is stored inside the conversation document, not in a global draft store.
- `meta.json` stores the active conversation only when it points to a persisted conversation.
- Image payloads are written to `files/` and omitted from persisted message JSON.
- UI hydration may rebuild in-memory data URLs from the stored binary files.

## Migration Rules

Legacy sources:

- `chatroom.conversations.v2`
- `chatroom.messages.v1`
- `chatroom.drafts.v1`
- `chatroom.active-conversation.v2`
- `chatroom.conversation-image-manifest.v1`
- legacy `conversation-images/`

Migration process:

1. Detect absence of the new `chat-data` structure.
2. Load legacy conversations and drafts.
3. Rebuild each conversation into the new directory layout.
4. Materialize legacy image payloads as binary files under `files/`.
5. Write `conversation.json`, `index.json`, and `meta.json`.
6. Reload the new structure to verify the migration result.
7. Remove legacy keys and the old `conversation-images/` directory only after verification.

## Compatibility Notes

- The storage model is intentionally filesystem-first so Android, Windows, and macOS can share the same logical structure.
- Future file management, file compression, export, and agent workspace features should extend this layout instead of replacing it.
