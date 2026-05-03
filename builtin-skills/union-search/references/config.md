# Config

Main runtime keys:

- `defaultProviders`
- `siteSearchProviders`
- `defaultUnionPlatforms`
- `defaultImageProviders`
- `defaultLimit`
- `requestTimeoutMs`
- `rssFeeds`

`fetchUrl` keys:

- `preferredEngine`
  - recommended default: `html`
  - supported values: `html`, `direct`, `browser`
- `browserTimeoutMs`
- `browserVirtualTimeBudgetMs`
- `browserExecutable`
- `browserArguments`
- `maxContentChars`
- `maxLinks`
- `maxImages`
- `maxHeadings`
- `includeMetadata`
- `includeHeadings`
- `includeLinkIndex`
- `includeImageIndex`

Browser executable resolution order:

1. `--browser-executable`
2. `UNION_SEARCH_BROWSER_EXECUTABLE`
3. `CHROME_PATH`
4. `EDGE_PATH`
5. common Chrome / Edge install paths for the current OS

Browser mode does not silently fall back to HTML mode when the user explicitly asks for `--extract browser`.
