import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const handoffDir = join(repoRoot, 'docs', 'development-status', 'handoff-updates');
const logPath = join(repoRoot, 'docs', 'development-status', '40-handoff-log.md');

// Read the monolithic file
const content = readFileSync(logPath, 'utf-8');

// First line is the title "# Handoff Log", skip it
// Split on "## 2026-" headers (each entry starts with this)
const titleLine = content.split('\n')[0];
const rest = content.substring(content.indexOf('\n') + 1).trim();

// Split by double-newline followed by ## 2026
const sections = rest.split(/\n(?=## 2026)/);

// Date-to-slug mapping (chronological order)
const slugMap = {
  '2026-04-28': { num: '001', slug: 'union-search-runtime-refactor' },
  '2026-04-29': { num: '002', slug: 'edit-protocol-native-path' },
  '2026-04-30': { num: '003', slug: 'response-mode-conversation-owned' },
  '2026-05-01': { num: '004', slug: 'editorial-homepage-redesign' },
  '2026-05-02': { num: '005', slug: 'chat-storage-and-shared-editorial' },
  '2026-05-03': { num: '006', slug: 'homepage-transition-and-runtime-fix' },
  '2026-05-04': { num: '007', slug: 'bottom-composer-glass-and-ui-fixes' },
  '2026-05-05': { num: '008', slug: 'active-chat-ui-tweaks' },
  '2026-05-06': { num: '009', slug: 'light-mode-tag-protocol-and-composer-fixes' },
  '2026-05-08': { num: '010', slug: 'default-prompt-versioning' },
  '2026-05-09': { num: '011', slug: 'chat-chrome-blur-and-drawer' },
  '2026-05-11': { num: '012', slug: 'debug-apk-lan-share' },
};

// Group sections by date
const groups = {};

for (const section of sections) {
  // Extract date from header like "## 2026-05-11 — ..." or "## 2026-05-06 21:15 +08:00 — ..."
  const match = section.match(/^## (2026-\d{2}-\d{2})/);
  if (!match) continue;

  const date = match[1];
  if (!slugMap[date]) {
    console.warn(`No slug mapping for date: ${date}`);
    continue;
  }

  if (!groups[date]) {
    groups[date] = [];
  }
  groups[date].push(section);
}

// Ensure directory exists
mkdirSync(handoffDir, { recursive: true });

// Write grouped files (in chronological order based on num)
const orderedDates = Object.keys(slugMap).sort((a, b) => {
  return slugMap[a].num.localeCompare(slugMap[b].num);
});

for (const date of orderedDates) {
  if (!groups[date] || groups[date].length === 0) {
    console.warn(`No entries found for date: ${date}`);
    continue;
  }

  const { num, slug } = slugMap[date];
  const filename = `${num}-${slug}.md`;
  const filepath = join(handoffDir, filename);

  // Build file content
  const sectionsContent = groups[date].join('\n');
  const dateLabel = date;
  const header = `# ${num} — ${slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}

**Period**: ${dateLabel}

> Migrated from monolithic \`40-handoff-log.md\`. See git history for original context.

`;

  writeFileSync(filepath, header + '\n' + sectionsContent);
  console.log(`Wrote ${filename} (${groups[date].length} entries, ~${sectionsContent.length} chars)`);
}

console.log(`\nDone. ${orderedDates.filter(d => groups[d]).length} files created in handoff-updates/`);
