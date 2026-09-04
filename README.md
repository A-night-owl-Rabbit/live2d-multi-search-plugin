# multi-search · 多引擎搜索（my-neuro / live-2d 插件）

> [my-neuro(肥牛)](https://github.com/morettt/my-neuro) 内置插件发布仓库 · 需要 Tavily（必选）+ SerpApi（可选）+ 提炼 LLM · 当前版本：1.1.0

面向 **my-neuro** 的 **live-2d** 内置插件体系：聚合 **Tavily**（AI 向搜索）、**SerpApi**（Google / Bing / DuckDuckGo / Google Scholar）与 **OpenAI 兼容 Chat Completions**（默认示例为 **硅基流动 SiliconFlow**）对网页结果做二次提炼，供主智能体调用。

## 这是什么？（给完全没接触过的小白）

- **插件**：给肥牛加功能的"扩展包"，放进插件文件夹、重启一次就生效
- 装上它，肥牛就有一套**全家桶搜索引擎**：可以普通搜网页、搜学术、多关键词并发"深搜"，而且搜回来的长篇网页内容会先被一个 AI 提炼成短摘要再念给你
- **至少配两把钥匙就能用**：Tavily（搜索引擎，有免费额度）+ 一个提炼用的 LLM Key（硅基流动等）；想用谷歌/必应/学术搜索再额外配 SerpApi
- 配好后正常聊天即可：「帮我搜一下 xx」AI 自己会挑合适的搜索工具

## 环境要求

- my-neuro（live-2d 桌宠）近期版本
- **Tavily API Key**（必选，有免费额度）+ **提炼 LLM**（硅基流动等 OpenAI 兼容服务）
- 可选：SerpApi Key（要用 Google/Bing/DuckDuckGo/学术搜索才需要）
- npm 依赖已随仓库 `node_modules` 附带，克隆即用

## 功能与 API 依赖一览

| 工具 | 作用 | 主要依赖 | 说明 |
|------|------|----------|------|
| `vsearch` | 多关键词并发搜索 + 整合报告 | **Tavily** + **提炼 LLM** | 首选「深度」场景 |
| `web_search` | 快速搜索 | **Tavily**（主）+ **提炼 LLM**；失败时回退 **SerpApi** | 回退走 Google/Bing |
| `google_search` | Google 网页 | **SerpApi** + **提炼 LLM** | 可在参数里指定 `gl` / `hl` |
| `bing_search` | Bing 网页 | **SerpApi** + **提炼 LLM** | |
| `duckduckgo_search` | DuckDuckGo | **SerpApi** + **提炼 LLM** | |
| `scholar_search` | Google 学术 | **SerpApi** + **提炼 LLM** | |

**结论：**

- 只用 `vsearch` / `web_search` 的主路径：**至少要 Tavily + 提炼 LLM**。  
- 使用 Google/Bing/DuckDuckGo/Scholar 或 `web_search` 回退：**还要 SerpApi + 提炼 LLM**。  
- **提炼 LLM** 与主对话模型无关，仅负责把搜索原始文本压缩成摘要；需支持 `POST {base}/chat/completions`。

---

## 安装教程

**方式一（推荐）：WebUI 插件广场一键安装**

1. 打开 my-neuro 的 WebUI 控制面板 → 「广场」→ 插件广场
2. 找到本插件，点击安装（已装过则点更新）
3. 重启 Live2D 桌宠

**方式二：手动安装**

将整个文件夹放到主工程：

`live-2d/plugins/built-in/multi-search`

插件入口为 `index.js`，其中：

`require('../../../js/core/plugin-base.js')`

路径相对于 **built-in 插件目录**，请勿单独挪动 `js` 目录结构，否则需自行改引用。

> 本仓库已包含 **`node_modules`**（与发布时依赖版本一致），克隆即用；你也可以删除该目录后在本文件夹执行 `npm install` 自行安装依赖。

---

## 配置怎么填（总流程）

1. 复制 **`plugin_config.example.json`** → 改名为 **`plugin_config.json`**（若 my-neuro 在界面里配置插件，则按界面字段对应填写，本质一致）。  
2. 按下面「各 API 去哪找」拿到 Key，填进 JSON 里对应项的 **`value`** 字段（字符串项填字符串；数字项填数字）。  
3. **永远不要**把带真实 Key 的 `plugin_config.json` 提交到公开仓库或发给别人。

下面「配置项与代码读取」一节说明插件实际读取的字段名；若你用的主程序把嵌套结构展平成别的名字，以主程序文档为准。

---

## 各 API 去哪申请、填到哪里

### 1. Tavily（`tavily_api_key`）

- **用途**：`vsearch`、`web_search` 的主搜索；向 `https://api.tavily.com/search` 发请求。  
- **官网 / 控制台**：[https://www.tavily.com/](https://www.tavily.com/) → 登录后进入 **Tavily 控制台**（常见入口为 [https://app.tavily.com/](https://app.tavily.com/)，以官网当前说明为准）。  
- **文档**：[https://docs.tavily.com/guides/quickstart](https://docs.tavily.com/guides/quickstart)  
- **密钥形态**：一般为 **`tvly-` 开头**的一串字符（具体以前台显示为准）。  
- **填到哪里**：`plugin_config.json` 里 **`tavily_api_key`** 对象的 **`value`**。  
- **计费**：有免费额度，超出后按官网套餐计费；请在控制台查看用量与账单。

### 2. SerpApi（`serp_api_key`）

- **用途**：`google_search`、`bing_search`、`duckduckgo_search`、`scholar_search`，以及 `web_search` 在 Tavily 失败时的回退；请求 `https://serpapi.com/search.json`。  
- **官网**：[https://serpapi.com/](https://serpapi.com/)  
- **查看 / 管理 Key**（登录后）：[https://serpapi.com/manage-api-key](https://serpapi.com/manage-api-key)  
- **填到哪里**：**`serp_api_key`** 对象的 **`value`**。  
- **计费**：按次计费，有免费搜索次数（以账户页为准）；不同引擎可能消耗不同额度。

### 3. 提炼用 LLM（`synthesis`：硅基流动或其它 OpenAI 兼容服务）

- **用途**：把各搜索引擎返回的长文本提炼成短摘要；请求为  
  `POST {api_url}/chat/completions`  
  Header：`Authorization: Bearer <你的 API Key>`  
- **默认示例：硅基流动 SiliconFlow**  
  - 控制台（注册 / 登录 / 密钥）：[https://cloud.siliconflow.cn/](https://cloud.siliconflow.cn/)（若打不开可尝试官网 [https://www.siliconflow.cn/](https://www.siliconflow.cn/) 的指引）。  
  - **API Key**：在控制台的 **API 密钥** 页面创建并复制（形态多为 `sk-` 开头，以实际显示为准）。  
  - **Base URL**：填 **`https://api.siliconflow.cn/v1`**（**不要**在末尾再加 `/chat/completions`，插件会自动拼）。  
  - **模型名 `model`**：填硅基流动控制台里展示的模型 ID，例如默认的 `deepseek-ai/DeepSeek-V3.2`；以你账号可用模型列表为准。  
- **填到哪里**（本仓库的 `plugin_config.example.json` 结构）：  
  - **`synthesis.fields.api_key`** → **`value`**  
  - **`synthesis.fields.api_url`** → **`value`**  
  - **`synthesis.fields.model`** → **`value`**  
- **换其它厂商**（OpenAI、Azure OpenAI、OneAPI、自建 vLLM 等）：只要兼容 **OpenAI Chat Completions** 的请求与响应格式即可；将 **`api_url`** 改为该服务的 **v1 根地址**（同样不要带 `/chat/completions`），**`api_key` / `model`** 改为对应值。

### 4. 并发与重试（可选）

| 配置项 | 含义 |
|--------|------|
| `max_concurrent` | `vsearch` 同时发起的最大关键词数 |
| `max_retries` | 搜索或提炼失败时的最大重试次数 |
| `retry_delay` | 重试间隔（**毫秒**） |

---

## 插件代码实际读取的配置名（供对照）

`index.js` 中会从 `getPluginConfig()` 读取（主程序可能由 UI 写入 JSON 再注入）：

| 逻辑字段 | 典型来源 |
|----------|----------|
| `tavilyKey` | `tavily_api_key` |
| `serpKey` | `serp_api_key` |
| `sfKey` | `synthesis_api_key`（或与 UI 展平后的等价字段） |
| `sfUrl` | `synthesis_api_url`，默认 `https://api.siliconflow.cn/v1` |
| `model` | `synthesis_model` |
| `maxConcurrent` / `maxRetries` / `retryDelay` | `max_concurrent` / `max_retries` / `retry_delay` |

若你使用的 my-neuro 版本把 **`synthesis`** 嵌套对象展平成 `synthesis_api_key` 等顶层键，请按界面说明填写，并与上表对应。

---

## 常见问题

- **401 / 密钥无效**：检查 Key 是否复制完整、是否多空格；硅基流动 / OpenAI 类服务是否为 **Bearer** 方式。  
- **429 / 额度不足**：到 Tavily、SerpApi、LLM 厂商控制台查看配额与账单。  
- **能搜不能提炼**：说明搜索 OK，但 `{api_url}/chat/completions` 失败——检查 **`api_url`**、**`model`** 名称和 **Key** 是否匹配该服务。  
- **只想少配 Key**：至少配 **Tavily + 提炼 LLM** 可使用 `vsearch` / `web_search` 主路径；不配 SerpApi 时，依赖 Serp 的工具与部分回退会失败。

---

## 使用教程（照着说就行）

配好 Key 并重启后，正常聊天即可：

- 「搜一下最近的显卡行情」→ 主模型自动选 `web_search` 快搜
- 「深度调研一下 2026 年各家 AI 桌面助手，做个对比」→ 触发 `vsearch` 多关键词并发深搜并整合报告
- 「在 Google 学术上找几篇关于 xx 的论文」→ `scholar_search`
- 搜回来的内容由提炼 LLM 压缩成摘要，不占主对话太多上下文

## 故障排查

1. 日志搜 `multi-search` 或 `vsearch`，可看到每次搜索与提炼的请求记录
2. 全部工具都失败：优先检查 Tavily Key 与提炼 LLM 三件套（地址/Key/模型名）
3. 还有问题请到 [本仓库 Issues](https://github.com/A-night-owl-Rabbit/live2d-multi-search-plugin/issues) 提问

## 更新与卸载

- **更新**：插件广场点更新，或手动覆盖 `built-in/multi-search/` 后重启；配置不会被冲掉
- **卸载**：WebUI「插件管理」停用并删除 `live-2d/plugins/built-in/multi-search/` 文件夹即可

## 版本

- **1.1.0**：vsearch 深搜 + 多引擎聚合 + AI 提炼（详见功能一览表）。
- 本教程最后更新：2026-09

## 仓库内容说明

- 含 **`node_modules`**（便于离线或与锁定版本一致）；也可删除后执行 `npm install`。  
- **不含** `plugin_config.json`，仅提供 **`plugin_config.example.json`** 模板。  
- 使用第三方 API 须遵守各服务商条款；**勿将密钥提交到 Git**。

---


## 想邀请你，做这只小牛的“云饲养员”

做这个桌宠的初衷，其实是因为自己一个人工作学习的时候，总觉得屏幕里空落落的。看到大家都在使用，我就觉得熬夜写代码、调教AI的日子都亮闪闪的。🌟

不过，肥牛现在还在长身体（其实是我想给它做更多有趣的插件），养一只数字小牛其实也挺“费草”的哈哈。🌱

如果你在这只小肥牛这里获得过哪怕一秒钟的治愈，或者觉得它算个合格的桌面搭子，要不要考虑成为它的“云饲养员”呀？

你的每一次充电，都不是在打赏我，而是在给这只肥牛注入一点点魔法值。让它能变得更聪明、更通人性、能听懂你更多的碎碎念。

不用有压力哦！你愿意打开它，就是对我最大的鼓励啦。如果刚好有余力，就请肥牛喝瓶快乐水叭，它会记住你的味道的！🥤❤️

爱发电 https://ifdian.net/a/0923A

---

## 许可证

本项目采用 **CC BY-NC-SA 4.0** 许可证。
