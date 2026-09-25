/** 与 popup 导出的 JSON 同形；粘贴导出内容后保存，打开 popup 即导入 */
const data = {
  // .....
};

console.log('开始导入数据')

function setImportStatus(message) {
  const el = document.getElementById('status');
  if (el) {
    el.textContent = message;
    el.style.color = '#333';
  }
}

const keys = Object.keys(data);
if (keys.length === 0) {
  setImportStatus('无导入数据');
} else {
  chrome.storage.local.remove(keys, () => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      console.log('导入数据失败')
      return;
    }

    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        console.log('导入数据失败')
        return;
      }
      console.log('导入数据成功')
      setImportStatus('已导入');
    });
  });
}
