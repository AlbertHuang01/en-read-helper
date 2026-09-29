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

/** 将导出形 JSON 写入 storage：先 remove 文件中各 key，再 set */
function importStorageFromObject(data) {
    const keys = Object.keys(data ?? {});
    if (keys.length === 0) {
        setStatus('无导入数据', false);
        return;
    }

    chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            setStatus('导入失败', true);
            return;
        }

        chrome.storage.local.set(data, () => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                setStatus('导入失败', true);
                return;
            }
            setStatus('已导入，请刷新相关页面', false);
        });
    });
}

function initImportButton() {
    const importBtn = document.getElementById('importBtn');
    const fileInput = document.getElementById('importFileInput');
    if (!importBtn || !fileInput) {
        return;
    }

    importBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result ?? '{}'));
                if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                    setStatus('导入失败', true);
                    return;
                }
                importStorageFromObject(parsed);
            } catch (err) {
                console.error(err);
                setStatus('导入失败', true);
            }
        };
        reader.onerror = () => {
            console.error(reader.error);
            setStatus('导入失败', true);
        };
        reader.readAsText(file);
    });
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
    initImportButton();
});
