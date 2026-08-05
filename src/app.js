(() => {
  'use strict';
  const MODEL = window.RelationshipDataModel;
  const AI = window.RelationshipAI;
  const AI_ENGINE = window.RelationshipAiEngine;
  const BG = window.RelationshipBackgrounds;
  const DATA = MODEL ? MODEL.normalizeData(window.DEMO_DATA) : window.DEMO_DATA;
  const STORAGE = window.RelationshipStorage;
  if (!DATA) { document.body.innerHTML = '<p style="padding:24px;color:white">数据加载失败。</p>'; return; }
  const $ = id => document.getElementById(id);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clone = v => JSON.parse(JSON.stringify(v));
  const esc = (v = '') => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  // ---------- 状态：当前人物 + 当前项目（按人物记忆） + 会话按 人物:项目 键 ----------
  const defaultState = {
    currentPersonId: DATA.people[0].id,
    currentMatterByPerson: {},
    sessions: {},
    pack: clone(DATA.seed_rounds.filter(r => r.saved)),
    selectedCardId: null, selectedCandidate: null, selectedStyleId: 'my_voice', selectedChoiceIndex: 0,
    handFocus: -1, justDealt: true,
    packFilter: { person: 'all', matter: 'all', sceneType: 'all' }, packSearch: '',
    aiConfig: { baseUrl: 'https://api.openai.com/v1', model: '', apiKey: '', rememberKey: false, enabled: false },
    styleAvatars: { my_voice: '🗣️', partner: '👔', executive: '🧊', host: '🎙️' },
    _personSuggestion: '', _matterSuggestion: ''
  };
  const matterIdsForPerson = personId => MODEL
    ? MODEL.linkedMatterIds(DATA, personId)
    : (DATA.people.find(item => item.id === personId)?.related_matter_ids || []);
  const personIdsForMatter = matterId => MODEL
    ? MODEL.linkedPersonIds(DATA, matterId)
    : [DATA.matters.find(item => item.id === matterId)?.person_id].filter(Boolean);
  DATA.people.forEach(p => { defaultState.currentMatterByPerson[p.id] = matterIdsForPerson(p.id)[0]; });

  const person = () => DATA.people.find(p => p.id === state.currentPersonId);
  const matter = () => DATA.matters.find(m => m.id === state.currentMatterByPerson[state.currentPersonId]);
  const sessionKey = () => `${state.currentPersonId}:${matter().id}`;
  const session = () => state.sessions[sessionKey()];
  const scenariosFor = () => DATA.scenarios[sessionKey()] || [];
  const card = id => DATA.cards.find(c => c.id === id);
  function candidateCard(candidate) {
    if (candidate && (candidate.front || candidate.back || candidate.title)) {
      return {
        id: candidate.card_id,
        title: candidate.title || candidate.card_id,
        front: candidate.front || {},
        back: candidate.back || { logic: '', why: '', invalid: '', source: '' }
      };
    }
    return card(candidate.card_id);
  }
  const style = id => DATA.styles.find(s => s.id === id);
  const sceneTypeName = id => (DATA.scene_types.find(t => t.id === id) || {}).name || '场景';
  const matterKindName = id => (DATA.matter_kinds.find(k => k.id === id) || {}).name || '事项';
  const sourceName = s => ({ real: '真实', hypothesis: '假设', simulation: '模拟', template: '预置' }[s] || '场景');
  const sourceClass = s => ({ real: 'source-real', hypothesis: 'source-hypothesis', simulation: 'source-simulation', template: 'source-template' }[s] || 'source-hypothesis');
  const rankName = r => ({ primary: 'AI主推荐', backup: '条件备选', other: '其他可行', risk: 'AI不推荐' }[r] || '其他可行');
  const rankClass = r => ({ primary: 'rank-primary', backup: 'rank-backup', other: 'rank-other', risk: 'rank-risk' }[r] || 'rank-other');
  // 稀有度宝石: 1-5 颗菱形 (高/中/低/极低/未知)
  function renderRarity(confidence) {
    const map = { '高': 5, '中高': 4, '中': 3, '中低': 2, '低': 1, '极低': 1 };
    const n = map[confidence] || 3;
    let html = '';
    for (let i = 0; i < 5; i++) {
      html += `<span class="gem ${i < n ? 'on' : ''}"></span>`;
    }
    return html;
  }
  // 翻面按钮在 card 顶部, 不被角标遮挡
  function flipButton() { return `<button class="flip-button" data-flip type="button" aria-label="翻面">↻</button>`; }
  const relationshipTypeName = id => ({ leader: '决策型领导', client: '审慎型客户', partner: '协商型伴侣', colleague: '协作型同事' }[id] || '重要关系');
  const icon = name => {
    const paths = {
      profile: '<circle cx="12" cy="8" r="3"/><path d="M6 20c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5"/>',
      evidence: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
      history: '<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6"/><path d="M4 4v4.6h4.6M12 8v5l3 2"/>',
      project: '<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M9 6V4h6v2M8 11h8M8 15h5"/>',
      progress: '<path d="M5 19V9M12 19V5M19 19v-7"/>',
      cards: '<rect x="6" y="5" width="13" height="16" rx="2"/><path d="m6 17-2-1.2V5.2L15 3"/>'
    };
    return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.profile}</svg>`;
  };

  function createSession(pId, mId) {
    const key = `${pId}:${mId}`;
    const found = DATA.seed_rounds.find(r => r.person_id === pId && r.matter_id === mId);
    const seed = found ? clone(found) : null;
    const list = clone(DATA.scenarios[key] || []);
    const current = list.shift() || null;
    return {
      previous: seed ? { opponent: seed.opponent, player: seed.player, saved: seed.saved, recordId: seed.id } : null,
      current: { opponent: current, player: null, saved: false },
      history: seed ? [seed] : [],
      queue: list,
      turn: seed ? 2 : 1
    };
  }
  function ensureSession(pId, mId) {
    const key = `${pId}:${mId}`;
    if (!state?.sessions?.[key]) state.sessions[key] = createSession(pId, mId);
    return state.sessions[key];
  }
  DATA.person_matter_links.forEach(link => {
    defaultState.sessions[`${link.person_id}:${link.matter_id}`] = createSession(link.person_id, link.matter_id);
  });

  function applySavedData(snapshot) {
    if (!snapshot) return;
    const peopleById = new Map(snapshot.data.people.map(item => [item.id, item]));
    const mattersById = new Map(snapshot.data.matters.map(item => [item.id, item]));
    DATA.people.forEach((item, index) => { if (peopleById.has(item.id)) DATA.people[index] = clone(peopleById.get(item.id)); });
    DATA.matters.forEach((item, index) => { if (mattersById.has(item.id)) DATA.matters[index] = clone(mattersById.get(item.id)); });
    DATA.person_matter_links = clone(snapshot.data.person_matter_links || DATA.person_matter_links);
  }

  const restored = STORAGE ? STORAGE.loadSnapshot(window.localStorage) : null;
  applySavedData(restored);
  const state = {
    ...defaultState,
    ...(restored ? clone(restored.state) : {}),
    selectedCardId: null, selectedCandidate: null, selectedStyleId: 'my_voice', selectedChoiceIndex: 0,
    handFocus: -1, justDealt: true,
    packFilter: { person: 'all', matter: 'all', sceneType: 'all' }, packSearch: '',
    _personSuggestion: '', _matterSuggestion: ''
  };
  state.aiConfig = { ...defaultState.aiConfig, ...(state.aiConfig || {}) };
  state.styleAvatars = { ...defaultState.styleAvatars, ...(state.styleAvatars || {}) };

  function persistState() {
    if (!STORAGE) return;
    STORAGE.saveSnapshot(window.localStorage, state, DATA);
  }

  function openModal(id) { $(id).hidden = false; document.body.style.overflow = 'hidden'; }
  function closeModal(id) { $(id).hidden = true; if (!$$('.modal-backdrop').some(m => !m.hidden)) document.body.style.overflow = ''; }
  function renderAll() { renderTop(); renderBoard(); renderHand(); renderCounts(); persistState(); }
  function renderTop() {
    const p = person(), m = matter();
    $('heroAvatar').textContent = p.initial;
    $('heroName').textContent = p.name;
    $('heroType').textContent = relationshipTypeName(p.relationship_type);
    $('heroMeta').textContent = `${p.role} · ${p.current_state.mood}`;
    $('matterName').textContent = m.name;
    $('matterMeta').textContent = `${matterKindName(m.kind)} · ${m.stage} · ${m.main_conflict}`;
    $('matterCount').textContent = `${matterIdsForPerson(p.id).length} 个项目可切换`;
  }
  function renderCounts() {
    const s = session();
    $('historyCount').textContent = s.history.length;
    $('packCount').textContent = state.pack.length;
    $('opponentDeckCount').textContent = s.queue.length;
  }

  function placeholder(title, text) { return `<div class="empty-slot"><div><strong>${esc(title)}</strong><small>${esc(text)}</small></div></div>`; }

  // ---------- 场景牌（完整情境字段）----------
  function sceneCardHtml(scene, current = false, variant = 'board') {
    if (!scene) return placeholder('等待对方出牌', '从左侧场景牌堆创建现实、疑问或模拟场景。');
    const p = person();
    const lead = scene.quote
      ? `<blockquote>“${esc(scene.quote)}”</blockquote>`
      : `<p class="scene-lead">${esc(scene.opponent_action || scene.trigger || '（无原话情境）')}</p>`;
    return `<article class="dialog-card ${current ? 'current' : ''} ${variant === 'deck' ? 'deck-scene-card' : ''}" data-flippable-card>
      <div class="card-inner">
        <section class="card-face scene-front">
          <button class="flip-button" data-flip type="button">↻</button>
          <div class="card-corner-rank" aria-hidden="true">${esc(sceneTypeName(scene.scene_type).slice(0,2))}</div>
          <div class="card-flair" aria-hidden="true">${esc(sourceName(scene.source))}</div>
          <div class="card-top">
            <div class="opponent-avatar"><span>${esc(p.initial)}</span><small>${esc(p.name)} · 对方出牌</small></div>
            <span class="source-badge ${sourceClass(scene.source)}">${sourceName(scene.source)}</span>
          </div>
          <h3 class="card-title">${esc(scene.title)}</h3>
          <div class="card-art">${esc(sceneTypeName(scene.scene_type))} · 场景</div>
          <div class="card-body">${lead}</div>
          <div class="card-rarity" aria-hidden="true">${renderRarity(scene.confidence || '中')}</div>
          <div class="card-foot">
            <span class="card-foot-meta">${esc(sceneTypeName(scene.scene_type))}</span>
            <span class="card-foot-divider">·</span>
            <span class="card-foot-meta">置信度 ${esc(scene.confidence || '中')}</span>
            <span class="card-foot-divider">·</span>
            <time class="card-foot-meta">${esc((scene.created_at || '').slice(0, 10) || '今日')}</time>
          </div>
        </section>
        <section class="card-face card-back card-back-scene">
          <button class="flip-button" data-flip type="button">↻</button>
          <div class="back-list">
            <div><span>地点</span><strong>${esc(scene.location || '—')}</strong></div>
            <div><span>渠道</span><strong>${esc(scene.channel || '—')}</strong></div>
            <div><span>时机</span><strong>${esc((scene.occasion || '') + (scene.timing ? ' · ' + scene.timing : ''))}</strong></div>
            <div><span>在场人</span><strong>${esc((scene.audience || []).join('、') || '—')}</strong></div>
            <div><span>触发事件</span><strong>${esc(scene.trigger || '—')}</strong></div>
            <div><span>约束</span><strong>${esc((scene.constraints || []).join('、') || '—')}</strong></div>
            <div><span>对方关注</span><strong>${esc(scene.focus || '待判断')}</strong></div>
            <div><span>本回合目标</span><strong>${esc(scene.round_goal || '形成合适回应')}</strong></div>
            <div><span>来源 / 置信度</span><strong>${sourceName(scene.source)} · ${esc(scene.confidence || '中')}</strong></div>
          </div>
        </section>
      </div></article>`;
  }
  function replyCardHtml(player, current = false, saved = false) {
    if (!player) return placeholder('等待我方出牌', '从下方手牌中选择一张应对。');
    const rank = player.ai_rank ? `<span class="rank-badge ${rankClass(player.ai_rank)}">${rankName(player.ai_rank)}</span>` : `<span class="rank-badge rank-primary">已采用 · ${esc(player.style_name || '我的原声')}</span>`;
    return `<article class="dialog-card ${current ? 'current' : ''} rank-${player.ai_rank || 'primary'}" data-flippable-card>
      <div class="card-inner">
        <section class="card-face reply-front">
          <button class="flip-button" data-flip type="button">↻</button>
          <div class="card-corner-rank" aria-hidden="true">${esc(rankName(player.ai_rank || 'primary').slice(0,2))}</div>
          <div class="card-flair" aria-hidden="true">${saved ? '已收藏' : '采用中'}</div>
          <div class="card-top"><div class="rank-row">${rank}${saved ? '<span class="rank-badge rank-primary">已收藏</span>' : ''}</div></div>
          <h3 class="card-title">${esc(player.title)}</h3>
          <div class="card-art">${esc(player.style_name || '我的原声')}</div>
          <div class="card-body"><blockquote>“${esc(player.reply)}”</blockquote></div>
          <div class="card-rarity" aria-hidden="true">${renderRarity(player.confidence || '中')}</div>
          <div class="card-foot"><span class="card-foot-meta">${esc(player.style_name || '我的原声')}</span><span class="card-foot-divider">·</span><span class="card-foot-meta">${saved ? '已收藏，可复用' : '当前回合采用'}</span></div>
        </section>
        <section class="card-face card-back card-back-player">
          <button class="flip-button" data-flip type="button">↻</button>
          <div class="back-list">
            <div><span>采用路线</span><strong>${esc(player.title)}</strong></div>
            <div><span>表达风格</span><strong>${esc(player.style_name || '我的原声')}</strong></div>
            <div><span>具体抉择</span><strong>${esc(player.choice_title || '无')}</strong></div>
            <div><span>后续用途</span><strong>${saved ? '已进入卡包，可独立复用' : '尚未收藏，仅保留在回合历史'}</strong></div>
          </div>
        </section>
      </div></article>`;
  }
  function bindFlips(root = document) {
    $$('[data-flip]', root).forEach(b => b.addEventListener('click', e => { e.stopPropagation(); b.closest('[data-flippable-card]').classList.toggle('is-flipped'); }));
    // 9.2 鼠标视差：mousemove 设置 --shine-x/y/tilt-x/y
    $$('[data-flippable-card]', root).forEach(card => {
      let raf = null;
      let nx = 50, ny = 25, tx = 0, ty = 0;
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        nx = ((e.clientX - r.left) / r.width) * 100;
        ny = ((e.clientY - r.top) / r.height) * 100;
        tx = ((e.clientY - r.top) / r.height - 0.5) * -2.5;
        ty = ((e.clientX - r.left) / r.width - 0.5) * 2.5;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          const back = card.querySelector('.card-back');
          if (back) {
            back.style.setProperty('--shine-x', nx.toFixed(1) + '%');
            back.style.setProperty('--shine-y', ny.toFixed(1) + '%');
            back.style.setProperty('--tilt-x', tx.toFixed(2) + 'deg');
            back.style.setProperty('--tilt-y', ty.toFixed(2) + 'deg');
          }
          raf = null;
        });
      });
      card.addEventListener('mouseleave', () => {
        const back = card.querySelector('.card-back');
        if (back) {
          back.style.setProperty('--tilt-x', '0deg');
          back.style.setProperty('--tilt-y', '0deg');
        }
      });
    });
    // 9.4 Three.js 翻面响应
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      $$('[data-flippable-card]', root).forEach(card => {
        const back = card.querySelector('.card-back');
        $$('[data-flip]', card).forEach(btn => {
          btn.addEventListener('click', () => {
            try {
              const side = back && back.parentElement && back.parentElement.classList.contains('is-flipped') ? 'back' : 'front';
              const rank = (card.dataset.rank || (card.querySelector('[class*="rank-"]') || {}).className || '').match(/rank-(\w+)/);
              window.dispatchEvent(new CustomEvent('rdc:card-flip', {
                detail: {
                  side,
                  face: side,
                  rank: rank ? rank[1] : null,
                  rect: card.getBoundingClientRect()
                }
              }));
            } catch (error) { /* noop */ }
          });
        });
      });
    }
  }
  function renderBoard() {
    const s = session();
    const previousRecord = s.previous ? s.history.find(record => record.id === s.previous.recordId) : null;
    $('previousOpponentSlot').innerHTML = '';
    $('previousPlayerSlot').innerHTML = '';
    $('previousOpponentPeek').innerHTML = s.previous
      ? `<span>${esc(person().initial)}</span><div><small>上一轮场景</small><strong>${esc(s.previous.opponent.title)}</strong></div>`
      : '';
    $('previousPlayerPeek').innerHTML = s.previous
      ? `<span>✓</span><div><small>${s.previous.saved ? '已收藏' : '上一轮回应'}</small><strong>${esc(s.previous.player.title)}</strong><em>${esc(previousRecord?.outcome || '结果待验证')}</em></div>`
      : '';
    $('currentOpponentSlot').innerHTML = sceneCardHtml(s.current.opponent, true);
    $('currentPlayerSlot').innerHTML = replyCardHtml(s.current.player, true, s.current.saved);
    bindFlips();
    // 当前轮卡片入场动画
    $$('#currentOpponentSlot .dialog-card, #currentPlayerSlot .dialog-card').forEach(el => el.classList.add('entering'));
    $('previousOpponentPeek').hidden = !s.previous;
    $('previousPlayerPeek').hidden = !s.previous;
    renderRoundControls();
  }

  function openPreviousCard(kind) {
    const previous = session().previous;
    if (!previous) return;
    openCardViewer(kind === 'opponent' ? previous.opponent : previous.player, kind, Boolean(previous.saved));
  }

  function openCurrentCard(kind) {
    const current = session().current;
    const cardData = kind === 'opponent' ? current.opponent : current.player;
    if (!cardData) return;
    openCardViewer(cardData, kind, Boolean(current.saved));
  }

  function openCardViewer(cardData, kind, saved = false) {
    $('previousCardContent').innerHTML = kind === 'opponent'
      ? sceneCardHtml(cardData)
      : replyCardHtml(cardData, false, saved);
    bindFlips($('previousCardContent'));
    openModal('previousCardModal');
  }
  function renderRoundControls() {
    const s = session();
    if (!s.current.opponent) { $('roundControls').innerHTML = '<button id="askOpponent" class="primary-button" type="button">从左侧牌堆创建下一场景</button>'; $('askOpponent').addEventListener('click', openOpponentDeck); return; }
    if (!s.current.player) { $('roundControls').innerHTML = '<span class="helper-text">AI已按当前场景约束重新发牌。请选择下方一张回应。</span>'; return; }
    $('roundControls').innerHTML = `<button id="saveRoundButton" class="secondary-button save-button ${s.current.saved ? 'saved' : ''}" type="button">${s.current.saved ? '★ 已标记收藏' : '☆ 收藏这一回合'}</button><button id="waitButton" class="secondary-button" type="button">结束，等待现实回复</button><button id="simulateButton" class="primary-button" type="button">模拟对方下一句</button>`;
    $('saveRoundButton').addEventListener('click', toggleCurrentSave);
    $('waitButton').addEventListener('click', () => finishRound(null));
    $('simulateButton').addEventListener('click', () => finishRound(buildSimulationScene()));
  }

  function handPlan() { return session().current.opponent ? session().current.opponent.hand_plan : null; }
  function centerPrimaryCandidate(items) {
    const candidates = [...items];
    const primaryIndex = candidates.findIndex(candidate => candidate.rank === 'primary');
    if (primaryIndex < 0) return candidates;
    const [primary] = candidates.splice(primaryIndex, 1);
    candidates.splice(Math.floor(candidates.length / 2), 0, primary);
    return candidates;
  }
  function renderHand(options = {}) {
    const plan = handPlan();
    if (!plan) {
      const aiLoading = session().current.opponent?.hand_plan_source === 'loading';
      $('handAxis').textContent = aiLoading ? 'AI 正在为你拆解当前场景' : '等待新的场景牌';
      $('handCoverage').textContent = aiLoading ? '已发送当前人物、事项、上一轮信息，正在调用 LLM 重新发牌……' : '对方出牌后，系统将重新生成当前场景的主要并行解法。';
      $('handFan').innerHTML = aiLoading
        ? '<div class="hand-loading"><span class="hand-loading-dot"></span><span class="hand-loading-dot"></span><span class="hand-loading-dot"></span><span>AI 思考中…</span></div>'
        : '';
      renderHandPlanSource();
      return;
    }
    plan.candidates = centerPrimaryCandidate(plan.candidates);
    $('handAxis').textContent = plan.axis;
    $('handCoverage').textContent = plan.coverage;
    $('handFan').innerHTML = plan.candidates.map((c, i) => handCardHtml(c, i)).join('');
    renderHandPlanSource();
    layoutHand(-1);
    bindFlips($('handFan'));
    // 关键动作：手牌重新发出 → 派发 stage-fx 流光 + 主推荐光束;
    // AI 替换时跳过 (options.skipStageFx) 避免二次触发导致卡顿
    const hand = $('handFan');
    if (hand && state.justDealt && !options.skipStageFx) {
      const rects = [...hand.querySelectorAll('.hand-card')].map(c => c.getBoundingClientRect());
      dispatchStageEvent('rdc:hand-deal', {
        count: rects.length,
        ranks: plan.candidates.map(c => c.rank),
        rects
      });
      state.justDealt = false;
    }
    $$('.hand-card').forEach(el => {
      el.addEventListener('mouseenter', () => { state.handFocus = Number(el.dataset.index); layoutHand(state.handFocus); });
      el.addEventListener('mouseleave', () => { state.handFocus = -1; layoutHand(-1); el.style.setProperty('--tilt-rx', '0deg'); el.style.setProperty('--tilt-ry', '0deg'); });
      el.addEventListener('mousemove', e => {
        if (!el.classList.contains('focused')) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--tilt-rx', `${(-y * 5).toFixed(1)}deg`);
        el.style.setProperty('--tilt-ry', `${(x * 5).toFixed(1)}deg`);
      });
      el.addEventListener('click', e => { if (e.target.closest('[data-flip]')) return; openPlay(el.dataset.cardId); });
    });
    // 发牌动画结束后移除 dealt 类，让倾斜 transform 恢复生效
    $$('.hand-card.dealt .card-inner').forEach(inner => {
      inner.addEventListener('animationend', () => inner.closest('.hand-card').classList.remove('dealt'), { once: true });
    });
    if (window.matchMedia('(max-width:720px)').matches) {
      window.requestAnimationFrame(() => {
        const handViewport = $('handViewport');
        const primaryCard = handViewport.querySelector('.hand-card.rank-primary');
        if (!primaryCard) return;
        handViewport.scrollLeft = Math.max(0,
          primaryCard.offsetLeft - (handViewport.clientWidth - primaryCard.offsetWidth) / 2
        );
      });
    }
    state.justDealt = false;
  }
  function handCardHtml(candidate, index) {
    const c = candidateCard(candidate);
    const quote = (c.front && c.front.my_voice) || '';
    const ornament = candidate.rank === 'primary'
      ? '<div class="primary-ornament" aria-hidden="true"><i></i><i></i><i></i><i></i><b>✦</b><em></em></div>'
      : '';
    return `<article class="hand-card rank-${candidate.rank} ${state.justDealt ? 'dealt' : ''}" style="--deal-delay:${index * 70}ms" data-index="${index}" data-card-id="${esc(c.id)}" data-flippable-card>
      ${ornament}
      <div class="card-inner">
        <section class="card-face card-front">
          <button class="flip-button" data-flip type="button">↻</button>
          <div class="card-identity"><span class="rank-badge ${rankClass(candidate.rank)}">${rankName(candidate.rank)}</span></div>
          <div class="card-core"><h3>${esc(c.title)}</h3><div class="hand-quote">“${esc(quote)}”</div></div>
          <div class="not-reason card-insight">${candidate.rank === 'primary' ? '为什么推荐：' : candidate.rank === 'backup' ? '切换条件：' : '当前不选：'}${esc(candidate.rank === 'backup' ? (candidate.condition || candidate.reason) : candidate.reason)}</div>
        </section>
        <section class="card-face card-back card-back-hand">
          <button class="flip-button" data-flip type="button">↻</button>
          <div class="back-list">
            <div><span>解法路线</span><strong>${esc(c.title)}</strong></div>
            <div><span>AI判断</span><strong>${esc(candidate.reason)}</strong></div>
            <div><span>行动逻辑</span><strong>${esc(c.back.logic)}</strong></div>
            <div><span>不适用</span><strong>${esc(c.back.invalid)}</strong></div>
            <div><span>依据</span><strong>${esc(c.back.source)}</strong></div>
          </div>
        </section>
      </div></article>`;
  }
  function layoutHand(focus = -1) {
    const cards = $$('.hand-card'), n = cards.length;
    // viewport 自适应, 4 张手牌装下不裁; 3 张/2 张更宽
    const vw = window.innerWidth || 1200;
    let spacing;
    if (n === 4) spacing = Math.max(130, Math.min(150, (vw - 420) / 3));
    else if (n === 3) spacing = Math.min(170, (vw - 380) / 2);
    else if (n === 2) spacing = 180;
    else if (n === 1) spacing = 0;
    else spacing = 150;
    cards.forEach((el, i) => {
      const offset = i - (n - 1) / 2;
      let x = offset * spacing;
      if (focus >= 0 && i < focus) x -= 16;
      if (focus >= 0 && i > focus) x += 16;
      const y = Math.abs(offset) * 3, ang = offset * 3.4, focused = i === focus;
      const t = focused
        ? `translateX(calc(-50% + ${x}px)) translateY(${y - 8}px) rotate(0deg) scale(1.05)`
        : `translateX(calc(-50% + ${x}px)) translateY(${y}px) rotate(${ang}deg)`;
      el.style.transform = t;
      el.style.setProperty('--z', focused ? '50' : String(i + 2));
      el.classList.toggle('focused', focused);
    });
  }
  function candidateFor(id) { return handPlan() ? handPlan().candidates.find(c => c.card_id === id) : null; }
  function openPlay(id) {
    state.selectedCardId = id; state.selectedCandidate = candidateFor(id); state.selectedStyleId = 'my_voice'; state.selectedChoiceIndex = 0;
    renderPlayModal(); openModal('playModal');
  }
  function selectedReply() {
    const cand = state.selectedCandidate;
    const c = cand ? candidateCard(cand) : card(state.selectedCardId);
    return c.front?.[state.selectedStyleId] || c.front?.my_voice || '';
  }
  function renderPlayModal() {
    const cand = state.selectedCandidate;
    const c = cand ? candidateCard(cand) : card(state.selectedCardId);
    const warning = (cand.rank === 'risk' || cand.rank === 'other') ? `<div class="warning-box"><strong>${rankName(cand.rank)}：</strong>${esc(cand.reason)}<br/>仍可出牌；你可能掌握系统尚未记录的信息。</div>` : '';

    // 抉择（炉石风格）：2 张并列大卡，仅 candidate.type === 'choice' 时显示
    const choiceGrid = c.type === 'choice' ? `<div class="play-choice-grid">${c.choices.map((x, i) => `<button class="play-choice-card ${i === state.selectedChoiceIndex ? 'active' : ''}" data-choice-index="${i}" type="button"><strong>${esc(x.title)}</strong><p>${esc(x.summary)}</p></button>`).join('')}</div>` : '';

    // 风格头像：4 个圆头像（可自定义 state.styleAvatars）
    const styleAvatars = state.styleAvatars || {};
    const styleList = `<div class="play-style-row">${DATA.styles.map(s => {
      const avatar = styleAvatars[s.id] || s.id.charAt(0).toUpperCase();
      const isUrl = /^https?:\/\//i.test(avatar) || /^data:/.test(avatar);
      const avatarHtml = isUrl
        ? `<img src="${esc(avatar)}" alt="${esc(s.name)}" />`
        : `<span class="play-avatar-emoji">${esc(avatar)}</span>`;
      return `<button class="play-style-avatar ${s.id === state.selectedStyleId ? 'active' : ''}" data-style-id="${s.id}" type="button" title="${esc(s.name)} · ${esc(s.note)}">${avatarHtml}<small>${esc(s.name)}</small></button>`;
    }).join('')}</div>`;

    // 当前风格 reply 摘要（紧凑一行，hover 展开）
    const previewReply = selectedReply();

    $('playModalContent').innerHTML = `<div class="play-compact">
      <header class="play-header">
        <span class="rank-badge ${rankClass(cand.rank)}">${rankName(cand.rank)}</span>
        <h2>${esc(c.title)}</h2>
        <p class="play-reply-preview">“${esc(previewReply)}”</p>
        ${warning}
      </header>
      ${c.type === 'choice' ? `<section class="play-section"><h3>选具体路线</h3>${choiceGrid}</section>` : ''}
      <section class="play-section"><h3>换风格</h3>${styleList}</section>
      <div class="play-actions"><button class="secondary-button" data-close="playModal" type="button">返回手牌</button><button id="confirmPlay" class="primary-button" type="button">确认出牌</button></div>
    </div>`;
    bindFlips($('playModalContent'));
    $$('[data-choice-index]', $('playModalContent')).forEach(b => b.addEventListener('click', () => { state.selectedChoiceIndex = Number(b.dataset.choiceIndex); renderPlayModal(); }));
    $$('[data-style-id]', $('playModalContent')).forEach(b => b.addEventListener('click', () => { state.selectedStyleId = b.dataset.styleId; renderPlayModal(); }));
    $$('[data-close]', $('playModalContent')).forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
    $('confirmPlay').addEventListener('click', confirmPlay);
  }
  function confirmPlay() {
    const cand = state.selectedCandidate;
    const c = cand ? candidateCard(cand) : card(state.selectedCardId);
    const playerData = {
      card_id: c.id, title: c.title, reply: selectedReply(), style_name: style(state.selectedStyleId).name,
      style_id: state.selectedStyleId,
      choice_title: c.type === 'choice' ? c.choices[state.selectedChoiceIndex].title : '',
      ai_rank: cand.rank, ai_reason: cand.reason,
      front: c.front || undefined
    };
    session().current.player = playerData;
    session().current.saved = false;

    // --- 出牌飞行动效 ---
    const previewCard = document.querySelector('.play-preview .dialog-card');
    const targetSlot = $('currentPlayerSlot');
    let clone = null;
    if (previewCard && targetSlot) {
      const src = previewCard.getBoundingClientRect();
      const dst = targetSlot.getBoundingClientRect();
      clone = previewCard.cloneNode(true);
      clone.className = 'card-fly-clone';
      clone.removeAttribute('data-flippable-card');
      clone.style.left = src.left + 'px';
      clone.style.top = src.top + 'px';
      clone.style.width = src.width + 'px';
      clone.style.height = src.height + 'px';
      clone.style.transform = 'none';
      // 计算位移和缩放
      clone._dx = dst.left + dst.width / 2 - src.left - src.width / 2;
      clone._dy = dst.top + dst.height / 2 - src.top - src.height / 2;
      clone._sx = dst.width / src.width;
      clone._sy = dst.height / src.height;
    }

    closeModal('playModal');

    if (clone) {
      document.body.appendChild(clone);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          clone.style.transform = `translate(${clone._dx}px,${clone._dy}px) scale(${clone._sx})`;
          clone.style.opacity = '0';
        });
      });
      setTimeout(() => { clone.remove(); renderAll(); }, 580);
    } else {
      renderAll();
    }
    // 关键动作：我方出牌 → 派发 stage-fx 关系光路
    const playerSlot = $('currentPlayerSlot');
    const oppSlot = $('currentOpponentSlot');
    if (playerSlot && oppSlot) {
      dispatchStageEvent('rdc:player-play', {
        rank: state.selectedCandidate && state.selectedCandidate.rank,
        sourceRect: oppSlot.getBoundingClientRect(),
        targetRect: playerSlot.getBoundingClientRect()
      });
    }
  }
  function recordFromCurrent() {
    const s = session(), p = person(), m = matter(), opp = s.current.opponent || {};
    return {
      id: `round-${p.id}-${m.id}-${Date.now()}`, person_id: p.id, matter_id: m.id,
      scene_type: opp.scene_type || 'private', turn: s.turn, saved: s.current.saved,
      outcome: opp.source === 'simulation' ? '模拟分支，结果待现实验证。' : '等待或已录入现实反馈。',
      created_at: new Date().toISOString().slice(0, 10),
      opponent: clone(s.current.opponent), player: clone(s.current.player),
      why_saved: s.current.saved ? '用户判断该场景—应对具有复用价值。' : ''
    };
  }
  function toggleCurrentSave() {
    const prev = session().current.saved;
    session().current.saved = !prev;
    renderBoard();
    // 关键动作：从未收藏 → 收藏时派发星点飞卡包
    if (!prev && session().current.saved) {
      const opp = $('currentOpponentSlot');
      const player = $('currentPlayerSlot');
      const pack = $('packSpineButton');
      if (opp && player && pack) {
        dispatchStageEvent('rdc:round-save', {
          saved: true,
          sourceRect: opp.getBoundingClientRect(),
          targetRect: player.getBoundingClientRect(),
          packRect: pack.getBoundingClientRect()
        });
      }
    }
  }
  function finishRound(nextScene) {
    const s = session();
    if (!s.current.opponent || !s.current.player) return;
    const rec = recordFromCurrent();
    s.history.push(rec);
    if (rec.saved && !state.pack.some(r => r.id === rec.id)) state.pack.unshift(clone(rec));
    s.previous = { opponent: rec.opponent, player: rec.player, saved: rec.saved, recordId: rec.id };
    s.turn += 1;
    s.current = { opponent: nextScene, player: null, saved: false };
    state.justDealt = true;
    renderAll();
    if (nextScene && aiEngaged()) refillHandPlanWithAi(nextScene);
  }
  function buildSimulationScene() {
    const sc = session().current.opponent, base = scenariosFor()[0] || DATA.scenarios[Object.keys(DATA.scenarios)[0]][0];
    const fallbackText = { title: '继续追问', quote: '我理解你的意思，但你能不能把条件和责任再说具体一点？' };
    const text = sc ? (sc.simulation || {}) : {};
    const src = text.title ? text : fallbackText;
    const enableAi = aiEngaged();
    const scene = {
      id: `sim-${Date.now()}`, source: 'simulation', scene_type: sc ? sc.scene_type : 'meeting',
      channel: 'AI模拟', title: src.title, quote: src.quote,
      tags: ['AI仿真', '非现实记录', '可继续推演'],
      constraints: sc ? sc.constraints : [], round_goal: '检验当前路线是否经得起下一轮沟通',
      focus: '根据上一轮回应继续追问', confidence: '中',
      hand_plan: enableAi ? null : clone(base.hand_plan),
      simulation: fallbackText,
      hand_plan_source: enableAi ? 'loading' : 'local',
      hand_plan_reason: ''
    };
    if (enableAi) {
      scene._preservedHandPlan = clone(base.hand_plan);
      scene._preservedSimulation = src;
      aiRefillSimulationScene(scene);
    }
    return scene;
  }

  async function aiRefillSimulationScene(scene) {
    if (!scene) return;
    const aiClient = createConfiguredAiClient();
    if (!aiClient) {
      if (session().current.opponent === scene) renderHandPlanSource();
      return;
    }
    const previousPlayer = session().current.player || {};
    const previousScene = session().current.opponent || {};
    const fallbackPlan = scene._preservedHandPlan || genericPlan() || { axis: '本地兜底', coverage: '', candidates: [] };
    const fallbackScene = scene._preservedSimulation || { title: '继续追问', quote: '我理解你的意思，但你能不能把条件和责任再说具体一点？' };
    try {
      const result = await AI_ENGINE.generateNextScene({
        person: person(),
        matter: matter(),
        currentScene: previousScene,
        previousPlayer,
        aiClient,
        fallbackScene,
        fallbackPlan
      });
      scene.title = result.scene.title;
      scene.quote = result.scene.quote;
      scene.simulation = result.scene;
      scene.hand_plan = result.plan;
      scene.hand_plan_source = result.source;
      scene.hand_plan_reason = result.source === 'ai' ? '' : (result.reason || 'AI 模拟失败，使用本地兜底');
    } catch (error) {
      scene.title = fallbackScene.title;
      scene.quote = fallbackScene.quote;
      scene.simulation = fallbackScene;
      scene.hand_plan = fallbackPlan;
      scene.hand_plan_source = 'local';
      scene.hand_plan_reason = `AI 模拟失败：${error.message}`;
    }
    delete scene._preservedHandPlan;
    delete scene._preservedSimulation;
    if (session().current.opponent === scene) {
      state.justDealt = true;
      renderHand();
      renderBoard();
      persistState();
    }
  }
  function openOpponentDeck() { renderOpponentDeck(); openModal('opponentDeckModal'); }
  function renderOpponentDeck() {
    const q = session().queue;
    const cards = q.map(s => `<div class="deck-card-option" data-scene-id="${esc(s.id)}" role="button" tabindex="0" aria-label="打出场景：${esc(s.title)}">${sceneCardHtml(s, false, 'deck')}</div>`).join('');
    $('sourceTemplates').innerHTML = q.length ? `<div class="deck-card-grid">${cards}</div>` : '<p class="helper-text">当前没有预置场景，可录入现实回复、我的疑问或使用AI模拟。</p>';
    bindFlips($('sourceTemplates'));
    $$('[data-scene-id]', $('sourceTemplates')).forEach(option => {
      const play = event => {
        if (event.target.closest('[data-flip]')) return;
        const scene = q.find(s => s.id === option.dataset.sceneId);
        if (scene) playNewScene(scene);
      };
      option.addEventListener('click', play);
      option.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); play(event); }
      });
    });
  }
  function playNewScene(scene) {
    const s = session();
    if (s.current.player) finishRound(scene);
    else {
      if (aiEngaged()) {
        scene._preservedHandPlan = scene.hand_plan;
        scene.hand_plan = null;
      }
      s.current = { opponent: scene, player: null, saved: false };
      state.justDealt = true;
      renderAll();
    }
    closeModal('opponentDeckModal');
    dispatchSceneChange({ sceneType: scene && scene.scene_type });
    // 关键动作：对方出牌 → 派发 stage-fx 光轨 + 波纹
    const deck = $('opponentDeckButton');
    const target = $('currentOpponentSlot');
    if (deck && target) {
      dispatchStageEvent('rdc:opponent-play', {
        sourceRect: deck.getBoundingClientRect(),
        targetRect: target.getBoundingClientRect(),
        sceneType: scene && scene.scene_type
      });
    }
    if (aiEngaged()) refillHandPlanWithAi(scene);
  }

  function dispatchSceneChange(detail) {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    try {
      window.dispatchEvent(new CustomEvent('rdc:scene-change', { detail: detail || {} }));
    } catch (error) { /* 静默降级 */ }
  }

  function dispatchStageEvent(name, detail) {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || !name) return;
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (error) { /* 静默降级 */ }
  }
  function genericPlan() {
    const list = scenariosFor();
    const found = list.find(s => s.hand_plan) || Object.values(DATA.scenarios).flat().find(s => s.hand_plan);
    return clone(found.hand_plan);
  }
  function aiEngaged() {
    if (!AI_ENGINE || !AI) return false;
    const cfg = state.aiConfig || {};
    return Boolean(cfg.enabled && cfg.baseUrl && cfg.model && cfg.apiKey);
  }
  function createConfiguredAiClient() {
    if (!aiEngaged()) return null;
    try {
      return AI.createOpenAICompatibleClient(state.aiConfig);
    } catch (error) {
      return null;
    }
  }
  async function refillHandPlanWithAi(scene) {
    if (!scene) return;
    const aiClient = createConfiguredAiClient();
    if (!aiClient) {
      if (session().current.opponent === scene) renderHandPlanSource();
      return;
    }
    const fallback = scene._preservedHandPlan || scene.hand_plan || genericPlan() || { axis: '本地兜底', coverage: '', candidates: [] };
    const input = {
      person: person(),
      matter: matter(),
      scene,
      history: (session().history || []).slice(-2).map(record => ({
        title: record.opponent?.title || '',
        outcome: record.player?.reply || ''
      })),
      aiClient,
      fallback
    };
    const t0 = Date.now();
    try {
      const result = await AI_ENGINE.generateHandPlan(input);
      const elapsed = Date.now() - t0;
      console.info('[AI]', result.source, `${elapsed}ms`, 'cards:', result.plan.candidates.length);
      scene.hand_plan = result.plan;
      scene.hand_plan_source = result.source;
      scene.hand_plan_reason = result.source === 'ai' ? '' : (result.reason || 'AI 未启用或返回异常，已切换本地手牌。');
      if (result.source === 'local') {
        console.warn('[AI] 回退本地:', result.reason);
      }
    } catch (error) {
      console.error('[AI] 异常:', error);
      scene.hand_plan = fallback;
      scene.hand_plan_source = 'local';
      scene.hand_plan_reason = `AI 调用失败：${error.message}`;
    }
    delete scene._preservedHandPlan;
    if (session().current.opponent === scene) {
      state.justDealt = true;
      renderHand();
      persistState();
    }
  }
  function renderHandPlanSource() {
    const el = $('handPlanSource');
    if (!el) return;
    const scene = session().current.opponent;
    const source = scene?.hand_plan_source;
    if (!source || source === 'preset') { el.textContent = ''; el.className = 'hand-source'; return; }
    if (source === 'loading') {
      el.textContent = '✦ AI 思考中';
      el.className = 'hand-source hand-source-loading';
      el.title = '正在调用 LLM 重新发牌';
      return;
    }
    if (source === 'ai') {
      el.textContent = '✦ AI 实时生成';
      el.className = 'hand-source hand-source-ai';
      el.title = '本手牌由 LLM 实时生成';
    } else {
      el.textContent = '◇ 本地兜底';
      el.className = 'hand-source hand-source-local';
      el.title = scene?.hand_plan_reason || 'AI 不可用，已使用本地规则作为兜底';
    }
  }
  function customScene(source, quote, title) {
    const channelMap = { real: '用户录入', hypothesis: '我的疑问', simulation: 'AI模拟' };
    const scene = {
      id: `${source}-${Date.now()}`, source, scene_type: 'async_message', channel: channelMap[source] || '用户录入',
      title, quote, tags: [sourceName(source), source === 'real' ? '真实发生' : '待验证'],
      constraints: [], round_goal: '形成下一步合适回应', focus: '根据新输入重新判断', confidence: source === 'real' ? '中高' : '中',
      hand_plan: aiEngaged() ? null : genericPlan(), simulation: { title: '继续追问', quote: '你这个回答的前提是什么，能不能再明确一点？' },
      hand_plan_source: aiEngaged() ? 'loading' : 'local', hand_plan_reason: ''
    };
    if (aiEngaged()) {
      scene._preservedHandPlan = genericPlan();
      refillHandPlanWithAi(scene);
    }
    return scene;
  }

  function toggleRecordSave(id) {
    let r = null;
    for (const s of Object.values(state.sessions)) { const found = s.history.find(x => x.id === id); if (found) { r = found; break; } }
    if (!r) return;
    r.saved = !r.saved;
    for (const s of Object.values(state.sessions)) { if (s.previous && s.previous.recordId === id) s.previous.saved = r.saved; }
    const idx = state.pack.findIndex(x => x.id === id);
    if (r.saved && idx < 0) state.pack.unshift(clone(r));
    if (!r.saved && idx >= 0) state.pack.splice(idx, 1);
    renderCounts(); renderHistory(); renderPack(); renderBoard(); persistState();
  }
  function renderRecordCard(r, packMode = false) {
    const p = DATA.people.find(x => x.id === r.person_id), m = DATA.matters.find(x => x.id === r.matter_id);
    const opp = r.opponent || {};
    if (packMode) {
      return `<article class="pack-card" data-flippable-card>
        <div class="card-inner">
          <section class="card-face pack-card-front">
            <button class="flip-button" data-flip type="button" aria-label="查看收藏卡背面">↻</button>
            <div class="card-identity">
              <div class="opponent-avatar"><span>${esc(p.initial)}</span><small>${esc(p.name)} · ${esc(sceneTypeName(opp.scene_type))}</small></div>
              <span class="rank-badge rank-primary">已收藏</span>
            </div>
            <div class="card-core pack-card-core"><h3>${esc(r.player.title)}</h3><blockquote>“${esc(r.player.reply)}”</blockquote></div>
            <div class="card-insight"><strong>${esc(opp.title)}</strong><span>${esc(m.name)} · ${esc(r.outcome || '结果待验证')}</span></div>
            <button class="star-toggle saved" data-record-save="${esc(r.id)}" type="button" aria-label="取消收藏">★</button>
          </section>
          <section class="card-face card-back card-back-saved">
            <button class="flip-button" data-flip type="button" aria-label="返回收藏卡正面">↻</button>
            <div class="back-list">
              <div><span>人物与事项</span><strong>${esc(p.name)} · ${esc(m.name)}</strong></div>
              <div><span>原场景</span><strong>${esc(opp.title)}</strong></div>
              <div><span>表达风格</span><strong>${esc(r.player.style_name || '我的原声')}</strong></div>
              <div><span>为什么收藏</span><strong>${esc(r.why_saved || '尚未填写')}</strong></div>
              <div><span>结果</span><strong>${esc(r.outcome || '待验证')}</strong></div>
            </div>
          </section>
        </div>
      </article>`;
    }
    return `<article class="record-card" data-flippable-card>
      <div class="card-inner">
        <section class="card-face record-front">
          <button class="flip-button" data-flip type="button">↻</button>
          <header class="rec-head card-identity"><div class="mini-person"><span>${esc(p.initial)}</span>${esc(p.name)}</div><time>${esc(r.created_at)}</time></header>
          <div class="rec-body card-core">
            <div class="rec-scene">
              <span class="rec-kicker">场景 · ${esc(sceneTypeName(opp.scene_type))}</span>
              <strong>${esc(opp.title)}</strong>
              <p>“${esc(opp.quote || opp.trigger || '')}”</p>
            </div>
            <div class="rec-divider"><span>应对</span></div>
            <div class="rec-reply">
              <strong>${esc(r.player.title)}</strong>
              <p>“${esc(r.player.reply)}”</p>
            </div>
          </div>
          <div class="rec-foot card-insight">${esc(m.name)} · ${esc(r.outcome || '结果待补充')}</div>
          <button class="star-toggle ${r.saved ? 'saved' : ''}" data-record-save="${esc(r.id)}" type="button">★</button>
        </section>
        <section class="card-face card-back">
          <button class="flip-button" data-flip type="button">↻</button>
          <div class="back-list">
            <div><span>人物与事项</span><strong>${esc(p.name)} · ${esc(m.name)}</strong></div>
            <div><span>场景类型</span><strong>${esc(sceneTypeName(opp.scene_type))}</strong></div>
            <div><span>表达风格</span><strong>${esc(r.player.style_name || '我的原声')}</strong></div>
            <div><span>具体抉择</span><strong>${esc(r.player.choice_title || '无')}</strong></div>
            <div><span>为什么收藏</span><strong>${esc(r.why_saved || '尚未填写')}</strong></div>
            <div><span>结果</span><strong>${esc(r.outcome || '待验证')}</strong></div>
          </div>
        </section>
      </div></article>`;
  }
  function renderHistory() {
    const all = [...session().history].reverse();
    $('historyList').innerHTML = all.length ? all.map(r => renderRecordCard(r)).join('') : '<div class="empty-message">还没有完成的回合。</div>';
    bindRecordEvents($('historyList'));
  }
  function bindRecordEvents(root) { bindFlips(root); $$('[data-record-save]', root).forEach(b => b.addEventListener('click', e => { e.stopPropagation(); toggleRecordSave(b.dataset.recordSave); })); }
  function renderPack() {
    const q = (state.packSearch || '').trim().toLowerCase();
    const list = state.pack.filter(r => {
      const p = DATA.people.find(x => x.id === r.person_id), m = DATA.matters.find(x => x.id === r.matter_id);
      const text = [p.name, r.opponent.title, r.opponent.quote, r.player.title, r.player.reply].join(' ').toLowerCase();
      return !q || text.includes(q);
    });
    $('packGrid').innerHTML = list.length ? list.map(r => renderRecordCard(r, true)).join('') : '<div class="empty-message">没有匹配的收藏卡。完成回合后点击“收藏这一回合”，就会出现在这里。</div>';
    bindRecordEvents($('packGrid'));
  }

  // ---------- 人物详情（标签页）----------
  function renderPersonDetail() {
    const p = person();
    const st = p.current_state;
    const dims = p.dimensions.map(d => `<div class="dim-row"><div class="dim-head"><span class="dim-name">${esc(d.name)}</span><span class="dim-score">${d.score}<small>/100 · 置信${esc(d.confidence)}</small></span></div><div class="dim-bar"><i style="width:${d.score}%"></i></div><div class="dim-evidence">${d.evidence.map(e => `<span>${esc(e)}</span>`).join('')}</div></div>`).join('');
    const facts = (p.facts || []).map(x => `<li>${esc(x)}</li>`).join('');
    const infers = (p.ai_inferences || []).map(x => `<li>${esc(x)}</li>`).join('');
    const pendings = (p.pending || []).map(x => `<li>${esc(x)}</li>`).join('');
    const history = (p.communication_history || []).map(h => `<div class="hist-row"><div class="hist-meta">${esc(h.date)} · ${esc((DATA.matters.find(m => m.id === h.matter_id) || {}).name || '')} · ${esc(h.scene)}</div><div class="hist-quote">对方：“${esc(h.opponent_quote)}”</div><div class="hist-reply">我：“${esc(h.user_reply)}”</div><div class="hist-out">→ ${esc(h.outcome)}</div></div>`).join('');
    const rels = (p.relationships || []).map(r => `<div class="rel-row"><span class="rel-name">${esc(r.name)}</span><span class="rel-type">${esc(r.type)}</span><span class="rel-conf">可信度 ${esc(r.confidence)}</span></div>`).join('');
    const matters = matterIdsForPerson(p.id).map(mId => { const m = DATA.matters.find(x => x.id === mId); return `<button class="matter-switch ${mId === matter().id ? 'active' : ''}" data-matter-switch="${mId}" type="button"><strong>${esc(m.name)}</strong><small>${matterKindName(m.kind)} · ${esc(m.stage)}</small></button>`; }).join('');
    const relationshipTypes = [
      ['leader', '决策型领导'], ['client', '审慎型客户'],
      ['partner', '协商型伴侣'], ['colleague', '协作型同事']
    ];
    const sug = state._personSuggestion ? `<div class="ai-suggestion"><span class="ai-tag">模拟分析</span>${esc(state._personSuggestion)}<div class="ai-actions"><button class="secondary-button" data-person-confirm type="button">确认写入事实</button><button class="ghost-button" data-person-discard type="button">放弃</button></div></div>` : '';
    $('personDetailTitle').textContent = `${p.name} · ${p.role}`;
    $('personDetail').innerHTML = `
      <div class="detail-hero">
        <div class="large-avatar">${esc(p.initial)}</div>
        <div class="detail-hero-body">
          <h3>${esc(p.name)}</h3>
          <div class="detail-sub">${esc(p.role)} · ${esc(p.organization)}</div>
          <div class="state-row">
            <span>情绪 ${esc(st.mood)}</span><span>关系 ${esc(st.relationship)}</span><span>沟通窗口 ${esc(st.communication_window)}</span><span>敏感 ${esc(st.sensitivity)}</span>
          </div>
          <p class="detail-summary">${esc(p.summary)}</p>
          <div class="chip-block"><b>沟通偏好</b>${(p.communication_preferences || []).map(x => `<span class="kv">${esc(x)}</span>`).join('')}</div>
          <div class="chip-block"><b>敏感点</b>${(p.sensitive_points || []).map(x => `<span class="kv warn">${esc(x)}</span>`).join('')}</div>
        </div>
      </div>
      <details class="detail-editor">
        <summary>编辑人物资料</summary>
        <form id="personEditForm" class="edit-form">
          <label>姓名<input name="name" value="${esc(p.name)}" required></label>
          <label>角色<input name="role" value="${esc(p.role)}"></label>
          <label>组织<input name="organization" value="${esc(p.organization)}"></label>
          <label>人物类型<select name="relationship_type">${relationshipTypes.map(([id, name]) => `<option value="${id}" ${p.relationship_type === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
          <label>当前情绪<input name="mood" value="${esc(st.mood)}"></label>
          <label>关系状态<input name="relationship" value="${esc(st.relationship)}"></label>
          <label>沟通窗口<input name="communication_window" value="${esc(st.communication_window)}"></label>
          <label>敏感点<input name="sensitivity" value="${esc(st.sensitivity)}"></label>
          <label class="wide-field">人物摘要<textarea name="summary">${esc(p.summary)}</textarea></label>
          <div class="form-actions wide-field"><button class="primary-button" type="submit">保存人物资料</button></div>
        </form>
      </details>
      <nav class="detail-tabs" data-tabs>
        <button data-tab="profile" class="active" type="button">${icon('profile')}画像与类型</button>
        <button data-tab="evidence" type="button">${icon('evidence')}事实与依据</button>
        <button data-tab="history" type="button">${icon('history')}记录与补充</button>
      </nav>
      <div class="detail-pane active" data-pane="profile">
        <div class="type-summary">
          <div class="type-badge">${icon('profile')}<span>人物类型</span><strong>${esc(relationshipTypeName(p.relationship_type))}</strong></div>
          <p>类型是发牌判断的重要输入；画像用于沟通辅助，不代表人格诊断。</p>
        </div>
        <div class="dim-grid compact-dim-grid">${dims}</div>
      </div>
      <div class="detail-pane" data-pane="evidence">
        <div class="dense-columns">
          <section class="fact-block confirmed"><h4>✓ 已确认事实</h4><ul>${facts || '<li>暂无</li>'}</ul></section>
          <section class="fact-block inferred"><h4>◇ AI推断（待验证）</h4><ul>${infers || '<li>暂无</li>'}</ul></section>
          <section class="fact-block pending"><h4>! 待确认事项</h4><ul>${pendings || '<li>暂无</li>'}</ul></section>
          <section class="fact-block"><h4>关系位置</h4><div class="rel-list">${rels || '<p class="helper-text">暂无关系信息。</p>'}</div></section>
        </div>
      </div>
      <div class="detail-pane" data-pane="history">
        <div class="dense-columns history-layout">
          <section><h4 class="section-title">${icon('history')}沟通记录</h4>${history || '<p class="helper-text">暂无沟通历史。</p>'}</section>
          <section><h4 class="section-title">${icon('project')}相关项目</h4><div class="matter-switch-list">${matters}</div></section>
        </div>
        <section class="inline-editor">
          <label>补充新的事实 / 原话 / 观察</label>
          <textarea id="personFactInput" placeholder="例如：他在会上打断了我三次，明显对进度不满。"></textarea>
          <div class="ai-tools">
            <button class="secondary-button" data-person-add type="button">写入事实</button>
            <button class="primary-button" data-person-sim type="button">模拟AI分析</button>
          </div>
          ${sug}
        </section>
      </div>`;
    bindDetailTabs($('personDetail'));
    $('personEditForm').addEventListener('submit', event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      p.name = String(values.get('name') || '').trim() || p.name;
      p.initial = p.name.slice(0, 1);
      p.role = String(values.get('role') || '').trim();
      p.organization = String(values.get('organization') || '').trim();
      p.relationship_type = String(values.get('relationship_type') || 'colleague');
      p.summary = String(values.get('summary') || '').trim();
      p.current_state = {
        ...p.current_state,
        mood: String(values.get('mood') || '').trim(),
        relationship: String(values.get('relationship') || '').trim(),
        communication_window: String(values.get('communication_window') || '').trim(),
        sensitivity: String(values.get('sensitivity') || '').trim()
      };
      persistState();
      renderTop();
      renderPersonDetail();
    });
    $$('[data-matter-switch]', $('personDetail')).forEach(b => b.addEventListener('click', () => { switchMatter(b.dataset.matterSwitch); closeModal('personModal'); openMatterDetail(); }));
    const fi = $('personFactInput');
    if (fi) {
      $('personDetail').querySelector('[data-person-add]').addEventListener('click', () => { const v = fi.value.trim(); if (v) { p.facts.push(v); state._personSuggestion = ''; persistState(); renderPersonDetail(); } });
      $('personDetail').querySelector('[data-person-sim]').addEventListener('click', async () => {
        const aiClient = createConfiguredAiClient();
        const fallback = `（模拟分析）基于近期沟通，建议补充事实：该人物在“${st.sensitivity}”相关话题上反应更敏感，沟通宜先给明确结论并说明责任。`;
        if (aiClient) {
          state._personSuggestion = 'AI 正在分析……';
          renderPersonDetail();
          const result = await AI_ENGINE.quickAnalysis({
            systemPrompt: '你是关系决策牌组的人物分析助手。基于人物画像、当前状态、沟通偏好、敏感点、近期沟通记录，输出 1-2 条简短的"可补充事实"推断建议。每条不超过 30 字。',
            userPrompt: `人物: ${p.name} (${p.role})\n状态: ${JSON.stringify(p.current_state)}\n偏好: ${(p.communication_preferences || []).join('、')}\n敏感点: ${(p.sensitive_points || []).join('、')}\n已知事实: ${(p.facts || []).slice(-3).join('；')}\n近期沟通: ${(p.communication_history || []).slice(-2).map(h => h.opponent_quote).join(' | ')}`,
            aiClient,
            fallback
          });
          state._personSuggestion = result.source === 'ai' ? result.text : `（本地兜底）${result.text}`;
        } else {
          state._personSuggestion = fallback;
        }
        renderPersonDetail();
      });
      const cf = $('personDetail').querySelector('[data-person-confirm]'); if (cf) cf.addEventListener('click', () => { p.facts.push(state._personSuggestion); state._personSuggestion = ''; persistState(); renderPersonDetail(); });
      const ds = $('personDetail').querySelector('[data-person-discard]'); if (ds) ds.addEventListener('click', () => { state._personSuggestion = ''; renderPersonDetail(); });
    }
  }

  // ---------- 项目详情（标签页）----------
  function openMatterDetail() { renderMatterDetail(); openModal('matterModal'); }
  function renderMatterDetail() {
    const m = matter(), p = person();
    const milestones = (m.milestones || []).map(x => `<div class="ms-row"><span class="ms-name">${esc(x.name)}</span><span class="ms-meta">${esc(x.date || '')} · ${esc(x.status || '')} · ${esc(x.owner || '')}</span></div>`).join('');
    const risks = (m.risks || []).map(x => `<div class="rk-row"><div class="rk-head"><strong>${esc(x.desc)}</strong><span class="rk-level">${esc(x.level)}</span></div><div class="rk-meta">触发：${esc(x.trigger || '—')} · 应对：${esc(x.mitigation || '—')} · 责任人：${esc(x.owner || '—')}</div></div>`).join('');
    const events = (m.events || []).map(x => `<div class="ev-row"><span class="ev-date">${esc(x.date)}</span><span class="ev-text">${esc(x.text)}</span></div>`).join('');
    const facts = (m.facts || []).map(x => `<li>${esc(x)}</li>`).join('');
    const parts = personIdsForMatter(m.id).map(personId => {
      const relatedPerson = DATA.people.find(item => item.id === personId);
      const link = DATA.person_matter_links.find(item => item.person_id === personId && item.matter_id === m.id);
      return `<span class="kv">${esc(relatedPerson?.name || personId)} · ${esc(link?.role || '相关人员')}</span>`;
    }).join('');
    const rounds = session().history.map(r => `<div class="round-row-mini"><strong>${esc(r.opponent.title)}</strong><small>${esc(r.player.title)} · ${esc(r.created_at)}</small></div>`).join('');
    const switches = matterIdsForPerson(p.id).map(mId => { const mm = DATA.matters.find(x => x.id === mId); return `<button class="matter-switch ${mId === m.id ? 'active' : ''}" data-matter-switch2="${mId}" type="button"><strong>${esc(mm.name)}</strong><small>${matterKindName(mm.kind)} · ${esc(mm.stage)}</small></button>`; }).join('');
    const matterLinks = new Map((DATA.person_matter_links || [])
      .filter(link => link.matter_id === m.id)
      .map(link => [link.person_id, link]));
    const relatedPeopleRows = DATA.people.map(personItem => {
      const link = matterLinks.get(personItem.id);
      const isCurrent = personItem.id === p.id;
      return `<div class="relation-edit-row">
        <label class="check-field"><input data-link-person="${esc(personItem.id)}" type="checkbox" ${link || isCurrent ? 'checked' : ''} ${isCurrent ? 'disabled' : ''}>${esc(personItem.name)}</label>
        <input data-link-role="${esc(personItem.id)}" value="${esc(link?.role || (isCurrent ? '当前沟通对象' : '相关人员'))}" aria-label="${esc(personItem.name)}在项目中的角色">
      </div>`;
    }).join('');
    const sug = state._matterSuggestion ? `<div class="ai-suggestion"><span class="ai-tag">模拟分析</span>${esc(state._matterSuggestion)}<div class="ai-actions"><button class="secondary-button" data-matter-confirm type="button">确认写入</button><button class="ghost-button" data-matter-discard type="button">放弃</button></div></div>` : '';
    $('matterDetailTitle').textContent = `${m.name} · ${matterKindName(m.kind)}`;
    $('matterDetail').innerHTML = `
      <details class="detail-editor">
        <summary>编辑项目资料与相关人员</summary>
        <form id="matterEditForm" class="edit-form">
          <label>名称<input name="name" value="${esc(m.name)}" required></label>
          <label>类型<select name="kind">${DATA.matter_kinds.map(item => `<option value="${item.id}" ${m.kind === item.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>
          <label>状态<input name="status" value="${esc(m.status)}"></label>
          <label>阶段<select name="stage_id">${DATA.stages.map((item, index) => `<option value="${item.id}" ${m.stage_index === index + 1 ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>
          <label>主要矛盾<input name="main_conflict" value="${esc(m.main_conflict)}"></label>
          <label>当前目标<input name="current_goal" value="${esc(m.current_goal)}"></label>
          <label class="wide-field">待决策<input name="decision_needed" value="${esc(m.decision_needed)}"></label>
          <div class="wide-field relation-editor"><strong>相关人员（多对多）</strong>${relatedPeopleRows}</div>
          <div class="form-actions wide-field"><button class="primary-button" type="submit">保存项目资料与关系</button></div>
        </form>
      </details>
      <nav class="detail-tabs" data-tabs>
        <button data-tab="overview" class="active" type="button">${icon('project')}项目与判断</button>
        <button data-tab="progress" type="button">${icon('progress')}进展与风险</button>
        <button data-tab="records" type="button">${icon('cards')}记录与补充</button>
      </nav>
      <div class="detail-pane active" data-pane="overview">
        <div class="matter-switch-list compact-switches">${switches}</div>
        <h4 class="section-title">${icon('project')}当前判断</h4>
        <div class="judge-grid">
          <div><span>类型</span><strong>${esc(matterKindName(m.kind))}</strong></div>
          <div><span>阶段</span><strong>${esc(m.stage)}（${m.stage_index}/10）</strong></div>
          <div><span>状态</span><strong>${esc(m.status)}</strong></div>
          <div><span>主要矛盾</span><strong>${esc(m.main_conflict)}</strong></div>
          <div><span>当前目标</span><strong>${esc(m.current_goal)}</strong></div>
          <div><span>待决策</span><strong>${esc(m.decision_needed)}</strong></div>
        </div>
      </div>
      <div class="detail-pane" data-pane="progress">
        <div class="dense-columns">
          <section><h4 class="section-title">关键节点</h4>${milestones || '<p class="helper-text">暂无里程碑。</p>'}</section>
          <section><h4 class="section-title">主要风险</h4>${risks || '<p class="helper-text">暂无风险。</p>'}</section>
          <section><h4 class="section-title">事件与事实</h4><div class="ev-list">${events || '<p class="helper-text">暂无事件。</p>'}</div><section class="fact-block confirmed"><ul>${facts || '<li>暂无</li>'}</ul></section></section>
          <section><h4 class="section-title">相关人员</h4><div class="chip-block">${parts || '<p class="helper-text">暂无相关人员。</p>'}</div></section>
        </div>
      </div>
      <div class="detail-pane" data-pane="records">
        <h4 class="section-title">${icon('cards')}相关回合</h4>
        ${rounds || '<p class="helper-text">该项目下暂无回合。</p>'}
        <section class="inline-editor">
          <label>补充项目事实 / 事件</label>
          <textarea id="matterFactInput" placeholder="例如：客户今天又追加了一项验收材料。"></textarea>
          <div class="ai-tools"><button class="secondary-button" data-matter-add type="button">写入事实</button><button class="primary-button" data-matter-sim type="button">模拟AI建议</button></div>
          ${sug}
        </section>
      </div>`;
    bindDetailTabs($('matterDetail'));
    $('matterEditForm').addEventListener('submit', event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const stageId = String(values.get('stage_id') || '');
      const stageIndex = DATA.stages.findIndex(item => item.id === stageId);
      m.name = String(values.get('name') || '').trim() || m.name;
      m.kind = String(values.get('kind') || m.kind);
      m.status = String(values.get('status') || '').trim();
      m.stage_index = stageIndex >= 0 ? stageIndex + 1 : m.stage_index;
      m.stage = DATA.stages[stageIndex]?.name || m.stage;
      m.main_conflict = String(values.get('main_conflict') || '').trim();
      m.current_goal = String(values.get('current_goal') || '').trim();
      m.decision_needed = String(values.get('decision_needed') || '').trim();
      DATA.people.forEach(personItem => {
        const checkbox = $('matterEditForm').querySelector(`[data-link-person="${personItem.id}"]`);
        const roleInput = $('matterEditForm').querySelector(`[data-link-role="${personItem.id}"]`);
        const checked = checkbox.checked || personItem.id === p.id;
        if (checked) {
          MODEL.upsertPersonMatterLink(DATA, personItem.id, m.id, roleInput.value.trim() || '相关人员');
          ensureSession(personItem.id, m.id);
          state.currentMatterByPerson[personItem.id] ||= m.id;
        } else {
          const otherMatterIds = matterIdsForPerson(personItem.id).filter(id => id !== m.id);
          // 每个人至少保留一个项目，避免切换人物后失去决策上下文。
          if (otherMatterIds.length) {
            MODEL.removePersonMatterLink(DATA, personItem.id, m.id);
            if (state.currentMatterByPerson[personItem.id] === m.id) {
              state.currentMatterByPerson[personItem.id] = otherMatterIds[0];
            }
          }
        }
      });
      persistState();
      renderTop();
      renderMatterDetail();
    });
    $$('[data-matter-switch2]', $('matterDetail')).forEach(b => b.addEventListener('click', () => { switchMatter(b.dataset.matterSwitch2); renderMatterDetail(); }));
    const mi = $('matterFactInput');
    if (mi) {
      $('matterDetail').querySelector('[data-matter-add]').addEventListener('click', () => { const v = mi.value.trim(); if (v) { m.facts.push(v); state._matterSuggestion = ''; persistState(); renderMatterDetail(); } });
      $('matterDetail').querySelector('[data-matter-sim]').addEventListener('click', async () => {
        const aiClient = createConfiguredAiClient();
        const fallback = `（模拟分析）建议补充风险：该项目临近“${m.stage}”阶段，疑似存在责任边界不清的隐患，可新增一条中等级风险并更新里程碑责任人。`;
        if (aiClient) {
          state._matterSuggestion = 'AI 正在分析……';
          renderMatterDetail();
          const result = await AI_ENGINE.quickAnalysis({
            systemPrompt: '你是关系决策牌组的事项分析助手。基于事项阶段、状态、矛盾、目标、已有事实和风险，输出 1-2 条简短的"可补充风险/事实"建议。每条不超过 30 字。',
            userPrompt: `事项: ${m.name} (${matterKindName(m.kind)})\n阶段: ${m.stage}\n主要矛盾: ${m.main_conflict}\n目标: ${m.current_goal || ''}\n事实: ${(m.facts || []).slice(-3).join('；')}\n风险: ${(m.risks || []).slice(-3).map(r => r.name || r).join('、')}`,
            aiClient,
            fallback
          });
          state._matterSuggestion = result.source === 'ai' ? result.text : `（本地兜底）${result.text}`;
        } else {
          state._matterSuggestion = fallback;
        }
        renderMatterDetail();
      });
      const cf = $('matterDetail').querySelector('[data-matter-confirm]'); if (cf) cf.addEventListener('click', () => { m.facts.push(state._matterSuggestion); state._matterSuggestion = ''; persistState(); renderMatterDetail(); });
      const ds = $('matterDetail').querySelector('[data-matter-discard]'); if (ds) ds.addEventListener('click', () => { state._matterSuggestion = ''; renderMatterDetail(); });
    }
  }

  function bindDetailTabs(root) {
    $$('[data-tab]', root).forEach(b => b.addEventListener('click', () => {
      $$('[data-tab]', root).forEach(x => x.classList.toggle('active', x === b));
      $$('[data-pane]', root).forEach(x => x.classList.toggle('active', x.dataset.pane === b.dataset.tab));
    }));
  }

  function switchPerson(d) {
    const idx = DATA.people.findIndex(p => p.id === state.currentPersonId);
    state.currentPersonId = DATA.people[(idx + d + DATA.people.length) % DATA.people.length].id;
    state.justDealt = true; renderAll();
  }
  function switchMatter(mId) {
    if (!DATA.matters.some(m => m.id === mId)) return;
    state.currentMatterByPerson[state.currentPersonId] = mId;
    state.justDealt = true; renderAll();
  }

  function showDataStatus(message, isError = false) {
    const status = $('dataStatus');
    status.textContent = message;
    status.classList.toggle('error', isError);
  }

  function readAiConfigForm() {
    return {
      baseUrl: $('aiBaseUrl').value.trim(),
      model: $('aiModel').value.trim(),
      apiKey: $('aiApiKey').value.trim() || state.aiConfig.apiKey || '',
      enabled: $('aiEnabled').checked,
      rememberKey: $('aiRememberKey').checked
    };
  }

  function showAiStatus(message, isError = false) {
    $('aiStatus').textContent = message;
    $('aiStatus').classList.toggle('error', isError);
  }

  function openAiSettings() {
    const config = state.aiConfig;
    $('aiBaseUrl').value = config.baseUrl || 'https://api.openai.com/v1';
    $('aiModel').value = config.model || '';
    $('aiApiKey').value = config.apiKey || '';
    $('aiEnabled').checked = Boolean(config.enabled);
    $('aiRememberKey').checked = Boolean(config.rememberKey);
    showAiStatus(config.enabled ? '真实 AI 接口已启用。原型规则仍作为失败回退。' : '当前使用本地原型规则。');
    openModal('aiModal');
  }

  function openAiLog() {
    renderAiLog();
    openModal('aiLogModal');
  }

  function renderAiLog() {
    const LOG = window.RelationshipAILog;
    const list = LOG ? LOG.getAll() : [];
    const countEl = $('aiLogCount');
    const listEl = $('aiLogList');
    if (countEl) countEl.textContent = `${list.length} 条`;
    if (!listEl) return;
    if (!list.length) {
      listEl.innerHTML = '<p class="helper-text">暂无 AI 调用记录。配置好 AI 后任意切换场景即可在这里看到。</p>';
      return;
    }
    listEl.innerHTML = list.map(e => {
      const status = e.source === 'ai' ? 'ai' : 'local';
      const kindPill = e.kind ? `<span class="ai-log-pill kind">${esc(e.kind)}</span>` : '';
      const meta = [e.ts, e.model, e.duration ? `${e.duration}ms` : ''].filter(Boolean).join(' · ');
      const summary = e.responseSummary || e.error || '—';
      const promptShort = e.promptSummary || '(无 prompt)';
      const errorBlock = e.error ? `<div class="ai-log-error">⚠ ${esc(e.error)}</div>` : '';
      const metaBlock = e.meta ? `<span class="ai-log-summary">▸ ${esc(e.meta)}</span>` : '';
      return `<div class="ai-log-item ai-log-${status}">
        <div class="ai-log-head">
          <span class="ai-log-pill ${status}">${status === 'ai' ? 'AI 成功' : '本地兜底'}</span>
          ${kindPill}
          <span>${esc(meta)}</span>
        </div>
        <div class="ai-log-summary">${esc(summary)}</div>
        ${metaBlock}
        ${errorBlock}
        <button class="ai-log-toggle" data-log-expand="${esc(e.id)}">展开 prompt 摘要 ▾</button>
        <div class="ai-log-detail" data-log-detail="${esc(e.id)}" hidden>${esc(promptShort)}${e.responseSummary ? '\n\n[response] ' + esc(e.responseSummary) : ''}</div>
      </div>`;
    }).join('');
    $$('[data-log-expand]', listEl).forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.logExpand;
        const detail = listEl.querySelector(`[data-log-detail="${id}"]`);
        if (!detail) return;
        const hidden = detail.hasAttribute('hidden');
        if (hidden) {
          detail.removeAttribute('hidden');
          btn.textContent = '收起 ▴';
        } else {
          detail.setAttribute('hidden', '');
          btn.textContent = '展开 prompt 摘要 ▾';
        }
      });
    });
  }

  async function testAiConnection() {
    if (!AI) return showAiStatus('AI 客户端未加载。', true);
    const button = $('testAiButton');
    button.disabled = true;
    showAiStatus('正在连接模型列表……');
    try {
      const config = readAiConfigForm();
      const models = await AI.createOpenAICompatibleClient(config).listModels();
      const matched = models.some(item => item.id === config.model);
      showAiStatus(`连接成功，接口返回 ${models.length} 个模型${config.model ? `；当前模型${matched ? '可用' : '未在列表中，请核对名称'}` : ''}。`, !matched && Boolean(config.model));
    } catch (error) {
      showAiStatus(`连接失败：${error.message}。若为浏览器 CORS 错误，需要服务商允许跨域或后续增加代理。`, true);
    } finally {
      button.disabled = false;
    }
  }

  async function probeAiDeal() {
    if (!AI) return showAiStatus('AI 客户端未加载。', true);
    if (!AI_ENGINE) return showAiStatus('AI 引擎未加载。', true);
    const button = $('probeAiButton');
    button.disabled = true;
    showAiStatus('正在用当前场景试发一张牌……');
    try {
      const config = readAiConfigForm();
      if (!config.baseUrl || !config.model || !config.apiKey || !config.enabled) {
        showAiStatus('请先填写 Base URL / 模型 / Key，并勾选"启用真实 AI 接口"。', true);
        return;
      }
      const scene = session().current.opponent || customScene('hypothesis', '请帮我把问题想清楚', '试发场景');
      const aiClient = AI.createOpenAICompatibleClient(config);
      const fallback = scene.hand_plan || genericPlan() || { axis: '本地兜底', coverage: '', candidates: [] };
      const result = await AI_ENGINE.generateHandPlan({
        person: person(),
        matter: matter(),
        scene,
        history: [],
        aiClient,
        fallback
      });
      if (result.source === 'ai') {
        const ranks = result.plan.candidates.map(c => c.rank).join(' / ');
        showAiStatus(`✓ 试发成功：${result.plan.candidates.length} 张牌（rank：${ranks}）。关闭弹窗后切换场景即可看到 AI 实时生成。`);
      } else {
        showAiStatus(`× 试发失败：${result.reason || '未知原因'}`, true);
      }
    } catch (error) {
      showAiStatus(`× 试发异常：${error.message}`, true);
    } finally {
      button.disabled = false;
    }
  }

  function exportData() {
    const snapshot = STORAGE.createSnapshot(state, DATA);
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AI嘴替卡-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showDataStatus('数据文件已导出。请妥善保存，之后可在任意浏览器中导入。');
  }

  async function importData(file) {
    if (!file) return;
    try {
      const snapshot = STORAGE.parseSnapshot(await file.text());
      STORAGE.saveSnapshot(window.localStorage, snapshot.state, snapshot.data);
      showDataStatus('导入成功，正在载入保存的进度……');
      window.setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      showDataStatus(`导入失败：${error.message}`, true);
    } finally {
      $('importDataInput').value = '';
    }
  }

  function bind() {
    $('prevPersonButton').addEventListener('click', () => switchPerson(-1));
    $('nextPersonButton').addEventListener('click', () => switchPerson(1));
    $('personButton').addEventListener('click', () => { renderPersonDetail(); openModal('personModal'); });
    $('matterButton').addEventListener('click', openMatterDetail);
    $('opponentDeckButton').addEventListener('click', openOpponentDeck);
    $$('[data-previous-card]').forEach(button => button.addEventListener('click', () => openPreviousCard(button.dataset.previousCard)));
    $('currentOpponentSlot').addEventListener('click', event => {
      if (!event.target.closest('[data-flip]')) openCurrentCard('opponent');
    });
    $('currentPlayerSlot').addEventListener('click', event => {
      if (!event.target.closest('[data-flip]')) openCurrentCard('player');
    });
    $('historyButton').addEventListener('click', () => { renderHistory(); openModal('historyModal'); });
    $('aiButton').addEventListener('click', openAiSettings);
    $('aiLogButton').addEventListener('click', openAiLog);
    $('aiLogClear').addEventListener('click', () => {
      if (window.RelationshipAILog) window.RelationshipAILog.clear();
      renderAiLog();
    });
    if (window.RelationshipAILog) window.RelationshipAILog.subscribe(renderAiLog);
    $('aiConfigForm').addEventListener('submit', event => {
      event.preventDefault();
      state.aiConfig = readAiConfigForm();
      persistState();
      showAiStatus('AI 设置已保存。导出数据时不会包含 API Key。');
      const currentScene = session().current.opponent;
      if (currentScene && aiEngaged()) {
        refillHandPlanWithAi(currentScene);
      }
    });
    $('testAiButton').addEventListener('click', testAiConnection);
    $('probeAiButton').addEventListener('click', probeAiDeal);
    const openPack = () => { $('packSearch').value = ''; state.packSearch = ''; renderPack(); openModal('packModal'); };
    $('packSpineButton').addEventListener('click', openPack);
    $('archiveHistoryButton').addEventListener('click', () => { renderHistory(); openModal('historyModal'); });
    $('dataButton').addEventListener('click', () => { showDataStatus('浏览器会在人物、事项、回合或卡包变化后自动保存。'); openModal('dataModal'); });
    $('exportDataButton').addEventListener('click', exportData);
    $('importDataButton').addEventListener('click', () => $('importDataInput').click());
    $('importDataInput').addEventListener('change', e => importData(e.target.files[0]));
    $('packSearch').addEventListener('input', e => { state.packSearch = e.target.value; renderPack(); });
    $$('[data-source]').forEach(b => b.addEventListener('click', () => {
      $$('[data-source]').forEach(x => x.classList.toggle('active', x === b));
      $$('.source-panel').forEach(x => x.classList.remove('active'));
      $(`source${b.dataset.source[0].toUpperCase() + b.dataset.source.slice(1)}`).classList.add('active');
    }));
    $('createRealButton').addEventListener('click', () => { const v = $('realSceneInput').value.trim(); if (v) playNewScene(customScene('real', v, '对方实际回复')); });
    $('createQuestionButton').addEventListener('click', () => { const v = $('questionSceneInput').value.trim(); if (v) playNewScene(customScene('hypothesis', v, '我担心对方会问')); });
    $('createSimulationButton').addEventListener('click', () => playNewScene(buildSimulationScene()));
    $$('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
    $$('.modal-backdrop').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); }));
    $('handViewport').addEventListener('wheel', e => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        const cards = $$('.hand-card'); if (!cards.length) return;
        state.handFocus = Math.max(0, Math.min(cards.length - 1, (state.handFocus < 0 ? 0 : state.handFocus) + (e.deltaY > 0 ? 1 : -1)));
        layoutHand(state.handFocus);
      }
    }, { passive: false });
  }

  // ---------- 桌面风格（PNG 已废弃，stage-fx 主导） ----------
  function setBackgroundLayer({ animate = true } = {}) {
    const layer = $('bgLayer');
    if (!layer || !BG) return;
    // V0.9 阶段：style 切换由 stage-fx 桌面场景承载, .bg-layer 显示 minimax 生成纹理作远景
    const entry = BG.getCurrent();
    if (!entry) return;
    // 优先用 textureUrl (新格式, minimax 生成), 回退 file (旧格式)
    const url = entry.textureUrl
      ? entry.textureUrl
      : (entry.file ? `assets/backgrounds/${entry.file}` : null);
    if (!url) {
      layer.style.backgroundImage = '';
      return;
    }
    if (!animate) {
      layer.style.backgroundImage = `url(${url})`;
      document.body.classList.add('bg-ready');
      return;
    }
    document.body.classList.add('bg-fading');
    window.setTimeout(() => {
      layer.style.backgroundImage = `url(${url})`;
      document.body.classList.remove('bg-fading');
    }, 400);
  }

  function renderThemeModal() {
    if (!BG) return;
    const grid = $('themeGrid');
    const status = $('themeStatus');
    if (!grid) return;
    const manifest = BG.getManifest() || { styles: [] };
    const list = manifest.styles || manifest.backgrounds || [];
    const current = BG.getCurrentId();
    if (!list.length) {
      grid.innerHTML = '<p class="data-status">暂无可用桌面风格。</p>';
      if (status) status.textContent = '';
      return;
    }
    grid.innerHTML = list.map(entry => {
      const accent = entry.accentColor || '#7da3ff';
      // 新 swatch: 用 minimax 纹理作背景(若 textureUrl), + accent 渐变叠加 + 顶部高亮条
      const textureUrl = entry.textureUrl || null;
      const swatchStyle = textureUrl
        ? `background-image:linear-gradient(180deg, ${esc(accent)}33 0%, transparent 30%, transparent 70%, ${esc(accent)}22 100%), url(${esc(textureUrl)});background-size:cover, cover;background-position:center, center;`
        : `background:radial-gradient(circle at 50% 50%, ${esc(accent)} 0%, ${esc(accent)}66 60%, ${esc(accent)}11 100%);`;
      const meta = [entry.mood, entry.recommendedFor && entry.recommendedFor.join('/')].filter(Boolean).join(' · ');
      const active = entry.id === current ? 'active' : '';
      return `<button class="theme-card ${active}" type="button" data-theme-id="${esc(entry.id)}" style="--theme-accent:${esc(accent)}">
        <span class="theme-card-swatch" style="${swatchStyle}"></span>
        <span class="theme-card-title">${esc(entry.title || entry.id)}</span>
        <span class="theme-card-meta">${esc(meta || entry.id)}</span>
      </button>`;
    }).join('');
    grid.querySelectorAll('[data-theme-id]').forEach(card => {
      card.addEventListener('click', () => {
        BG.setCurrentId(card.dataset.themeId);
      });
    });
  }

  function syncThemeModalOnSwitch() {
    const modal = $('themeModal');
    if (modal && !modal.hidden) renderThemeModal();
  }

  function openThemeSettings() {
    renderThemeModal();
    syncMotionLevelButtons();
    openModal('themeModal');
  }

  function syncMotionLevelButtons() {
    const prefs = window.RelationshipMotionPreferences;
    if (!prefs) return;
    const current = prefs.getEffectiveMotionLevel();
    $$('.motion-level-btn').forEach(btn => {
      const isActive = btn.dataset.motionLevel === current;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });
  }

  function bindMotionLevelButtons() {
    const prefs = window.RelationshipMotionPreferences;
    if (!prefs) return;
    $$('.motion-level-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        prefs.setMotionLevel(btn.dataset.motionLevel);
        syncMotionLevelButtons();
      });
    });
  }

  function announceBackgroundSwitch(prevId, nextId) {
    const status = $('themeStatus');
    if (!status || !BG) return;
    const next = BG.getCurrent();
    const title = next && (next.title || next.id);
    const list = BG.getManifest().styles || BG.getManifest().backgrounds || [];
    const prevEntry = list.find(b => b.id === prevId);
    const prevTitle = prevEntry ? (prevEntry.title || prevEntry.id) : (prevId ? prevId : '初始');
    status.textContent = `已切换：${prevTitle} → ${title || nextId}`;
  }

  async function initBackgrounds() {
    if (!BG) return;
    const manifest = await BG.loadManifest();
    BG.applyManifest(manifest);
    BG.subscribe((prevId, nextId) => {
      setBackgroundLayer();
      // 桌面风格切换 → 派发 rdc:scene-change 让 stage-fx 切换桌面预设
      window.dispatchEvent(new CustomEvent('rdc:scene-change', { detail: { presetId: nextId } }));
      announceBackgroundSwitch(prevId, nextId);
      syncThemeModalOnSwitch();
    });
    setBackgroundLayer({ animate: false });
    // 激活 3 个区域背景(对方 / 战场 / 手牌)
    document.body.classList.add('bg-battlefield', 'bg-opponent', 'bg-hand');
    if ($('themeButton')) $('themeButton').addEventListener('click', openThemeSettings);
    if ($('themePrevButton')) $('themePrevButton').addEventListener('click', () => BG.cyclePrevId());
    if ($('themeNextButton')) $('themeNextButton').addEventListener('click', () => BG.cycleNextId());
    bindMotionLevelButtons();
  }

  renderAll();
  bind();
  initBackgrounds();
  // 启动时派发初始场景，让 stage-fx 切到对应预设
  try {
    const initialOpp = session() && session().current && session().current.opponent;
    if (initialOpp && initialOpp.scene_type) {
      dispatchSceneChange({ sceneType: initialOpp.scene_type });
    } else {
      dispatchSceneChange({ sceneType: 'meeting' });
    }
  } catch (error) { /* 静默降级 */ }
})();
