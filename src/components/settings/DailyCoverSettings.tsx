import type { DailyCoverDefinition, DailyCoverSettings as DailyCoverSettingsType } from '../../services/daily-cover'
import { BUNDLED_DAILY_COVER_POOL } from '../../services/daily-cover'
import { DAILY_COVER_API_METHOD_OPTIONS } from '../../state/types'
import ChatInputBox from '../ChatInputBox'
import SettingsPopoverSelect from '../SettingsPopoverSelect'
import SettingsSectionHeading from '../SettingsSectionHeading'

interface DailyCoverSettingsProps {
  resolvedDailyCover: DailyCoverDefinition | null
  settings: DailyCoverSettingsType
  onUpdate: (key: keyof DailyCoverSettingsType, value: string | boolean) => void
}

export default function DailyCoverSettings({
  resolvedDailyCover,
  settings,
  onUpdate,
}: DailyCoverSettingsProps) {
  return (
    <div className="daily-cover-settings-page">
      <section className="settings-section">
        <div className="settings-static-card daily-cover-hero-card">
          {resolvedDailyCover ? <img src={resolvedDailyCover.imageUrl} alt={resolvedDailyCover.title} /> : null}
          <div className="content-wrap">
            <div className="daily-cover-kicker">
              {resolvedDailyCover
                ? `Today's cover · ${resolvedDailyCover.sourceLabel}`
                : 'Daily cover unavailable'}
            </div>
            <h3 className="daily-cover-title">
              {resolvedDailyCover
                ? `${resolvedDailyCover.title} · ${resolvedDailyCover.photographer}`
                : 'Daily Cover'}
            </h3>
            <p className="daily-cover-copy">
              {resolvedDailyCover?.description ?? '封面不可用时，界面会自动退回到安静的默认壳层。'}
            </p>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <SettingsSectionHeading
          label="Display rules"
          title="显示策略"
          copy="默认图池保证稳定，自定义 API 负责增强；失败时永远回退到本地内置图池。"
        />

        <div className="settings-static-card">
          <div className="daily-cover-field-list">
            <label className="daily-cover-field-row">
              <span className="name">启用首页每日风景封面</span>
              <input
                className="toggle-switch"
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) => onUpdate('enabled', event.target.checked)}
              />
            </label>

            <label className="daily-cover-field-row">
              <span className="name">使用自定义每日一图 API</span>
              <input
                className="toggle-switch"
                type="checkbox"
                checked={settings.useApi}
                onChange={(event) => onUpdate('useApi', event.target.checked)}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <SettingsSectionHeading
          label="Bundled pool"
          title="默认图池"
          copy="建议正式版本内置 12 到 24 张精选风景图。当前演示与真实设置都应把本地图池视为稳定回退层。"
        />

        <div className="settings-static-card">
          <p className="settings-entry-meta">
            默认图池用于保证稳定与冷启动体验。即使自定义 API 失败，也会自动回退到本地图池。
          </p>
          <div className="daily-cover-thumb-grid">
            {BUNDLED_DAILY_COVER_POOL.map((cover) => (
              <figure key={cover.id} className="daily-cover-thumb">
                <img src={cover.imageUrl} alt={cover.title} />
                <span>{cover.title}</span>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <SettingsSectionHeading
          label="Daily image API"
          title="自定义每日一图接口"
          copy="不要把来源写死成某一家；正式实现时继续支持 endpoint、auth 和字段映射。"
        />

        <div className="settings-static-card">
          <label className="field">
            <span>API Endpoint</span>
            <ChatInputBox
              className="settings-chat-input settings-chat-input-compact"
              value={settings.apiEndpoint}
              onChange={(event) => onUpdate('apiEndpoint', event.target.value)}
              placeholder="https://example.com/api/daily-cover?date={YYYY-MM-DD}"
              maxHeight={140}
            />
          </label>

          <label className="field">
            <span>Request Method</span>
            <SettingsPopoverSelect
              value={settings.apiMethod}
              options={[...DAILY_COVER_API_METHOD_OPTIONS]}
              ariaLabel="选择每日一图请求方法"
              onChange={(nextValue) => onUpdate('apiMethod', nextValue)}
            />
          </label>

          <label className="field">
            <span>Authorization Header</span>
            <ChatInputBox
              className="settings-chat-input settings-chat-input-compact"
              value={settings.apiAuthHeader}
              onChange={(event) => onUpdate('apiAuthHeader', event.target.value)}
              placeholder="Bearer YOUR_TOKEN"
              maxHeight={140}
            />
          </label>

          <label className="field">
            <span>Image URL Path</span>
            <ChatInputBox
              className="settings-chat-input settings-chat-input-compact"
              value={settings.apiImagePath}
              onChange={(event) => onUpdate('apiImagePath', event.target.value)}
              placeholder="data.image.url"
              maxHeight={140}
            />
          </label>

          <label className="field">
            <span>Title Path</span>
            <ChatInputBox
              className="settings-chat-input settings-chat-input-compact"
              value={settings.apiTitlePath}
              onChange={(event) => onUpdate('apiTitlePath', event.target.value)}
              placeholder="data.image.title"
              maxHeight={140}
            />
          </label>

          <label className="field">
            <span>Credit Path</span>
            <ChatInputBox
              className="settings-chat-input settings-chat-input-compact"
              value={settings.apiCreditPath}
              onChange={(event) => onUpdate('apiCreditPath', event.target.value)}
              placeholder="data.image.credit.name"
              maxHeight={140}
            />
          </label>

          <label className="field">
            <span>Credit Link Path</span>
            <ChatInputBox
              className="settings-chat-input settings-chat-input-compact"
              value={settings.apiLinkPath}
              onChange={(event) => onUpdate('apiLinkPath', event.target.value)}
              placeholder="data.image.credit.link"
              maxHeight={140}
            />
          </label>
        </div>
      </section>
    </div>
  )
}
