# 英语阅读助手

Chrome 扩展：在 [News in Levels](https://www.newsinlevels.com/) 与 [Breaking News English](https://breakingnewsenglish.com/) 上标记文章阅读进度，并在本地备份、恢复已读数据。

## 支持的网站

| 网站 | 内容脚本（页面增强） | 工具栏（彩色图标 + Popup） |
| --- | --- | --- |
| News in Levels | `https://www.newsinlevels.com/*` 全站 | 同上域名 |
| Breaking News English | 仅 [分级新闻列表页](https://breakingnewsenglish.com/graded-news-stories.html) | `breakingnewsenglish.com` 整域 |

说明：工具栏是否可用由背景脚本根据 `manifest.json` 里 `content_scripts.matches` 解析出的**域名**决定。因此在 Breaking News English 的其他页面上扩展图标也会变为彩色并可打开 Popup，但已读图标等功能只在上述列表页注入。

在其他任意网站上，工具栏显示灰色图标，点击不会打开 Popup。

## 功能特性

### 工具栏图标与 Popup

- 默认：扩展处于禁用状态，工具栏为灰色图标（`icon-gray.png`），点击无反应。
- 在支持的域名下：图标切换为彩色（`icon.png`），点击可打开 Popup。
- 实现方式：`chrome.action.disable()` 配合 [declarativeContent](https://developer.chrome.com/docs/extensions/reference/api/declarativeContent) 的 `ShowAction` 与 `SetIcon`；离开支持站点后由浏览器自动恢复默认状态。

### News in Levels

- 在列表与详情页的 Level 链接旁显示已读 / 未读图标。
- 点击图标可切换该等级文章页的已读状态，不会触发链接跳转。
- 在 News in Levels 标签页打开 Popup 时，可勾选「高亮已读文章」，已读的 Level 链接会加上高亮样式；勾选时显示当前已读条数。

### Breaking News English

- 在分级新闻列表页，每条文章标题旁显示已读 / 未读图标。
- 点击图标切换该文章链接的已读状态。

### 数据与隐私

- 所有已读记录保存在浏览器本地的 `chrome.storage.local` 中。
- 扩展不会将数据上传到任何服务器。

## 使用说明

### 安装扩展

**从构建产物安装（推荐用于日常使用）**

1. 在项目根目录执行 `pnpm install` 与 `pnpm build`，生成 `prod-dist` 目录。
2. 打开 Chrome 的 `chrome://extensions/`，开启「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择 `prod-dist` 文件夹。

**本地开发**

1. 执行 `pnpm dev`，Vite 会输出到 `dist` 目录。
2. 在 `chrome://extensions` 中加载 `dist` 文件夹（开发版扩展名会带 `-dev` 后缀）。
3. 修改代码或 `manifest.json` 后，在扩展管理页点击「重新加载」；若改了背景脚本或权限，有时需要刷新目标网页才能看到图标变化。

### 标记已读 / 取消已读

1. 打开上表「内容脚本」列对应的页面。
2. 在文章或 Level 旁的图标上点击：未读变为已读，已读再次点击则取消。
3. 状态会立即写入本地存储，同一页面上的图标会即时更新。

### 高亮已读（仅 News in Levels）

1. 在 News in Levels 的任意页面打开扩展 Popup。
2. 勾选「高亮已读文章」；取消勾选则移除高亮。
3. 勾选状态下会显示当前已读记录条数；切换选项后刷新列表或详情页即可看到 Level 链接高亮效果。

### 导出与导入数据

适用于换电脑、重装浏览器或重装扩展前备份进度。

1. 在**支持站点**的任意标签页打开 Popup（灰色图标状态下无法打开 Popup，可先打开 News in Levels 或 Breaking News English 再操作）。
2. 点击「导出数据」，浏览器会下载一份 JSON 文件（文件名含时间戳）。
3. 点击「导入数据」并选择此前导出的 JSON；成功后 Popup 会提示「已导入，请刷新相关页面」——请在已打开的 News in Levels / 列表页上刷新，以便图标与高亮与存储一致。

开发者若需在本地一次性写入存储，可编辑 `src/import-data.js` 中的对象并在扩展上下文中执行该脚本；这不是面向普通用户的常规流程。

## 数据说明

导出 JSON 为 `chrome.storage.local` 的键值快照。与阅读进度相关的主要键名如下：

| 键名 | 含义 |
| --- | --- |
| `NewsInlevelsStorage` | News in Levels 已读记录数组 |
| `NewsInlevelsHighlightRead` | 是否开启「高亮已读文章」（布尔值） |
| `BreakingNewsEnglishStorage` | Breaking News English 已读记录数组 |

每条已读记录格式：

```json
{
  "url": "https://www.newsinlevels.com/.../article-level-2",
  "markTime": 1710000000000
}
```

- `url`：规范化后的文章页地址（按等级或文章唯一标识）。
- `markTime`：标记为已读时的毫秒时间戳。

## 开发与构建

### 环境要求

- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/)

### 命令

```bash
pnpm install    # 安装依赖
pnpm dev        # 开发模式，输出到 dist/
pnpm build      # 生产构建，输出到 prod-dist/
```

构建使用 [Vite](https://vite.dev/) 与 [@crxjs/vite-plugin](https://www.npmjs.com/package/@crxjs/vite-plugin) 打包 Manifest V3 扩展。

### 新增支持网站

1. 在 [manifest.json](manifest.json) 的 `content_scripts` 中增加 `matches` 与对应脚本。
2. [src/background.js](src/background.js) 会从 manifest 的 `matches` 解析域名并注册 declarativeContent 规则，一般无需再改背景脚本（除非要调整匹配粒度）。
3. 重新加载扩展并测试目标站点上的图标、Popup 与页面注入。

## 项目结构

```
manifest.json
assets/                 # 扩展图标、已读/未读 SVG
src/
  background.js         # 工具栏图标与 Popup 启用规则
  popup.html
  popup.js              # 导出/导入、高亮开关
  NewsInLevles.js       # News in Levels 内容脚本
  NewsInLevles.css
  BreakingNewsEnglish.js
  BreakingNewsEnglish.css
  import-data.js        # 开发者本地导入辅助
vite.config.js
```