// The viewer only reads public data. Credentials never belong in browser code.
export const REPOSITORY = 'ryuya-matsubara/security-weekly';
const API = `https://api.github.com/repos/${REPOSITORY}`;
const FILE_PATTERN = /^(\d{4})(\d{2})(\d{2})_security-weekly\.json$/;
const MAX_REPORT_BYTES = 2 * 1024 * 1024;
const cache = new Map();

export class ReportError extends Error {
  constructor(message, kind = 'data') {
    super(message);
    this.name = 'ReportError';
    this.kind = kind;
  }
}

export function fileDate(name) {
  const match = FILE_PATTERN.exec(name);
  if (!match) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) return null;
  return date;
}

async function request(path, signal) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
  try {
    const response = await fetch(`${API}${path}`, {
      headers: { Accept: 'application/vnd.github+json' },
      credentials: 'omit',
      cache: 'no-cache',
      signal: controller.signal,
    });
    if (response.status === 429 || (response.status === 403 &&
        (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after')))) {
      const reset = Number(response.headers.get('x-ratelimit-reset'));
      const time = reset > 0 ? new Date(reset * 1000).toLocaleTimeString('ja-JP', {
        timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit',
      }) : '';
      throw new ReportError(`GitHubへのアクセスが一時的に制限されています。${time ? `${time}（日本時間）以降を目安に、` : 'しばらく待ってから、'}もう一度お試しください。`, 'rate-limit');
    }
    if (response.status === 404) {
      throw new ReportError('週報データを取得できませんでした。リポジトリが公開され、outputフォルダが存在するか確認してください。', 'unavailable');
    }
    if (!response.ok) throw new ReportError(`GitHubからデータを取得できませんでした（${response.status}）。時間をおいて再試行してください。`, 'network');
    return await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timedOut) throw new ReportError('読み込みに時間がかかっています。通信状況を確認して再試行してください。', 'network');
    if (error instanceof ReportError) throw error;
    throw new ReportError('通信に失敗しました。インターネット接続を確認して再試行してください。', 'network');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export async function listReports(signal) {
  const entries = await request('/contents/output?ref=main', signal);
  if (!Array.isArray(entries)) throw new ReportError('週報の一覧を読み取れませんでした。');
  // The Contents API returns at most 1,000 directory entries. Do not silently
  // select an older report from a possibly incomplete listing.
  if (entries.length >= 1000) throw new ReportError('週報フォルダの一覧取得上限に達しました。管理者による取得方式の更新が必要です。');
  return entries.filter(entry => entry.type === 'file' && fileDate(entry.name))
    .map(entry => ({ name: entry.name, date: fileDate(entry.name), sha: entry.sha, size: entry.size }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = value => typeof value === 'string';
const stringArray = value => Array.isArray(value) && value.every(isString);
const objectArray = value => Array.isArray(value) && value.every(isObject);
function need(condition) {
  if (!condition) throw new ReportError('週報JSONに必要な項目がないか、内容の形式に問題があります。別の週を選択するか、データの修正後に更新してください。');
}
function japanDate(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}

// Runtime data guards keep a damaged report from breaking the reader.
// This is not a JSON Schema validator or a claim of editorial verification.
function readReport(text, entry) {
  let report;
  try { report = JSON.parse(text); } catch {
    throw new ReportError('週報JSONを読み取れませんでした。データの修正後に更新するか、別の週を選択してください。');
  }
  need(isObject(report));
  if (report.is_example === true) throw new ReportError('このファイルは表示用サンプルです。実際の週報としては表示できません。', 'example');
  if (!['2.0.0', '3.0.0'].includes(report.schema_version)) throw new ReportError('この週報は未対応のデータ形式です。閲覧画面の更新が必要です。', 'version');
  need(report.is_example === false && isString(report.title) && isString(report.summary));
  need(['complete', 'partial', 'no_update'].includes(report.status));
  need(isObject(report.period) && report.period.timezone === 'Asia/Tokyo');
  const start = Date.parse(report.period.start), end = Date.parse(report.period.end_exclusive);
  need(Number.isFinite(start) && Number.isFinite(end) && end > start);
  need(japanDate(report.period.start) === entry.date);
  need(report.report_id === `security-weekly-${entry.date}`);
  need(isString(report.generated_at) && Number.isFinite(Date.parse(report.generated_at)));
  need(objectArray(report.articles) && report.articles.length <= 20);
  need(stringArray(report.top_article_ids) && report.top_article_ids.length <= 3);
  const ids = new Set();
  for (const article of report.articles) {
    need(isString(article.id) && /^a\d{3}$/.test(article.id) && !ids.has(article.id));
    ids.add(article.id);
    need(['headline', 'summary', 'details', 'category', 'content_type', 'priority', 'medium'].every(key => isString(article[key])));
    need(['vulnerability', 'incident', 'defense_operations', 'research_tools', 'policy_standards', 'expert_opinion'].includes(article.category));
    need(['facts', 'opinion', 'mixed'].includes(article.content_type));
    need(['high', 'medium', 'low'].includes(article.priority));
    need(['tags', 'implications', 'uncertainties', 'cve_ids'].every(key => stringArray(article[key])));
    need(isObject(article.author) && isString(article.author.name));
    need(objectArray(article.speakers) && article.speakers.every(person => isString(person.name)));
    need(objectArray(article.sources) && article.sources.length > 0);
    const sourceIds = new Set();
    for (const source of article.sources) {
      need(['id', 'title', 'url', 'publisher'].every(key => isString(source[key])) && !sourceIds.has(source.id));
      sourceIds.add(source.id);
    }
    need(objectArray(article.reasons) && article.reasons.length > 0);
    for (const reason of article.reasons) {
      need(isString(reason.type) && isString(reason.explanation) && stringArray(reason.source_ids));
      if (report.schema_version === '3.0.0') {
        need(['importance', 'attention'].includes(reason.type));
        need(reason.explanation.trim().length > 0 && reason.source_ids.length > 0);
      }
      need(reason.source_ids.every(id => sourceIds.has(id)));
      need(reason.metric === null || isObject(reason.metric));
    }
  }
  need(report.top_article_ids.every(id => ids.has(id)) && new Set(report.top_article_ids).size === report.top_article_ids.length);
  if (report.status === 'no_update') need(report.articles.length === 0 && report.top_article_ids.length === 0);
  need(isObject(report.coverage) && objectArray(report.coverage.source_checks) && objectArray(report.coverage.searches) && stringArray(report.coverage.limitations));
  need(isObject(report.spec) && objectArray(report.spec.files));
  need(isObject(report.validation) && stringArray(report.validation.notes));
  return report;
}

export async function loadReport(entry, signal) {
  need(entry && /^[0-9a-f]{40}$/.test(entry.sha));
  if (cache.has(entry.sha)) {
    const saved = cache.get(entry.sha);
    // Also enforce the name/date relationship if an identical blob is renamed.
    return { ...saved, report: readReport(saved.text, entry) };
  }
  if (entry.size > MAX_REPORT_BYTES) throw new ReportError('週報ファイルが大きすぎるため表示できません（上限2MB）。');
  // A blob SHA pins the content to the version returned by the directory listing.
  const blob = await request(`/git/blobs/${entry.sha}`, signal);
  need(blob.encoding === 'base64' && isString(blob.content));
  if (blob.size > MAX_REPORT_BYTES) throw new ReportError('週報ファイルが大きすぎるため表示できません（上限2MB）。');
  let text;
  try {
    const bytes = Uint8Array.from(atob(blob.content.replace(/\s/g, '')), char => char.charCodeAt(0));
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch { throw new ReportError('週報ファイルの文字コードを読み取れませんでした。UTF-8で保存してください。'); }
  const result = { text, report: readReport(text, entry) };
  cache.set(entry.sha, result);
  if (cache.size > 20) cache.delete(cache.keys().next().value);
  return result;
}
