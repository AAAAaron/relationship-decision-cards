(function initAIClient(globalScope, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (globalScope) globalScope.RelationshipAI = api;
})(typeof window !== 'undefined' ? window : globalThis, function createAIClientApi() {
  'use strict';

  function normalizeBaseUrl(value) {
    return String(value || '').trim().replace(/\/+$/, '');
  }

  async function readResponse(response) {
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    if (!response.ok) {
      const message = payload.error?.message || payload.message || '请求失败';
      throw new Error(`${response.status || '网络错误'}：${message}`);
    }
    return payload;
  }

  function createOpenAICompatibleClient(config, fetchImpl = globalThis.fetch) {
    const baseUrl = normalizeBaseUrl(config?.baseUrl);
    const apiKey = String(config?.apiKey || '').trim();
    const model = String(config?.model || '').trim();
    if (!baseUrl) throw new Error('请填写 API Base URL。');
    if (!fetchImpl) throw new Error('当前环境不支持网络请求。');

    const headers = () => ({
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    });

    return {
      async listModels() {
        const response = await fetchImpl(`${baseUrl}/models`, { method: 'GET', headers: headers() });
        const payload = await readResponse(response);
        return Array.isArray(payload.data) ? payload.data : [];
      },
      async chat(messages, options = {}) {
        if (!model) throw new Error('请填写模型名称。');
        const body = {
          model,
          messages,
          temperature: options.temperature ?? 0.7
        };
        if (options.responseFormat) body.response_format = options.responseFormat;
        if (options.thinking) body.thinking = options.thinking;
        const response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(body)
        });
        const payload = await readResponse(response);
        return {
          text: payload.choices?.[0]?.message?.content || '',
          raw: payload
        };
      }
    };
  }

  return { createOpenAICompatibleClient, normalizeBaseUrl };
});
