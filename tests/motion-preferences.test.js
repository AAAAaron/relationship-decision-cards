const test = require('node:test');
const assert = require('node:assert/strict');

function loadPrefs({ matchMedia = null, documentHidden = false, webglAvailable = true } = {}) {
  delete require.cache[require.resolve('../src/motion-preferences.js')];
  // 必须同时设到 globalThis + global（IIFE 形参取 typeof window !== 'undefined' ? window : globalThis）
  const fakeDocument = {
    hidden: documentHidden,
    createElement(tag) {
      if (tag.toLowerCase() !== 'canvas') return {};
      return {
        getContext(type) {
          if (!webglAvailable) return null;
          return type.startsWith('webgl') ? {} : null;
        }
      };
    }
  };
  const fakeWindow = {
    matchMedia: matchMedia || (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })),
    document: fakeDocument
  };
  globalThis.window = fakeWindow;
  globalThis.document = fakeDocument;
  globalThis.matchMedia = fakeWindow.matchMedia;
  global.window = fakeWindow;
  global.document = fakeDocument;
  const api = require('../src/motion-preferences.js');
  return { api };
}

test('shouldReduceMotion 在 matchMedia.matches=true 时返回 true', () => {
  const { api } = loadPrefs({ matchMedia: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }) });
  assert.equal(api.shouldReduceMotion(), true);
});

test('shouldReduceMotion 默认返回 false', () => {
  const { api } = loadPrefs();
  assert.equal(api.shouldReduceMotion(), false);
});

test('shouldReduceMotion 在 matchMedia 抛错时降级为 false', () => {
  const { api } = loadPrefs({ matchMedia: () => { throw new Error('no matchMedia'); } });
  assert.equal(api.shouldReduceMotion(), false);
});

test('isWebGLAvailable 在 webgl 创建成功时返回 true', () => {
  const { api } = loadPrefs({ webglAvailable: true });
  assert.equal(api.isWebGLAvailable(), true);
});

test('isWebGLAvailable 在 webgl 创建失败时返回 false', () => {
  const { api } = loadPrefs({ webglAvailable: false });
  assert.equal(api.isWebGLAvailable(), false);
});

test('isWebGLAvailable 在 document 不可用时返回 false', () => {
  delete require.cache[require.resolve('../src/motion-preferences.js')];
  const fakeWindow = { matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) };
  global.window = fakeWindow;
  global.document = undefined;
  const api = require('../src/motion-preferences.js');
  assert.equal(api.isWebGLAvailable(), false);
});

test('getMotionLevel 整合多个信号给出 full/reduced/off', () => {
  const off = loadPrefs({ webglAvailable: false });
  assert.equal(off.api.getMotionLevel(), 'off');

  const reduced = loadPrefs({ matchMedia: () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }), webglAvailable: true });
  assert.equal(reduced.api.getMotionLevel(), 'reduced');

  const full = loadPrefs({ webglAvailable: true });
  assert.equal(full.api.getMotionLevel(), 'full');
});

test('isDocumentHidden 反映 document.hidden 状态', () => {
  const { api: hidden } = loadPrefs({ documentHidden: true });
  assert.equal(hidden.isDocumentHidden(), true);
  const { api: visible } = loadPrefs({ documentHidden: false });
  assert.equal(visible.isDocumentHidden(), false);
});
