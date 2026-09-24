import "./NewsInLevles.css";
console.log("NewsInLevels.js loaded");

/** 已读状态图标路径 */
const READED_ICON = 'assets/readed.svg';
/** 未读状态图标路径 */
const UNREAD_ICON = 'assets/unread.svg';

/** chrome.storage.local 中 News in Levels 已读记录的键名 */
const NEWS_IN_LEVELS_STORAGE_KEY = 'NewsInlevelsStorage';

/** 统一标题格式，便于 storage 与页面 DOM 文本匹配 */
function normalizeTitle(title) {
    return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** 写入 storage 的文章标题（保留大小写，仅整理空白） */
function formatArticleTitle(title) {
    return title.trim().replace(/\s+/g, ' ');
}

/** 当前页内存索引：归一化文章标题 -> 已读等级集合 */
let readLevelsByTitle = new Map();

/** 由 storage 记录构建标题 -> 已读等级 Set 的索引 */
function buildReadLevelsMap(records) {
    const map = new Map();
    for (const item of records) {
        const key = normalizeTitle(item.title);
        if (!map.has(key)) {
            map.set(key, new Set());
        }
        map.get(key).add(item.level);
    }
    return map;
}

/** 从 chrome.storage.local 读取已读记录列表 */
function getReadRecords() {
    return new Promise((resolve) => {
        chrome.storage.local.get(NEWS_IN_LEVELS_STORAGE_KEY, (result) => {
            const records = result[NEWS_IN_LEVELS_STORAGE_KEY];
            resolve(Array.isArray(records) ? records : []);
        });
    });
}

/** 将已读记录列表写入 chrome.storage.local */
function saveReadRecords(records) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [NEWS_IN_LEVELS_STORAGE_KEY]: records }, resolve);
    });
}

/** 判断 storage 中的一条记录是否与给定文章标题、等级相同 */
function recordsMatch(record, articleTitle, level) {
    return normalizeTitle(record.title) === normalizeTitle(articleTitle) && record.level === level;
}

/** 切换某篇文章某一等级的已读状态（写入或删除记录） */
async function toggleReadRecord(articleTitle, level, isCurrentlyRead) {
    const records = await getReadRecords();
    let nextRecords;

    if (isCurrentlyRead) {
        nextRecords = records.filter((record) => !recordsMatch(record, articleTitle, level));
    } else {
        nextRecords = [
            ...records.filter((record) => !recordsMatch(record, articleTitle, level)),
            {
                title: formatArticleTitle(articleTitle),
                level,
                markTime: Date.now(),
            },
        ];
    }

    await saveReadRecords(nextRecords);
    readLevelsByTitle = buildReadLevelsMap(nextRecords);
    return nextRecords;
}

/** 加载 storage 并刷新内存中的已读索引 */
async function loadFromStorage() {
    const records = await getReadRecords();
    readLevelsByTitle = buildReadLevelsMap(records);
}

/** 从详情页 h2 去掉 “– level N” / “- level N” 后缀，得到文章标题 */
function getDetailArticleTitle() {
    const h2 = document.querySelector('.article-upper .article-title h2');
    if (!h2) {
        return null;
    }
    return formatArticleTitle(
        h2.textContent.replace(/\s*[–-]\s*level\s+\d+\s*$/i, '')
    );
}

/** 从等级链接文案中解析 Level N 的数字部分 */
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
function createStatusIcon(link, articleTitle, level, isRead) {
    const img = document.createElement('img');
    img.src = chrome.runtime.getURL(isRead ? READED_ICON : UNREAD_ICON);
    img.alt = '';
    img.dataset.enReadHelper = 'status-icon';
    img.style.width = '1em';
    img.style.height = '1em';
    img.style.marginLeft = '0.25em';
    img.style.verticalAlign = 'middle';
    img.style.cursor = 'pointer';

    img.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const currentlyRead = readLevelsByTitle
            .get(normalizeTitle(articleTitle))
            ?.has(level) ?? false;

        toggleReadRecord(articleTitle, level, currentlyRead).then(() => {
            applyReadState(link, img, !currentlyRead);
        });
    });

    return img;
}

/** 在指定容器内为所有等级链接追加图标与已读状态（列表块或详情页共用） */
function decorateLevelLinks(root, articleTitle) {
    const readLevels = readLevelsByTitle.get(normalizeTitle(articleTitle)) ?? new Set();

    root.querySelectorAll('.fancy-buttons a').forEach((link) => {
        if (link.querySelector('[data-en-read-helper="status-icon"]')) {
            return;
        }

        const level = parseLevelFromLink(link);
        if (level == null) {
            return;
        }

        const isRead = readLevels.has(level);
        link.title = isRead ? '已读' : '未读';
        link.appendChild(createStatusIcon(link, articleTitle, level, isRead));
    });
}

/** 文章列表页：为每个 news-block 的等级按钮装饰已读图标 */
function markArticleLevels() {
    const container = document.querySelector('.recent-news');
    if (!container) {
        return;
    }

    container.querySelectorAll('.news-block').forEach((block) => {
        const titleEl = block.querySelector('.title h3 a');
        if (!titleEl) {
            return;
        }

        decorateLevelLinks(block, titleEl.textContent);
    });
}

/** 文章详情页：为顶部等级切换按钮装饰已读图标 */
function markDetailLevels() {
    const root = document.querySelector('.article-upper');
    if (!root?.querySelector('.date-and-level .fancy-buttons')) {
        return;
    }

    const articleTitle = getDetailArticleTitle();
    if (!articleTitle) {
        return;
    }

    decorateLevelLinks(root, articleTitle);
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
