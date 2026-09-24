import "./BreakingNewsEnglish.css";

console.log("BreakingNewsEnglish.js loaded");

/** 已读状态图标路径 */
const READED_ICON = "assets/readed.svg";
/** 未读状态图标路径 */
const UNREAD_ICON = "assets/unread.svg";

/** chrome.storage.local 中 Breaking News English 已读记录的键名 */
const BREAKING_NEWS_ENGLISH_STORAGE_KEY = "BreakingNewsEnglishStorage";

/**
 * BreakingNewsEnglishStorage 存 Array<ReadRecord>
 *
 * ReadRecord:
 * - url {string}  文章页链接（列表项 <a href>，规范化后写入）
 * - markTime {number}  标记为已读的时间戳（Date.now()，毫秒）
 */

/** 列表文章相对 href 形如 2609/260924-toys-r-us.html */
const ARTICLE_HREF_PATTERN = /^\d{4}\/\d{6}-.+\.html$/i;

/** 将文章 href 规范为统一字符串，避免尾斜杠等差异导致匹配失败 */
function normalizeArticleUrl(href) {
    const url = new URL(href, location.href);
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.href;
}

/** 只保留新格式记录；读取时丢弃无效项 */
function sanitizeRecords(records) {
    if (!Array.isArray(records)) {
        return [];
    }
    return records.filter(
        (item) => item && typeof item.url === "string" && item.url.trim() !== ""
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
        chrome.storage.local.get(BREAKING_NEWS_ENGLISH_STORAGE_KEY, (result) => {
            const records = result[BREAKING_NEWS_ENGLISH_STORAGE_KEY];
            resolve(sanitizeRecords(records));
        });
    });
}

/** 将已读记录列表写入 chrome.storage.local */
function saveReadRecords(records) {
    const sanitized = sanitizeRecords(records);
    return new Promise((resolve) => {
        chrome.storage.local.set(
            { [BREAKING_NEWS_ENGLISH_STORAGE_KEY]: sanitized },
            resolve
        );
    });
}

/** 判断 storage 中的一条记录是否与给定 url 相同 */
function recordsMatch(record, articleUrl) {
    return normalizeArticleUrl(record.url) === normalizeArticleUrl(articleUrl);
}

/** 切换某一文章页 url 的已读状态（写入或删除记录） */
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

/** 从 li 中解析文章链接（排除分享区等非文章行） */
function getArticleLinkFromListItem(li) {
    const link = li.querySelector('a[href$=".html"]');
    if (!link?.getAttribute("href")) {
        return null;
    }
    const path = new URL(link.href, location.href).pathname.replace(/^\//, "");
    if (!ARTICLE_HREF_PATTERN.test(path)) {
        return null;
    }
    return link;
}

/** 更新图标的已读/未读展示（不修改文章链接的 title） */
function applyReadState(icon, isRead) {
    icon.src = chrome.runtime.getURL(isRead ? READED_ICON : UNREAD_ICON);
    icon.title = isRead ? "已读" : "未读";
    icon.setAttribute("aria-label", icon.title);
}

/** 创建已读/未读图标，点击可切换 storage */
function createStatusIcon(articleUrl, isRead) {
    const img = document.createElement("img");
    img.alt = "";
    img.dataset.enReadHelper = "status-icon";
    img.style.width = "1em";
    img.style.height = "1em";
    img.style.marginLeft = "0.25em";
    img.style.verticalAlign = "middle";
    img.style.cursor = "pointer";
    img.style.filter = "brightness(0)";
    applyReadState(img, isRead);

    img.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const normalized = normalizeArticleUrl(articleUrl);
        const currentlyRead = readUrlSet.has(normalized);

        toggleReadRecord(normalized, currentlyRead).then(() => {
            applyReadState(img, !currentlyRead);
        });
    });

    return img;
}

/** 为单个列表项追加已读图标 */
function decorateListItem(li) {
    if (li.querySelector('[data-en-read-helper="status-icon"]')) {
        return;
    }

    const link = getArticleLinkFromListItem(li);
    if (!link) {
        return;
    }

    const articleUrl = normalizeArticleUrl(link.href);
    const isRead = readUrlSet.has(articleUrl);
    li.appendChild(createStatusIcon(articleUrl, isRead));
}

/** 文章列表页：为所有文章 li 装饰已读图标（含多个分栏 ul） */
function markArticleList() {
    const container = document.querySelector("#primary .content-container");
    if (!container) {
        return;
    }

    container.querySelectorAll("ul:not(#social-media-list) > li").forEach((li) => {
        decorateListItem(li);
    });
}

/** 加载已读数据并装饰列表页 */
async function initPage() {
    await loadFromStorage();
    markArticleList();
}

/** DOM 就绪后再初始化，避免节点尚未插入 */
function runWhenDomReady() {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initPage);
    } else {
        initPage();
    }
}

runWhenDomReady();
