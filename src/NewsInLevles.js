import "./NewsInLevles.css";
console.log("NewsInLevels.js loaded");

const READ_ON_ICON = "assets/readed.svg";
const READ_OFF_ICON = "assets/unread.svg";
const LISTEN_ON_ICON = "assets/listened.svg";
const LISTEN_OFF_ICON = "assets/unlistened.svg";

const NEWS_IN_LEVELS_STORAGE_KEY = "NewsInlevelsStorage";

/**
 * NewsInlevelsStorage 存 Array<ArticleRecord>
 *
 * ArticleRecord:
 * - url {string}
 * - markTime {number}
 * - read {boolean}
 * - listened {boolean}
 */

function normalizeArticleUrl(href) {
    const url = new URL(href, location.href);
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.href;
}

function normalizeRecord(item) {
    const url = normalizeArticleUrl(item.url);
    const read = typeof item.read === "boolean" ? item.read : true;
    const listened = typeof item.listened === "boolean" ? item.listened : false;
    return {
        url,
        markTime: typeof item.markTime === "number" ? item.markTime : Date.now(),
        read,
        listened,
    };
}

function sanitizeRecords(records) {
    if (!Array.isArray(records)) {
        return [];
    }
    return records
        .filter(
            (item) => item && typeof item.url === "string" && item.url.trim() !== ""
        )
        .map(normalizeRecord)
        .filter((item) => item.read || item.listened);
}

/** url（规范化）-> ArticleRecord */
let recordByUrl = new Map();

function buildRecordMap(records) {
    const map = new Map();
    for (const item of sanitizeRecords(records)) {
        map.set(item.url, item);
    }
    return map;
}

function getReadRecords() {
    return new Promise((resolve) => {
        chrome.storage.local.get(NEWS_IN_LEVELS_STORAGE_KEY, (result) => {
            const records = result[NEWS_IN_LEVELS_STORAGE_KEY];
            resolve(sanitizeRecords(records));
        });
    });
}

function saveReadRecords(records) {
    const sanitized = sanitizeRecords(records);
    return new Promise((resolve) => {
        chrome.storage.local.set(
            { [NEWS_IN_LEVELS_STORAGE_KEY]: sanitized },
            resolve
        );
    });
}

function recordsMatch(record, articleUrl) {
    return normalizeArticleUrl(record.url) === normalizeArticleUrl(articleUrl);
}

async function toggleMark(articleUrl, flag) {
    const records = await getReadRecords();
    const normalized = normalizeArticleUrl(articleUrl);
    const existing = records.find((r) => recordsMatch(r, normalized));
    const nextRead = flag === "read" ? !(existing?.read ?? false) : (existing?.read ?? false);
    const nextListened =
        flag === "listened"
            ? !(existing?.listened ?? false)
            : (existing?.listened ?? false);

    let nextRecords = records.filter((r) => !recordsMatch(r, normalized));

    if (nextRead || nextListened) {
        nextRecords.push({
            url: normalized,
            markTime: Date.now(),
            read: nextRead,
            listened: nextListened,
        });
    }

    await saveReadRecords(nextRecords);
    recordByUrl = buildRecordMap(nextRecords);
    return recordByUrl.get(normalized) ?? null;
}

async function loadFromStorage() {
    const records = await getReadRecords();
    recordByUrl = buildRecordMap(records);
}

function parseLevelFromLink(link) {
    const match = link.textContent.trim().match(/^Level\s+(\d+)/);
    return match ? Number(match[1]) : null;
}

function applyMarkIcon(img, isOn, onIcon, offIcon, onTitle, offTitle) {
    img.src = chrome.runtime.getURL(isOn ? onIcon : offIcon);
    img.title = isOn ? onTitle : offTitle;
    img.classList.toggle("en-read-helper-mark-on", isOn);
}

function applyMarksUI(readIcon, listenIcon, record) {
    const read = record?.read ?? false;
    const listened = record?.listened ?? false;
    applyMarkIcon(readIcon, read, READ_ON_ICON, READ_OFF_ICON, "已读", "未读");
    applyMarkIcon(
        listenIcon,
        listened,
        LISTEN_ON_ICON,
        LISTEN_OFF_ICON,
        "已听",
        "未听"
    );
}

function createMarkIcon(onIcon, offIcon, onTitle, offTitle, isOn) {
    const img = document.createElement("img");
    img.alt = "";
    img.src = chrome.runtime.getURL(isOn ? onIcon : offIcon);
    img.title = isOn ? onTitle : offTitle;
    img.classList.toggle("en-read-helper-mark-on", isOn);
    return img;
}

function createMarksRow(articleUrl) {
    const row = document.createElement("div");
    row.className = "en-read-helper-marks";
    row.dataset.enReadHelper = "marks";

    const record = recordByUrl.get(articleUrl) ?? null;
    const readIcon = createMarkIcon(
        READ_ON_ICON,
        READ_OFF_ICON,
        "已读",
        "未读",
        record?.read ?? false
    );
    const listenIcon = createMarkIcon(
        LISTEN_ON_ICON,
        LISTEN_OFF_ICON,
        "已听",
        "未听",
        record?.listened ?? false
    );

    readIcon.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleMark(articleUrl, "read").then((next) => {
            applyMarksUI(readIcon, listenIcon, next);
        });
    });

    listenIcon.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleMark(articleUrl, "listened").then((next) => {
            applyMarksUI(readIcon, listenIcon, next);
        });
    });

    row.append(readIcon, listenIcon);
    return row;
}

function decorateLevelLinks(root) {
    root.querySelectorAll(".fancy-buttons li").forEach((li) => {
        if (li.querySelector('[data-en-read-helper="marks"]')) {
            return;
        }

        const link = li.querySelector("a");
        if (!link || parseLevelFromLink(link) == null) {
            return;
        }

        li.classList.add("en-read-helper-level-item");
        const articleUrl = normalizeArticleUrl(link.href);
        li.appendChild(createMarksRow(articleUrl));
    });
}

function markArticleLevels() {
    const container = document.querySelector(".recent-news");
    if (!container) {
        return;
    }

    container.querySelectorAll(".news-block").forEach((block) => {
        decorateLevelLinks(block);
    });
}

function markDetailLevels() {
    const root = document.querySelector(".article-upper");
    if (!root?.querySelector(".date-and-level .fancy-buttons")) {
        return;
    }

    decorateLevelLinks(root);
}

async function initPage() {
    await loadFromStorage();
    markArticleLevels();
    markDetailLevels();
}

function runWhenDomReady() {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initPage);
    } else {
        initPage();
    }
}

runWhenDomReady();
