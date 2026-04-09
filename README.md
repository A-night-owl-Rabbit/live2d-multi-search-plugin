# 多引擎搜索（multi-search）Live2D 插件

适用于 **my-neuro / live-2d** 插件体系的联网搜索扩展：整合 **Tavily**、**SerpApi**（Google / Bing / DuckDuckGo / Google Scholar）与可选的 **OpenAI 兼容 API**（如 SiliconFlow）对结果做提炼摘要。

## 功能概览

| 工具 | 说明 |
|------|------|
| `vsearch` | 按主题与多关键词并发检索（Tavily），再经 LLM 整合为结构化报告 |
| `web_search` | 优先 Tavily，失败时回退 Google/Bing |
| `google_search` / `bing_search` / `duckduckgo_search` | 经 SerpApi 拉取网页结果并提炼 |
| `scholar_search` | Google 学术检索并提炼 |

## 安装方式

1. 将本目录完整复制到主程序下的：

   `live-2d/plugins/built-in/multi-search`

2. 在本目录执行依赖安装：

   ```bash
   npm install
   ```

3. **配置密钥（必做）**  
   - 将 `plugin_config.example.json` 复制为 **`plugin_config.json`**（若主程序使用其它配置方式，按其文档放置）。  
   - 在 `plugin_config.json` 中填写你的 **Tavily**、**SerpApi** 与 **提炼用 LLM** 的 API Key。  
   - **切勿**将含真实密钥的 `plugin_config.json` 提交到公开仓库。

## 配置项说明

- **tavily_api_key**：Tavily 密钥（`vsearch`、`web_search` 主路径）。  
- **serp_api_key**：SerpApi 密钥（Google/Bing/DuckDuckGo/Scholar）。  
- **synthesis**：提炼用 LLM（需兼容 OpenAI Chat Completions 格式），可配置 `api_url`、`model`、`api_key`。  
- **max_concurrent / max_retries / retry_delay**：并发、重试与间隔（毫秒）。

具体字段结构见仓库内 `plugin_config.example.json`。

## 依赖与运行环境

- Node.js（与主程序一致即可）  
- npm 包：`axios`（见 `package.json`）  
- 插件基类路径：源码中 `require('../../../js/core/plugin-base.js')` 相对于 **built-in 插件目录**，请保持与主工程目录结构一致，否则需自行调整引用路径。

## 许可证与声明

- 本仓库为从 my-neuro **built-in** 插件拆出的独立副本，便于分享与版本管理。  
- 使用第三方搜索与 LLM API 时，请遵守各服务商条款与计费规则。  
- **安全提示**：若你曾在其它地方泄露过 API Key，请尽快在对应平台**轮换密钥**。

## 仓库中不包含的内容

- 不含 `node_modules`（请本地 `npm install`）。  
- 不含 `plugin_config.json`（仅提供 `plugin_config.example.json` 模板）。  
- 不含任何个人敏感信息或已填写的密钥。
