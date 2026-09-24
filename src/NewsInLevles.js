import "./NewsInLevles.css";
console.log("NewsInLevels.js loaded");

/** 已读状态图标路径 */
const READED_ICON = 'assets/readed.svg';
/** 未读状态图标路径 */
const UNREAD_ICON = 'assets/unread.svg';

/** chrome.storage.local 中 News in Levels 已读记录的键名 */
const NEWS_IN_LEVELS_STORAGE_KEY = 'NewsInlevelsStorage';

/**
 * NewsInlevelsStorage 存 Array<ReadRecord>
 *
 * ReadRecord:
 * - url {string}  某一等级文章页的链接（来自列表/详情 .fancy-buttons 里 Level 按钮的 <a href>，规范化后写入）
 * - markTime {number}  标记为已读的时间戳（Date.now()，毫秒）
 *
 * 同一等级对应唯一 url（如 .../pig-heads-in-paris-level-2），不再使用 title + level。
 */

/** 将等级按钮 href 规范为统一字符串，避免尾斜杠等差异导致匹配失败 */
function normalizeArticleUrl(href) {
    const url = new URL(href, location.href);
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.href;
}

/** 只保留新格式记录；旧 title/level 数据不迁移，读取时丢弃 */
function sanitizeRecords(records) {
    if (!Array.isArray(records)) {
        return [];
    }
    return records.filter(
        (item) => item && typeof item.url === 'string' && item.url.trim() !== ''
    );
}

/** 当前页内存索引：已读文章页 url（规范化后）集合 */
let readUrlSet = new Set();

/** 由 storage 记录构建已读 url 集合 */
function buildReadUrlSet(records) {
    const set = new Set();
    for (const item of sanitizeRecords(records)) {
        set.add(normalizeArticleUrl(item.url));
    }
    return set;
}

/** 从 chrome.storage.local 读取已读记录列表 */
function getReadRecords() {
    return new Promise((resolve) => {
        chrome.storage.local.get(NEWS_IN_LEVELS_STORAGE_KEY, (result) => {
            const records = result[NEWS_IN_LEVELS_STORAGE_KEY];
            resolve(sanitizeRecords(records));
        });
    });
}

/** 将已读记录列表写入 chrome.storage.local */
function saveReadRecords(records) {
    const sanitized = sanitizeRecords(records);
    return new Promise((resolve) => {
        chrome.storage.local.set({ [NEWS_IN_LEVELS_STORAGE_KEY]: sanitized }, resolve);
    });
}

/** 判断 storage 中的一条记录是否与给定 url 相同 */
function recordsMatch(record, articleUrl) {
    return normalizeArticleUrl(record.url) === normalizeArticleUrl(articleUrl);
}

/** 切换某一等级文章页 url 的已读状态（写入或删除记录） */
async function toggleReadRecord(articleUrl, isCurrentlyRead) {
    const records = await getReadRecords();
    const normalized = normalizeArticleUrl(articleUrl);
    let nextRecords;

    if (isCurrentlyRead) {
        nextRecords = records.filter((record) => !recordsMatch(record, normalized));
    } else {
        nextRecords = [
            ...records.filter((record) => !recordsMatch(record, normalized)),
            {
                url: normalized,
                markTime: Date.now(),
            },
        ];
    }

    await saveReadRecords(nextRecords);
    readUrlSet = buildReadUrlSet(nextRecords);
    return nextRecords;
}

/** 加载 storage 并刷新内存中的已读索引 */
async function loadFromStorage() {
    const records = await getReadRecords();
    readUrlSet = buildReadUrlSet(records);
}

/** 从等级链接文案中解析 Level N 的数字部分（用于过滤非等级链接） */
function parseLevelFromLink(link) {
    const match = link.textContent.trim().match(/^Level\s+(\d+)/);
    return match ? Number(match[1]) : null;
}

/** 更新等级链接与图标的已读/未读展示（图标 src 与链接 title 提示） */
function applyReadState(link, icon, isRead) {
    icon.src = chrome.runtime.getURL(isRead ? READED_ICON : UNREAD_ICON);
    link.title = isRead ? '已读' : '未读';
}

/** 创建等级按钮后的已读/未读图标，点击可切换 storage 且不触发链接跳转 */
function createStatusIcon(link, isRead) {
    const img = document.createElement('img');
    img.src = chrome.runtime.getURL(isRead ? READED_ICON : UNREAD_ICON);
    img.alt = '';
    img.dataset.enReadHelper = 'status-icon';
    img.style.width = '1em';
    img.style.height = '1em';
    img.style.marginLeft = '0.25em';
    img.style.verticalAlign = 'middle';
    img.style.cursor = 'pointer';
    img.style.filter = 'brightness(0) invert(1)';

    img.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const articleUrl = normalizeArticleUrl(link.href);
        const currentlyRead = readUrlSet.has(articleUrl);

        toggleReadRecord(articleUrl, currentlyRead).then(() => {
            applyReadState(link, img, !currentlyRead);
        });
    });

    return img;
}

/** 在指定容器内为所有等级链接追加图标与已读状态（列表块或详情页共用） */
function decorateLevelLinks(root) {
    root.querySelectorAll('.fancy-buttons a').forEach((link) => {
        if (link.querySelector('[data-en-read-helper="status-icon"]')) {
            return;
        }

        if (parseLevelFromLink(link) == null) {
            return;
        }

        const articleUrl = normalizeArticleUrl(link.href);
        const isRead = readUrlSet.has(articleUrl);
        link.title = isRead ? '已读' : '未读';
        link.appendChild(createStatusIcon(link, isRead));
    });
}

/** 文章列表页：为每个 news-block 的等级按钮装饰已读图标 */
function markArticleLevels() {
    const container = document.querySelector('.recent-news');
    if (!container) {
        return;
    }

    container.querySelectorAll('.news-block').forEach((block) => {
        decorateLevelLinks(block);
    });
}

/** 文章详情页：为顶部等级切换按钮装饰已读图标 */
function markDetailLevels() {
    const root = document.querySelector('.article-upper');
    if (!root?.querySelector('.date-and-level .fancy-buttons')) {
        return;
    }

    decorateLevelLinks(root);
}

/** 加载已读数据并装饰列表页、详情页（二者互斥存在时只跑匹配到的那一侧） */
async function initPage() {
    await loadFromStorage();
    markArticleLevels();
    markDetailLevels();
}

/** DOM 就绪后再初始化，避免节点尚未插入 */
function runWhenDomReady() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPage);
    } else {
        initPage();
    }
}

runWhenDomReady();
