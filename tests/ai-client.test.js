const test = require('node:test');
const assert = require('node:assert/strict');

const { createOpenAICompatibleClient, normalizeBaseUrl } = require('../src/ai-client.js');

test('OpenAI 兼容地址统一到 v1 根路径', () => {
  assert.equal(normalizeBaseUrl('https://api.openai.com/v1/'), 'https://api.openai.com/v1');
  assert.equal(normalizeBaseUrl('https://example.com/openai'), 'https://example.com/openai');
});

test('AI 客户端按 OpenAI Chat Completions 格式发送请求', async () => {
  let request;
  const fetchMock = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: '测试成功' } }] })
    };
  };
  const client = createOpenAICompatibleClient({
    baseUrl: 'https://example.com/v1/',
    apiKey: 'secret',
    model: 'demo-model'
  }, fetchMock);

  const result = await client.chat([{ role: 'user', content: '你好' }]);
  assert.equal(request.url, 'https://example.com/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer secret');
  assert.deepEqual(JSON.parse(request.options.body).messages, [{ role: 'user', content: '你好' }]);
  assert.equal(result.text, '测试成功');
});

test('AI 客户端返回第三方接口的可读错误', async () => {
  const client = createOpenAICompatibleClient({
    baseUrl: 'https://example.com/v1',
    apiKey: 'bad',
    model: 'demo-model'
  }, async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: { message: 'invalid key' } })
  }));

  await assert.rejects(() => client.listModels(), /401.*invalid key/);
});
