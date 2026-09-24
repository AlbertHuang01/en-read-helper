/** chrome.storage.local 中 News in Levels 已读记录的键名（导出 JSON 内可见） */
const NEWS_IN_LEVELS_STORAGE_KEY = 'NewsInlevelsStorage';

function formatExportFilename() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `en-read-helper-storage-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
}

function downloadJsonFile(json, filename) {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function setStatus(message, isError) {
    const el = document.getElementById('status');
    if (!el) {
        return;
    }
    el.textContent = message;
    el.style.color = isError ? '#c00' : '#333';
}

/** 读取扩展 local storage 并导出为 JSON 文件 */
function exportStorageToFile() {
    chrome.storage.local.get(null, (data) => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            setStatus('导出失败', true);
            return;
        }

        try {
            const json = JSON.stringify(data ?? {}, null, 2);
            downloadJsonFile(json, formatExportFilename());
            setStatus('已导出', false);
        } catch (err) {
            console.error(err);
            setStatus('导出失败', true);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('exportBtn')?.addEventListener('click', exportStorageToFile);
});
