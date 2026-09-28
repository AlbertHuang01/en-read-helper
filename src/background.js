const ICON_SIZES = [16, 32];

function getSupportedSites() {
  const sites = new Map();
  for (const script of chrome.runtime.getManifest().content_scripts ?? []) {
    for (const pattern of script.matches ?? []) {
      const url = new URL(pattern.replace(/\*/g, ''));
      const scheme = url.protocol.slice(0, -1);
      sites.set(`${scheme}://${url.host}`, { scheme, host: url.host });
    }
  }
  return [...sites.values()];
}

async function loadImageData(path) {
  const res = await fetch(chrome.runtime.getURL(path));
  const bitmap = await createImageBitmap(await res.blob());
  const imageData = {};
  for (const size of ICON_SIZES) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, size, size);
    imageData[size] = ctx.getImageData(0, 0, size, size);
  }
  return imageData;
}

async function registerRules() {
  const imageData = await loadImageData('assets/icon.png');
  const conditions = getSupportedSites().map(({ scheme, host }) =>
    new chrome.declarativeContent.PageStateMatcher({
      pageUrl: { hostEquals: host, schemes: [scheme] },
    })
  );

  await chrome.declarativeContent.onPageChanged.removeRules(undefined);
  await chrome.declarativeContent.onPageChanged.addRules([
    {
      conditions,
      actions: [
        new chrome.declarativeContent.ShowAction(),
        new chrome.declarativeContent.SetIcon({ imageData }),
      ],
    },
  ]);
}

chrome.action.disable();

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.disable();
  registerRules().catch((err) => console.error('注册图标规则失败', err));
});
