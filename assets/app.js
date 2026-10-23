import { REPOSITORY, ReportError, listReports, loadReport } from './report-loader.js';

const CATEGORIES = {
  vulnerability: '脆弱性', incident: 'インシデント', defense_operations: '防御・運用',
  research_tools: '研究・ツール', policy_standards: '政策・標準', expert_opinion: '専門家の見解',
};
const REASONS = { importance: '重要性', attention: '注目度', expertise: '専門性', novelty: '新規性', relevance: 'インフラとの関連' };
const CONTENT_TYPES = { facts: '事実', opinion: '意見', mixed: '事実と意見を含む' };
const CHECK_STATUSES = {
  checked_with_candidates: '候補あり', checked_no_candidates: '該当候補なし',
  access_failed: '取得できず', search_only: '検索のみ', not_checked: '未確認',
};
const SOURCE_ROLES = { primary: '一次資料', reporting: '報道', analysis: '解説', original_post: '本人の投稿', paper: '論文', tool: 'ツール' };
const READ_STATUSES = { page_read: '本文確認', snippet_only: '検索の抜粋のみ', unavailable: '取得できず' };
const $ = id => document.getElementById(id);
const state = {
  entries: [], entry: null, data: null, listing: false, sequence: 0,
  controller: null, filters: new Map(), positions: new Map(),
};
const repoURL = `https://github.com/${REPOSITORY}`;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}
function externalLink(label, url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return node('span', label);
    const anchor = node('a', label);
    anchor.href = parsed.href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    return anchor;
  } catch { return node('span', label); }
}
function formatDate(value, withTime = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return '不明';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value));
}
function issueLabel(entry) { return `${formatDate(`${entry.date}T00:00:00+09:00`)} 開始の週`; }
function periodLabel(report) {
  return `${formatDate(report.period.start)} — ${formatDate(new Date(Date.parse(report.period.end_exclusive) - 1).toISOString())}`;
}
function listOf(items) {
  const ul = node('ul');
  for (const item of items) ul.append(node('li', item));
  return ul;
}
function values(rows) {
  const dl = node('dl', null, 'key-values');
  for (const [label, value] of rows) {
    if (value === null || value === undefined || value === '') continue;
    const dd = node('dd');
    dd.append(value instanceof Node ? value : node('span', value));
    dl.append(node('dt', label), dd);
  }
  return dl;
}
function section(parent, title, content) {
  if (!content) return;
  parent.append(node('h2', title), content);
}
function badge(label, className = '') { return node('span', label, `badge ${className}`); }
function route() {
  const params = new URLSearchParams(location.hash.slice(1));
  return { week: params.get('week'), article: params.get('article') };
}
function hashFor(entry, article) {
  const params = new URLSearchParams();
  if (entry) params.set('week', entry.date.replaceAll('-', ''));
  if (article) params.set('article', article);
  return params.size ? `#${params}` : '#';
}
function rememberList(article = null) {
  if (!state.entry || $('list-view').hidden) return;
  state.positions.set(state.entry.name, { scroll: window.scrollY, article });
  state.filters.set(state.entry.name, filterValues());
}
function navigate(entry, article, replace = false) {
  rememberList(article);
  const fromList = Boolean(article && !$('list-view').hidden);
  history[replace ? 'replaceState' : 'pushState']({ securityWeekly: true, fromList }, '', hashFor(entry, article));
  renderRoute();
}
function announce(message) { $('announcement').textContent = message; }
function showState(title, message, retry = false) {
  $('list-view').hidden = true;
  $('detail-view').hidden = true;
  $('load-state').hidden = false;
  $('state-title').textContent = title;
  $('state-message').textContent = message;
  $('retry').hidden = !retry;
  document.title = `${title} | セキュリティ週報`;
}
function showError(error) {
  showState('週報を読み込めませんでした', error instanceof ReportError ? error.message : '読み込みに失敗しました。もう一度お試しください。', true);
}
function beginRequest() {
  state.controller?.abort();
  state.controller = new AbortController();
  return { signal: state.controller.signal, sequence: ++state.sequence };
}
function fillIssueSelect() {
  $('issue-select').replaceChildren();
  for (const [index, entry] of state.entries.entries()) {
    const option = node('option', `${issueLabel(entry)}${index === 0 ? '（最新）' : ''}`);
    option.value = entry.date.replaceAll('-', '');
    $('issue-select').append(option);
  }
  if (!state.entries.length) $('issue-select').append(node('option', '週報はまだありません'));
  $('issue-select').disabled = !state.entries.length;
}

async function refreshReports() {
  if (state.listing) return;
  rememberList();
  const request = beginRequest();
  state.listing = true;
  $('refresh').disabled = true;
  $('issue-select').disabled = true;
  showState('週報を読み込んでいます', '最新の週報一覧を取得しています。');
  try {
    const entries = await listReports(request.signal);
    if (request.sequence !== state.sequence) return;
    state.entries = entries;
    state.entry = null;
    state.data = null;
    fillIssueSelect();
    state.listing = false;
    await renderRoute();
  } catch (error) {
    if (request.sequence !== state.sequence) return;
    state.listing = false;
    state.entry = null;
    state.data = null;
    fillIssueSelect();
    showError(error);
  } finally {
    state.listing = false;
    $('refresh').disabled = false;
  }
}

async function renderRoute() {
  if (state.listing) return;
  const request = beginRequest();
  if (!state.entries.length) {
    $('refresh').disabled = false;
    showState('まだ週報がありません', '週報が追加されると、ここに最新号が表示されます。');
    return;
  }
  const requested = route();
  const entry = requested.week
    ? state.entries.find(item => item.date.replaceAll('-', '') === requested.week)
    : state.entries[0];
  if (!entry) {
    $('refresh').disabled = false;
    $('issue-select').value = '';
    showState('指定された週報が見つかりません', '上の「週報を選ぶ」から、読みたい週を選択してください。', true);
    return;
  }
  $('issue-select').value = entry.date.replaceAll('-', '');
  $('refresh').disabled = true;
  try {
    if (state.entry?.sha !== entry.sha || state.entry?.name !== entry.name || !state.data) {
      showState('週報を読み込んでいます', `${issueLabel(entry)}の情報を取得しています。`);
      state.entry = null;
      state.data = null;
      const data = await loadReport(entry, request.signal);
      if (request.sequence !== state.sequence) return;
      state.entry = entry;
      state.data = data;
    }
    if (request.sequence !== state.sequence) return;
    $('load-state').hidden = true;
    if (requested.article) renderDetail(requested.article);
    else renderList();
  } catch (error) {
    if (request.sequence === state.sequence) showError(error);
  } finally {
    if (request.sequence === state.sequence) $('refresh').disabled = false;
  }
}

function articleLink(article, label) {
  const anchor = node('a', label);
  anchor.href = hashFor(state.entry, article.id);
  anchor.dataset.article = article.id;
  return anchor;
}
function createCard(article, index = null) {
  const card = node('article', null, `card${index !== null ? ' featured' : ''}`);
  const top = node('div', null, 'card-top');
  top.append(badge(CATEGORIES[article.category]));
  if (index !== null) top.append(node('span', String(index + 1).padStart(2, '0'), 'card-number'));
  else if (article.priority === 'high') top.append(badge('重要', 'priority'));
  const title = node('h3');
  title.append(articleLink(article, article.headline));
  const badges = node('div', null, 'badges');
  if (article.content_type !== 'facts') badges.append(badge(CONTENT_TYPES[article.content_type], 'opinion'));
  const reasonNames = [...new Set(article.reasons.map(reason => REASONS[reason.type] || reason.type))];
  card.append(top, title);
  if (badges.childNodes.length) card.append(badges);
  card.append(node('p', article.summary, 'card-summary'), node('p', `掲載理由：${reasonNames.join('・')}`, 'reason-labels'));
  const footer = node('div', null, 'card-footer');
  footer.append(node('span', article.author.name, 'card-author'), articleLink(article, '詳しく読む →'));
  card.append(footer);
  return card;
}
function populateSelect(id, items, placeholder, selected) {
  const select = $(id);
  const first = node('option', placeholder);
  first.value = '';
  select.replaceChildren(first);
  for (const [value, label] of items) {
    const option = node('option', label);
    option.value = value;
    select.append(option);
  }
  select.value = items.some(([value]) => value === selected) ? selected : '';
}
function renderList() {
  const report = state.data.report;
  $('detail-view').hidden = true;
  $('list-view').hidden = false;
  document.title = `${periodLabel(report)} | セキュリティ週報`;
  $('issue-label').textContent = state.entry.name === state.entries[0].name ? 'LATEST ISSUE / 最新号' : 'ARCHIVE / 過去号';
  $('issue-title').textContent = '今週のセキュリティ';
  $('issue-period').textContent = periodLabel(report);
  $('issue-meta').replaceChildren(node('span', `${report.articles.length}件の記事`), node('span', `作成 ${formatDate(report.generated_at, true)}（日本時間）`));
  $('issue-summary').textContent = report.summary;
  $('partial-notice').hidden = report.status !== 'partial';
  $('partial-notice').textContent = '一部の情報源・調査項目に未確認の内容があります。ページ下部の「調査範囲と未確認事項」で確認できます。';
  $('highlight-cards').replaceChildren();
  for (const [index, id] of report.top_article_ids.entries()) {
    $('highlight-cards').append(createCard(report.articles.find(article => article.id === id), index));
  }
  $('highlights').hidden = report.top_article_ids.length === 0;
  const saved = state.filters.get(state.entry.name) || { query: '', category: '', reason: '', tag: '' };
  $('search').value = saved.query;
  populateSelect('category', Object.entries(CATEGORIES), 'すべてのジャンル', saved.category);
  populateSelect('reason', Object.entries(REASONS), 'すべての掲載理由', saved.reason);
  const tags = [...new Set(report.articles.flatMap(article => article.tags))].sort((a, b) => a.localeCompare(b, 'ja'));
  populateSelect('tag', tags.map(tag => [tag, tag]), 'すべてのタグ', saved.tag);
  $('extra-filters').open = Boolean(saved.reason || saved.tag);
  renderCards();
  renderCoverage(report);
  renderReportInfo(report);
  announce(`${periodLabel(report)}、${report.articles.length}件の記事を表示しました。`);
  const position = state.positions.get(state.entry.name);
  requestAnimationFrame(() => {
    if ($('list-view').hidden) return;
    window.scrollTo({ top: position?.scroll || 0, behavior: 'auto' });
    if (position?.article) {
      document.querySelector(`[data-article="${position.article}"]`)?.focus({ preventScroll: true });
    }
  });
}
function filterValues() {
  return { query: $('search').value, category: $('category').value, reason: $('reason').value, tag: $('tag').value };
}
function normalize(text) { return String(text).normalize('NFKC').toLocaleLowerCase('ja-JP'); }
function renderCards() {
  if (!state.data) return;
  const filters = filterValues();
  state.filters.set(state.entry.name, filters);
  const words = normalize(filters.query).trim().split(/\s+/).filter(Boolean);
  const articles = state.data.report.articles.filter(article => {
    if (filters.category && article.category !== filters.category) return false;
    if (filters.reason && !article.reasons.some(reason => reason.type === filters.reason)) return false;
    if (filters.tag && !article.tags.includes(filters.tag)) return false;
    const text = normalize([
      article.headline, article.summary, article.details, article.author.name, article.author.affiliation || '',
      ...article.speakers.map(person => person.name), ...article.tags, ...article.cve_ids,
    ].join(' '));
    return words.every(word => text.includes(word));
  });
  $('article-cards').replaceChildren(...articles.map(article => createCard(article)));
  $('result-count').textContent = `${articles.length} / ${state.data.report.articles.length}件`;
  $('clear-filters').hidden = !Object.values(filters).some(Boolean);
  $('no-results').hidden = articles.length > 0;
  $('no-results').textContent = state.data.report.status === 'no_update'
    ? 'この期間は、掲載基準に該当する記事がありませんでした。'
    : state.data.report.articles.length === 0 ? 'この週報に掲載された記事はありません。' : '条件に一致する記事がありません。キーワードや絞り込みを変更してください。';
}

function renderCoverage(report) {
  const container = $('coverage');
  container.replaceChildren();
  container.append(node('h3', '調査上の制限・未確認事項'));
  container.append(report.coverage.limitations.length ? listOf(report.coverage.limitations) : node('p', '記載された制限・未確認事項はありません。'));
  container.append(node('h3', '情報源の確認状況'));
  if (!report.coverage.source_checks.length) container.append(node('p', '確認状況の記録はありません。'));
  for (const check of report.coverage.source_checks) {
    const row = node('div', null, 'coverage-row');
    row.append(externalLink(check.name || '情報源', check.url), node('p', CHECK_STATUSES[check.status] || '状況不明'));
    if (check.notes) row.append(node('p', check.notes));
    container.append(row);
  }
  const searches = node('details');
  searches.append(node('summary', `検索の記録（${report.coverage.searches.length}件）`));
  for (const search of report.coverage.searches) {
    const row = node('div', null, 'coverage-row');
    row.append(node('strong', search.query || '検索語の記録なし'));
    row.append(node('p', `${search.language || ''} / ${formatDate(search.searched_at, true)}`));
    if (search.notes) row.append(node('p', search.notes));
    if (Array.isArray(search.reviewed_urls)) {
      const links = node('div', null, 'reason-links');
      search.reviewed_urls.forEach((url, index) => links.append(externalLink(`確認先${index + 1}`, url)));
      row.append(links);
    }
    searches.append(row);
  }
  container.append(searches);
}
function renderReportInfo(report) {
  const container = $('report-info');
  const sha = typeof report.spec.commit_sha === 'string' && /^[0-9a-f]{40}$/.test(report.spec.commit_sha) ? report.spec.commit_sha : null;
  container.replaceChildren(values([
    ['週報名', report.title], ['週報ID', report.report_id], ['形式の版', report.schema_version],
    ['調査方針の版', report.policy_version], ['情報源の版', report.sources_version],
    ['編集上の確認', report.validation.editorial_review === 'completed' ? '内容・出典を確認済み（AIによる確認）' : '確認の完了記録なし'],
    ['参照した仕様', sha ? externalLink(sha, `${repoURL}/commit/${sha}`) : '記録なし'],
    ['JSONファイル', externalLink(state.entry.name, `${repoURL}/blob/main/output/${encodeURIComponent(state.entry.name)}`)],
  ]));
  if (report.validation.notes.length) container.append(listOf(report.validation.notes));
}

function renderDetail(id) {
  const article = state.data.report.articles.find(item => item.id === id);
  $('list-view').hidden = true;
  $('detail-view').hidden = false;
  const parent = $('article-detail');
  parent.className = 'article-detail';
  parent.replaceChildren();
  if (!article) {
    const title = node('h1', '記事が見つかりません');
    title.id = 'detail-title';
    parent.append(title, node('p', '記事一覧に戻って、読みたい記事を選択してください。'));
    document.title = '記事が見つかりません | セキュリティ週報';
    return;
  }
  document.title = `${article.headline} | セキュリティ週報`;
  const badges = node('div', null, 'badges');
  badges.append(badge(CATEGORIES[article.category]), badge(CONTENT_TYPES[article.content_type], article.content_type === 'facts' ? '' : 'opinion'));
  if (article.priority === 'high') badges.append(badge('重要', 'priority'));
  article.tags.forEach(tag => badges.append(badge(tag)));
  const title = node('h1', article.headline);
  title.id = 'detail-title';
  title.tabIndex = -1;
  parent.append(badges, title, values([
    ['対象期間', periodLabel(state.data.report)], ['公開日', formatDate(article.published_at)],
    ['更新日', article.updated_at ? formatDate(article.updated_at) : null], ['媒体', article.medium],
  ]), node('h2', '概要'), node('p', article.summary, 'article-lead'));
  section(parent, '詳しい内容', node('p', article.details));
  section(parent, '今回の続報', article.update_note ? node('p', article.update_note) : null);
  section(parent, '実務への示唆', article.implications.length ? listOf(article.implications) : null);
  section(parent, '未確認事項・留意点', article.uncertainties.length ? listOf(article.uncertainties) : null);
  const reasons = node('div');
  for (const reason of article.reasons) {
    const block = node('div', null, 'reason-block');
    block.append(node('h3', REASONS[reason.type] || reason.type), node('p', reason.explanation));
    if (reason.metric) block.append(node('p', `${reason.metric.name || '指標'}：${reason.metric.value ?? '不明'}（${formatDate(reason.metric.captured_at, true)}時点）`));
    const links = node('div', null, 'reason-links');
    for (const sourceId of reason.source_ids) {
      const source = article.sources.find(item => item.id === sourceId);
      if (source) links.append(externalLink(source.title, source.url));
    }
    block.append(links);
    reasons.append(block);
  }
  section(parent, 'この記事を選んだ理由', reasons);
  const people = node('div');
  for (const [index, person] of [article.author, ...article.speakers].entries()) {
    people.append(node('h3', index === 0 ? '著者・発信者' : '記事内の発言者'), values([
      ['名前', person.name], ['所属', person.affiliation], ['専門性', person.expertise],
    ]));
  }
  section(parent, '発信者について', people);
  if (article.cve_ids.length) section(parent, '関連するCVE', listOf(article.cve_ids));
  const sources = node('div');
  for (const source of article.sources) {
    const item = node('div', null, 'source-item');
    item.append(externalLink(`${source.title} ↗`, source.url));
    item.append(node('p', [source.publisher, source.author, SOURCE_ROLES[source.role], READ_STATUSES[source.read_status]].filter(Boolean).join(' / ')));
    if (source.published_at) item.append(node('p', `公開 ${formatDate(source.published_at)}`));
    if (source.updated_at) item.append(node('p', `更新 ${formatDate(source.updated_at)}`));
    if (source.notes) item.append(node('p', source.notes));
    sources.append(item);
  }
  section(parent, '出典・原文を読む', sources);
  const basis = node('details');
  basis.append(node('summary', '掲載期間について'), node('p', article.period_basis || '記載なし'));
  if (article.event_date) basis.append(node('p', `出来事の日付：${article.event_date}`));
  parent.append(basis);
  requestAnimationFrame(() => {
    if ($('detail-view').hidden) return;
    window.scrollTo({ top: 0, behavior: 'auto' });
    title.focus({ preventScroll: true });
  });
  announce(`${article.headline}の詳細を表示しました。`);
}

$('issue-select').addEventListener('change', event => {
  const entry = state.entries.find(item => item.date.replaceAll('-', '') === event.target.value);
  if (entry) navigate(entry);
});
$('refresh').addEventListener('click', refreshReports);
$('retry').addEventListener('click', refreshReports);
$('back').addEventListener('click', () => {
  if (history.state?.securityWeekly && history.state.fromList) history.back();
  else navigate(state.entry, null, true);
});
document.querySelector('.brand').addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(null);
});
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-article]');
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(state.entry, link.dataset.article);
});
$('search').addEventListener('input', renderCards);
for (const id of ['category', 'reason', 'tag']) $(id).addEventListener('change', renderCards);
$('clear-filters').addEventListener('click', () => {
  for (const id of ['search', 'category', 'reason', 'tag']) $(id).value = '';
  renderCards();
});
$('download').addEventListener('click', () => {
  if (!state.data || !state.entry) return;
  const url = URL.createObjectURL(new Blob([state.data.text], { type: 'application/json;charset=utf-8' }));
  const anchor = node('a');
  anchor.href = url;
  anchor.download = state.entry.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});
let routeTimer;
function routeChanged() {
  clearTimeout(routeTimer);
  routeTimer = setTimeout(renderRoute, 0);
}
window.addEventListener('popstate', routeChanged);
window.addEventListener('hashchange', routeChanged);
refreshReports();
