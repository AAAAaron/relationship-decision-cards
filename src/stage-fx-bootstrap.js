// 关系决策牌组：Three.js 舞台启动脚本（type=module）
// 唯一在浏览器中通过 import map 加载 three.js 的入口，
// 拿到 THREE 后调 RelationshipStageFx.createStageFx 完成初始化。
// 业务代码（app.js）通过 rdc:scene-change 事件驱动 stage-fx。
import * as THREE from 'three';

const api = window.RelationshipStageFx;
const prefs = window.RelationshipMotionPreferences;
const scenes = window.RelationshipStageFxScenes;
const ctrlFactory = window.RelationshipStageFxController;

if (!api || !prefs || !scenes || !ctrlFactory) {
  // 缺前置模块，不显示 fallback（业务已可工作）
} else {
  const canvas = document.getElementById('stageFxCanvas');
  const board = canvas && canvas.closest('.battlefield.board-stage');
  const fallback = {
    show() { if (board) board.classList.add('stage-fx-fallback'); }
  };
  const controller = ctrlFactory.createStageController();
  const stageFx = api.createStageFx({
    THREE,
    canvas,
    fallback,
    controller,
    preferences: prefs
  });
  if (stageFx && board) {
    board.classList.add('stage-fx-active');
    window.RelationshipStageFxInstance = stageFx;
    // 窗口尺寸变化重算
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => stageFx.handleResize());
      ro.observe(board);
    } else {
      window.addEventListener('resize', () => stageFx.handleResize());
    }
    // 业务事件 → stage-fx 切换预设
    window.addEventListener('rdc:scene-change', (event) => {
      const detail = (event && event.detail) || {};
      const preset = scenes.resolveScenePresetFromEvent(detail);
      controller.setPreset(preset.id);
    });
  }
}
