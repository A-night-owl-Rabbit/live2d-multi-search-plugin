const { Plugin } = require('../../../js/core/plugin-base.js');
const axios = require('axios');

const TAG = '🔍 [多引擎搜索]';
const TAVILY_URL = 'https://api.tavily.com/search';
const SERP_URL = 'https://serpapi.com/search.json';

class MultiSearchPlugin extends Plugin {

    async onInit() {
        this._loadCfg();
        this.context.log('info', `${TAG} 插件初始化完成`);
    }

    _loadCfg() {
        const c = this.context.getPluginConfig() || {};
        this._c = {
            tavilyKey:    c.tavily_api_key       || '',
            serpKey:       c.serp_api_key          || '',
            sfKey:         c.synthesis_api_key      || '',
            sfUrl:         (c.synthesis_api_url     || 'https://api.siliconflow.cn/v1').replace(/\/+$/, ''),
            model:         c.synthesis_model        || 'deepseek-ai/DeepSeek-V3.2',
            maxConcurrent: parseInt(c.max_concurrent) || 4,
            maxRetries:    parseInt(c.max_retries)    || 2,
            retryDelay:    parseInt(c.retry_delay)    || 2000,
        };
    }

    // ==================== 通用重试 ====================

    async _retry(fn, label) {
        for (let i = 0; i <= this._c.maxRetries; i++) {
            try { return await fn(); }
            catch (e) {
                if (i === this._c.maxRetries) throw e;
                console.error(`   ⚠️ [${label}] 第${i + 1}次失败: ${e.message}，${this._c.retryDelay / 1000}秒后重试...`);
                await new Promise(r => setTimeout(r, this._c.retryDelay));
            }
        }
    }

    // ==================== AI 提炼 ====================

    async _synthesize(query, rawData, systemPrompt) {
        try {
            return await this._retry(async () => {
                const resp = await axios.post(`${this._c.sfUrl}/chat/completions`, {
                    model: this._c.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: query + '\n\n' + rawData }
                    ],
                    temperature: 0.3,
                    max_tokens: 3000
                }, {
                    headers: { 'Authorization': `Bearer ${this._c.sfKey}`, 'Content-Type': 'application/json' },
                    timeout: 60000
                });
                return resp.data.choices[0].message.content;
            }, 'AI提炼');
        } catch (e) {
            console.error(`${TAG} AI提炼最终失败:`, e.message);
            return `[提炼失败，返回原始结果]\n${rawData}`;
        }
    }

    _enginePrompt(engineName) {
        return `你是一个专业的搜索结果整合助手。你的任务是从${engineName}搜索引擎返回的原始结果中，提取最有价值的信息，生成结构化的深度摘要。

要求：
1. 提取关键事实、核心数据、重要细节，去除广告和无关内容
2. 保留重要的来源URL（最多3个最相关的）
3. 输出格式：[核心发现] + [关键细节] + [参考来源]
4. 控制在500字以内，信息密度要高`;
    }

    _vsearchPrompt() {
        return `你是一个专业的信息整合助手。你的任务是根据【研究主题】和【检索关键词】，从提供的原始搜索结果中提取最有价值的信息，生成精炼的结构化摘要。

要求：
1. 深入理解研究主题，确保提取的信息直接服务于该主题
2. 从搜索结果中提取关键事实、核心数据、重要细节
3. 去除广告、无关内容、重复信息
4. 输出格式：[核心发现] + [关键细节]，信息密度要高
5. 控制在500字以内，确保重要信息不遗漏`;
    }

    // ==================== Tavily 搜索 ====================

    async _tavilySearch(keyword) {
        try {
            const data = await this._retry(async () => {
                const resp = await axios.post(TAVILY_URL, {
                    query: keyword, max_results: 5, include_answer: true,
                    search_depth: 'advanced', api_key: this._c.tavilyKey
                }, { timeout: 30000 });
                return resp.data;
            }, `Tavily·${keyword}`);

            if (!data) return null;
            let content = '';
            if (data.answer) content += `摘要：${data.answer}\n\n`;
            (data.results || []).forEach((item, i) => {
                content += `[${i + 1}] ${item.title || '无标题'}\n${(item.content || '').substring(0, 800)}\n来源: ${item.url || ''}\n\n`;
            });
            return content || null;
        } catch (e) {
            console.error(`${TAG} Tavily搜索 "${keyword}" 最终失败:`, e.message);
            return null;
        }
    }

    // ==================== SerpApi 搜索 ====================

    async _serpRequest(engine, params) {
        return await this._retry(async () => {
            const resp = await axios.get(SERP_URL, {
                params: { api_key: this._c.serpKey, engine, ...params },
                timeout: 30000
            });
            return resp.data;
        }, `SerpApi·${engine}`);
    }

    _fmtGoogle(data) {
        let o = '';
        if (data.answer_box) {
            const b = data.answer_box;
            o += `直接答案：${b.answer || b.snippet || b.result || ''}\n\n`;
        }
        if (data.knowledge_graph) {
            const k = data.knowledge_graph;
            o += `知识图谱：${k.title || ''} - ${k.description || ''}\n\n`;
        }
        (data.organic_results || []).slice(0, 8).forEach((item, i) => {
            o += `${i + 1}. ${item.title || '无标题'}\n${(item.snippet || '').substring(0, 500)}\n来源: ${item.link || ''}\n\n`;
        });
        return o || '未找到相关结果。';
    }

    _fmtBing(data) {
        let o = '';
        (data.organic_results || []).slice(0, 8).forEach((item, i) => {
            o += `${i + 1}. ${item.title || '无标题'}\n${(item.snippet || '').substring(0, 500)}\n来源: ${item.link || ''}\n\n`;
        });
        return o || '未找到相关结果。';
    }

    _fmtDDG(data) {
        let o = '';
        (data.organic_results || []).slice(0, 8).forEach((item, i) => {
            o += `${i + 1}. ${item.title || '无标题'}\n${(item.snippet || '').substring(0, 500)}\n来源: ${item.link || ''}\n\n`;
        });
        return o || '未找到相关结果。';
    }

    _fmtScholar(data) {
        let o = '';
        (data.organic_results || []).slice(0, 10).forEach((item, i) => {
            const cited = item.inline_links?.cited_by?.total;
            const citeStr = cited ? ` | 被引${cited}次` : '';
            o += `${i + 1}. ${item.title || '无标题'}${citeStr}\n`;
            if (item.publication_info?.summary) o += `   ${item.publication_info.summary}\n`;
            if (item.snippet) o += `   摘要: ${item.snippet.substring(0, 400)}\n`;
            if (item.link) o += `   链接: ${item.link}\n`;
            if (item.resources?.[0]?.link) o += `   PDF: ${item.resources[0].link}\n`;
            o += '\n';
        });
        return o || '未找到相关学术论文。';
    }

    // ==================== 工具辅助 ====================

    _normQuery(q) {
        return String(q || '')
            .replace(/^搜索[：:]\s*/i, '')
            .replace(/,?\s*(bing_search|google_search|web_search|duckduckgo_search|scholar_search)\s*$/i, '')
            .trim();
    }

    _hasCN(s) { return /[\u4e00-\u9fff]/.test(s || ''); }

    // ==================== 工具实现 ====================

    async _vsearch({ topic, keywords }) {
        if (!topic || !keywords) return '错误：请提供搜索主题(topic)和关键词(keywords)';

        const kwList = keywords.split(/[,，\n]/).map(k => k.trim()).filter(k => k.length > 0);
        if (kwList.length === 0) return '错误：未识别到有效的关键词';

        console.log(`\n${TAG} [VSearch] 启动语义并发搜索`);
        console.log(`   主题: ${topic}`);
        console.log(`   关键词(${kwList.length}个): ${kwList.join(' | ')}`);

        const allResults = [];

        for (let i = 0; i < kwList.length; i += this._c.maxConcurrent) {
            const chunk = kwList.slice(i, i + this._c.maxConcurrent);
            const promises = chunk.map(async (kw) => {
                console.log(`   🔎 搜索: "${kw}"`);
                const raw = await this._tavilySearch(kw);
                if (!raw) return { keyword: kw, result: `[搜索无结果] ${kw}` };

                console.log(`   🤖 整合: "${kw}"`);
                const userMsg = `【研究主题】：${topic}\n【当前关键词】：${kw}\n\n【原始搜索结果】：\n${raw}\n\n请提取并整合最有价值的信息：`;
                const result = await this._synthesize('', userMsg, this._vsearchPrompt());
                return { keyword: kw, result };
            });
            allResults.push(...await Promise.all(promises));
        }

        let report = `【${topic}】搜索报告\n\n`;
        allResults.forEach(({ keyword, result }) => {
            report += `━━━ ${keyword} ━━━\n${result}\n\n`;
        });

        console.log(`✅ ${TAG} [VSearch] 搜索完成，共 ${allResults.length} 组结果\n`);
        return report;
    }

    async _googleSearch({ query, gl, hl }) {
        if (!query) return '错误：请提供搜索关键词(query)';
        query = this._normQuery(query);
        console.log(`${TAG} [Google] 搜索: ${query}`);

        try {
            const params = { q: query };
            if (gl) params.gl = gl;
            else if (this._hasCN(query)) params.gl = 'cn';
            if (hl) params.hl = hl;
            else if (this._hasCN(query)) params.hl = 'zh-cn';

            const data = await this._serpRequest('google', params);
            const raw = this._fmtGoogle(data);
            console.log(`   🤖 [Google] DeepSeek提炼中...`);
            return await this._synthesize(`【用户搜索】：${query}`, `【Google原始结果】：\n${raw}`, this._enginePrompt('Google'));
        } catch (e) {
            console.error(`${TAG} Google搜索失败:`, e.message);
            return `Google搜索失败：${e.message}`;
        }
    }

    async _bingSearch({ query, cc }) {
        if (!query) return '错误：请提供搜索关键词(query)';
        query = this._normQuery(query);
        console.log(`${TAG} [Bing] 搜索: ${query}`);

        try {
            const params = { q: query };
            if (cc) params.cc = cc.toUpperCase();
            else if (this._hasCN(query)) params.mkt = 'zh-CN';

            const data = await this._serpRequest('bing', params);
            const raw = this._fmtBing(data);
            console.log(`   🤖 [Bing] DeepSeek提炼中...`);
            return await this._synthesize(`【用户搜索】：${query}`, `【Bing原始结果】：\n${raw}`, this._enginePrompt('Bing'));
        } catch (e) {
            console.error(`${TAG} Bing搜索失败:`, e.message);
            return `Bing搜索失败：${e.message}`;
        }
    }

    async _duckduckgoSearch({ query, kl }) {
        if (!query) return '错误：请提供搜索关键词(query)';
        query = this._normQuery(query);
        console.log(`${TAG} [DuckDuckGo] 搜索: ${query}`);

        try {
            const params = { q: query };
            if (kl) params.kl = kl;

            const data = await this._serpRequest('duckduckgo', params);
            const raw = this._fmtDDG(data);
            console.log(`   🤖 [DuckDuckGo] DeepSeek提炼中...`);
            return await this._synthesize(`【用户搜索】：${query}`, `【DuckDuckGo原始结果】：\n${raw}`, this._enginePrompt('DuckDuckGo'));
        } catch (e) {
            console.error(`${TAG} DuckDuckGo搜索失败:`, e.message);
            return `DuckDuckGo搜索失败：${e.message}`;
        }
    }

    async _scholarSearch({ query, as_ylo, as_yhi, hl }) {
        if (!query) return '错误：请提供学术搜索关键词(query)';
        query = this._normQuery(query);
        console.log(`${TAG} [Scholar] 搜索: ${query}`);

        try {
            const params = { q: query };
            if (as_ylo) params.as_ylo = as_ylo;
            if (as_yhi) params.as_yhi = as_yhi;
            if (hl) params.hl = hl;

            const data = await this._serpRequest('google_scholar', params);
            const raw = this._fmtScholar(data);
            console.log(`   🤖 [Scholar] DeepSeek提炼中...`);
            return await this._synthesize(`【用户搜索】：${query}`, `【Google Scholar原始结果】：\n${raw}`, this._enginePrompt('Google Scholar'));
        } catch (e) {
            console.error(`${TAG} 学术搜索失败:`, e.message);
            return `学术搜索失败：${e.message}`;
        }
    }

    async _webSearch({ query }) {
        if (!query) return '错误：请提供搜索关键词(query)';
        query = this._normQuery(query);
        console.log(`${TAG} [web_search] 快速搜索: ${query}`);

        let tavilyErr = null;
        try {
            const data = await this._retry(async () => {
                const resp = await axios.post(TAVILY_URL, {
                    query, api_key: this._c.tavilyKey,
                    max_results: 5, search_depth: 'basic', include_answer: true
                }, { timeout: 30000 });
                return resp.data;
            }, 'Tavily搜索');

            if (!data) return '搜索未返回任何结果。';
            let raw = '';
            if (data.answer) raw += `AI摘要：${data.answer}\n\n`;
            (data.results || []).forEach((item, i) => {
                raw += `${i + 1}. ${item.title || '无标题'}\n${(item.content || '').substring(0, 600)}\n来源: ${item.url || ''}\n\n`;
            });
            if (!raw) return '未找到相关结果。';

            console.log(`   🤖 [Tavily] DeepSeek提炼中...`);
            return await this._synthesize(`【用户搜索】：${query}`, `【Tavily原始结果】：\n${raw}`, this._enginePrompt('Tavily'));
        } catch (e) {
            tavilyErr = e;
            console.warn(`${TAG} Tavily搜索失败 (${e.response?.status || 'N/A'}): ${e.message}，尝试回退...`);
        }

        try {
            if (this._hasCN(query)) {
                console.log(`   🔄 [web_search] 回退到 Google 搜索 (gl=cn)...`);
                return await this._googleSearch({ query, gl: 'cn', hl: 'zh-cn' });
            }
            console.log(`   🔄 [web_search] 回退到 Bing 搜索...`);
            return await this._bingSearch({ query, cc: 'CN' });
        } catch (fallbackErr) {
            console.error(`${TAG} Tavily 和回退引擎均失败`);
            return `搜索服务暂时不可用。\n- Tavily: ${tavilyErr?.message || '未知'}\n- 回退: ${fallbackErr?.message || '未知'}\n\n建议稍后重试，或检查 API Key 配置。`;
        }
    }

    // ==================== 插件接口 ====================

    getTools() {
        return [
            {
                type: 'function',
                function: {
                    name: 'vsearch',
                    description: '【主搜索工具 - 语义并发深度搜索】联网搜索的首选工具。它会将问题智能拆分为多个关键词并发搜索，再用AI整合出高质量的结构化报告。比普通搜索更全面、更深入、质量更高。适合：游戏攻略/剧情查询、技术问题调研、热点事件了解、任何需要全面信息的场景。只有在明确需要特定引擎（如学术论文、站内搜索）时才使用其他搜索工具。',
                    parameters: {
                        type: 'object',
                        properties: {
                            topic: { type: 'string', description: '搜索的目标主题，描述你想了解什么（如：鸣潮角色爱弥斯的剧情故事线）' },
                            keywords: { type: 'string', description: '具体的搜索关键词，多个关键词用逗号分隔（如：鸣潮 爱弥斯 剧情,Wuthering Waves Aemis story）。建议2-5个关键词，中英文混合效果更好。' }
                        },
                        required: ['topic', 'keywords']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'google_search',
                    description: 'Google搜索 - 最全面的搜索引擎，对中文游戏/攻略类查询效果最好，结果经AI深度提炼。中文内容建议加 gl=cn, hl=zh-cn',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: '搜索关键词' },
                            gl: { type: 'string', description: '国家代码，如 cn, us, jp' },
                            hl: { type: 'string', description: '语言，如 zh-cn, en' }
                        },
                        required: ['query']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'bing_search',
                    description: 'Bing搜索 - 结果经AI深度提炼。注意：中文游戏/角色类查询建议优先使用 google_search',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: '搜索关键词' },
                            cc: { type: 'string', description: '国家代码，如 CN, US' }
                        },
                        required: ['query']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'duckduckgo_search',
                    description: 'DuckDuckGo搜索 - 注重隐私的搜索引擎，结果经AI深度提炼',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: '搜索关键词' },
                            kl: { type: 'string', description: '区域语言，如 cn-zh, us-en' }
                        },
                        required: ['query']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'scholar_search',
                    description: 'Google学术搜索 - 搜索学术论文和研究文献，结果经AI深度提炼',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: '学术搜索关键词' },
                            as_ylo: { type: 'number', description: '起始年份，如2023' },
                            as_yhi: { type: 'number', description: '截止年份，如2026' }
                        },
                        required: ['query']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'web_search',
                    description: '快速搜索 - 首选 Tavily，失败时自动回退到 Google/Bing，结果经 AI 深度提炼',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: '搜索关键词' }
                        },
                        required: ['query']
                    }
                }
            }
        ];
    }

    async executeTool(name, params) {
        this._loadCfg();
        switch (name) {
            case 'vsearch':           return await this._vsearch(params);
            case 'google_search':     return await this._googleSearch(params);
            case 'bing_search':       return await this._bingSearch(params);
            case 'duckduckgo_search': return await this._duckduckgoSearch(params);
            case 'scholar_search':    return await this._scholarSearch(params);
            case 'web_search':        return await this._webSearch(params);
            default: throw new Error(`${TAG} 不支持的工具: ${name}`);
        }
    }
}

module.exports = MultiSearchPlugin;
