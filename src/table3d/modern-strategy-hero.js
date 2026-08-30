const g = window;

function byId(id) { return document.getElementById(id); }
function textOf(id) { return (byId(id)?.textContent || '').trim(); }

const stage = document.querySelector('.table3d-stage');
const originalContext = document.querySelector('.current-context');
if (!stage || !originalContext) throw new Error('Modern Strategy hero: context mount missing');

if (!document.getElementById('tableHeroPlate')) {
  const plate = document.createElement('section');
  plate.id = 'tableHeroPlate';
  plate.className = 'table-hero-plate';
  plate.setAttribute('aria-label', '当前沟通对象和项目');
  plate.innerHTML = `
    <div class="table-hero-person-row">
      <button class="table-hero-nav table-hero-prev" type="button" aria-label="上一位人物">‹</button>
      <button class="table-hero-person" type="button" aria-label="查看人物详情">
        <span class="table-hero-avatar" aria-hidden="true"></span>
        <span class="table-hero-copy">
          <strong class="table-hero-name"></strong>
          <small class="table-hero-meta"></small>
        </span>
      </button>
      <button class="table-hero-nav table-hero-next" type="button" aria-label="下一位人物">›</button>
    </div>
    <button class="table-hero-matter" type="button" aria-label="查看当前项目">
      <span class="table-hero-matter-name"></span>
      <small class="table-hero-matter-meta"></small>
    </button>
  `;
  stage.appendChild(plate);

  const avatar = plate.querySelector('.table-hero-avatar');
  const name = plate.querySelector('.table-hero-name');
  const meta = plate.querySelector('.table-hero-meta');
  const matterName = plate.querySelector('.table-hero-matter-name');
  const matterMeta = plate.querySelector('.table-hero-matter-meta');

  function sync() {
    avatar.textContent = textOf('heroAvatar') || '人';
    name.textContent = textOf('heroName') || '当前人物';
    const role = textOf('heroMeta');
    const type = textOf('heroType');
    meta.textContent = role || type || '重要关系';
    matterName.textContent = textOf('matterName') || '当前项目';
    matterMeta.textContent = textOf('matterMeta') || '';

    const mood = `${role} ${type}`;
    plate.dataset.mood = /急|紧|风险|冲突/.test(mood)
      ? 'focused'
      : /疲|谨慎|慢/.test(mood)
        ? 'careful'
        : 'neutral';
  }

  plate.querySelector('.table-hero-prev').addEventListener('click', () => byId('prevPersonButton')?.click());
  plate.querySelector('.table-hero-next').addEventListener('click', () => byId('nextPersonButton')?.click());
  plate.querySelector('.table-hero-person').addEventListener('click', () => byId('personButton')?.click());
  plate.querySelector('.table-hero-matter').addEventListener('click', () => byId('matterButton')?.click());

  const observed = ['heroAvatar', 'heroName', 'heroMeta', 'heroType', 'matterName', 'matterMeta']
    .map(byId)
    .filter(Boolean);
  const observer = new MutationObserver(sync);
  observed.forEach(node => observer.observe(node, { subtree: true, childList: true, characterData: true }));
  sync();

  document.body.classList.add('table-hero-ready');
}

export const modernStrategyHeroInstalled = true;
