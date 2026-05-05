// Barrel export for skills service modules.
// External consumers should import from this file rather than reaching
// into individual sub-modules.

export type {
  SkillFrontmatter,
  SkillDocument,
  SkillSource,
  SkillRecord,
  SkillInstallResult,
  RuntimeType,
  RuntimeRecord,
  RuntimeInstallResult,
  SkillExecutionRequest,
  SkillExecutionResult,
  RunExecutionResult,
  ReadRoot,
  ReadOp,
  RunRoot,
  EditRoot,
  ReadAction,
  ReadListEntry,
  ReadListResult,
  ReadStatResult,
  ReadTextResult,
} from './types'

export type { InfoPromptSettingKey, InfoPromptDefinition, DeviceInfoPromptSnapshot, WorkspaceInfoPromptSnapshot } from './info-system-prompts'
export { INFO_PROMPT_SETTING_KEYS, createDeviceInfoPromptSnapshot, createWorkspaceInfoPromptSnapshot, resolveWorkspaceInfoPromptPath, buildDeviceInfoPromptMarkdown, buildWorkspaceInfoPromptMarkdown, INFO_PROMPT_DEFINITIONS, DEFAULT_INFO_PROMPT_SETTINGS, normalizeInfoPromptOverride } from './info-system-prompts'

export type { InternalActionLocation, ExternalActionLocation } from './action-location'
export { toExternalActionLocation, parseInternalActionLocation, isInternalActionLocation } from './action-location'

export { DEFAULT_GENERAL_TAG_SYSTEM_PROMPT, DEFAULT_TOP_LEVEL_TAG_SYSTEM_PROMPT, DEFAULT_READ_SYSTEM_PROMPT, DEFAULT_RUN_SYSTEM_PROMPT, DEFAULT_EDIT_SYSTEM_PROMPT, DEFAULT_SKILL_CALL_SYSTEM_PROMPT, migrateLegacyTagSystemPrompts } from './default-system-prompts'
export type { LegacyTagSystemPromptMigrationResult } from './default-system-prompts'

export { executeSkillCall, executeRunAction, materializeRunAction, executeReadAction, executeEditAction } from './executor'

export { parseSkillDocument, readFrontmatterOnly, renderSkillsCatalogYaml } from './frontmatter'

export { getBuiltinSkillRoot, resolveSkillRoot, listSkillDirectory, statSkillPath, readSkillFile, initializeSkillHost, listSkills, readSkillConfig, writeSkillConfig, setSkillEnabled, deleteSkill, installSkillPackage } from './host'

export { isNativeRuntimeAvailable } from './native-runtime'

export type { SkillActionPreview, SkillActionStreamEvent, SkillActionPlaceholderSegment, AgentStreamDelta, SkillAgentProtocolExtraction, SkillAgentProtocolRepair, SkillAgentFinalOutcome, SkillAgentRetryOutcome, SkillAgentProtocolOutcome } from './protocol'
export { createSkillActionPlaceholder, splitSkillActionPlaceholders, createAgentStreamParser, extractSkillAgentProtocolText, normalizeSkillAgentProtocolResponse, parseAgentActions, formatStructuredMarkdown, buildSkillsCatalogBlock } from './protocol'

export type { MaterializedRunAction } from './run-executor'

export type { ParsedRunSimpleCommand } from './run-parser'
export { parseRunSimpleCommand } from './run-parser'

export { resolveRunLaunch } from './run-resolver'

export { initializeRuntimeHost, ensureBundledRuntimesInstalled, listRuntimes, installRuntimePackage, setRuntimeEnabled, setDefaultRuntime, deleteRuntime, getPreferredRuntimePaths, testRuntime } from './runtime'

export { SKILL_DIRECTORIES, joinRelativePath, ensureSafeRelativePath, ensureDirectory, pathExists, statPath, readTextFile, writeTextFile, writeBinaryFile, deletePath, readJsonFile, writeJsonFile, listDirectory, installZipDirectory, initializeStorage } from './storage'
export type { RelativePathStat } from './storage'

export type { ApplyTextEditsOptions, ApplyTextEditsResult } from './text-edit'
export { applyTextEdits } from './text-edit'

export { executeDeviceInfoSkillCall } from './device-info'
