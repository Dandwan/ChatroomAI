// Constants previously defined at the top of App.tsx.
// Extracted to keep App.tsx focused on the component tree.

export const DEBUG_SKILL_ROUND_LOG_STORAGE_KEY = 'chatroom.debug.skill-round-log.v1'
export const DEBUG_OBJECT_FLOW_LOG_STORAGE_KEY = 'chatroom.debug.object-flow-log.v1'
export const DEBUG_LOG_ENTRY_LIMIT = 240
export const DEBUG_LOG_TEXT_LIMIT = 6000

export const MAX_EMPTY_STATE_STATS_MIN_CONVERSATIONS = 9999
export const TITLE_EDIT_TRANSITION_MS = 220
export const TITLE_EDIT_TRANSITION_TRAVEL_FACTOR = 0.18
export const TITLE_EDIT_TRANSITION_TRAVEL_MIN_PX = 12
export const TITLE_EDIT_TRANSITION_TRAVEL_MAX_PX = 26
export const MESSAGE_LIST_BOTTOM_THRESHOLD_PX = 28
export const MESSAGE_LIST_INTERACTION_IDLE_MS = 140
export const MESSAGE_LIST_SCROLL_BUTTON_DISTANCE_FACTOR = 1
export const MESSAGE_LIST_AUTO_SCROLL_MAX_MS = 96
export const MESSAGE_LIST_SMOOTH_SCROLL_MAX_SPEED_PX_PER_MS = 13.2
export const MESSAGE_LIST_SMOOTH_SCROLL_EASE_DISTANCE_FACTOR = 2.1
export const MESSAGE_LIST_SMOOTH_SCROLL_ACCELERATION_BOOST_START = 0.44
export const MESSAGE_LIST_SMOOTH_SCROLL_ACCELERATION_BOOST_FACTOR = 0.4
export const MESSAGE_LIST_SMOOTH_SCROLL_MIN_STEP_PX = 10

export const LEGACY_GLOBAL_TAG_PROMPT_BLOCK_ID = 'legacy-global-tag-system-prompt'
export const LEGACY_GLOBAL_TAG_PROMPT_BLOCK_TITLE = '旧版全局标签提示词'

export const ACTINET_PROVIDER_ID = '__actinet__'
export const ACTINET_PROVIDER_NAME = 'ActiNet'

export const TRANSCRIPT_REPLAY_SYSTEM_PROMPT = `
历史上下文会以原始多轮转录的形式回放：

1. 历史 assistant 输出中可能出现 <progress>、<read>、<run>、<edit>、<final> 等标签，它们只是历史记录，不会再次执行。
2. 宿主会以 user 角色注入 <host_message>...</host_message> 作为工具结果或运行时反馈；这些内容不是用户新的自然语言输入。
3. 只有你当前正在生成的这一次回复中的动作标签会被宿主解析和执行。
`.trim()
