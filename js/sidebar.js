import { getGraphData, getCy, LAYER_COLORS } from './graph.js';

let _sidebarOpen = false;

export function isSidebarOpen() {
  return _sidebarOpen;
}

export function openSidebar(lang) {
  renderSidebar(lang);

  const sidebar = document.getElementById('fyp-sidebar');
  sidebar.removeAttribute('hidden');
  sidebar.getBoundingClientRect(); // force reflow to trigger transition
  sidebar.classList.add('open');

  _sidebarOpen = true;
  document.body.classList.add('sidebar-open');
  document.getElementById('fyp-trigger').setAttribute('aria-expanded', 'true');

  requestAnimationFrame(() => {
    const cy = getCy();
    if (cy) cy.resize();
  });
}

export function closeSidebar() {
  if (!_sidebarOpen) return;
  _sidebarOpen = false;

  const sidebar = document.getElementById('fyp-sidebar');
  sidebar.classList.remove('open');
  document.body.classList.remove('sidebar-open');
  document.getElementById('fyp-trigger').setAttribute('aria-expanded', 'false');
  document.getElementById('fyp-trigger').focus();

  sidebar.addEventListener('transitionend', () => {
    sidebar.setAttribute('hidden', '');
    const cy = getCy();
    if (cy) cy.resize();
  }, { once: true });
}

export function renderSidebar(lang) {
  const data = getGraphData();
  if (!data) return;

  const isAnalytical = lang === 'analytical';

  document.getElementById('fyp-sidebar-title').textContent = isAnalytical
    ? 'Find Your Entry Point'
    : 'Find Your Pain';

  document.getElementById('fyp-orientation').textContent = isAnalytical
    ? 'Select an entry point by lived experience. Navigation targets the primary node.'
    : 'Find your experience below. Tap any entry to see where you are in the map.';

  const list = document.getElementById('fyp-list');
  list.innerHTML = '';

  for (const entry of data.find_your_pain) {
    const primaryNode = data.nodes.find(n => n.id === entry.primary_node);
    const label = isAnalytical ? entry.label_analytical : entry.label_experiential;
    const primaryLabel = primaryNode
      ? (isAnalytical ? primaryNode.label_analytical : primaryNode.label_experiential)
      : entry.primary_node;

    const li = document.createElement('li');
    li.setAttribute('role', 'listitem');

    const btn = document.createElement('button');
    btn.dataset.primaryNode = entry.primary_node;
    btn.dataset.alsoLookAt = JSON.stringify(entry.also_look_at);

    const primarySpan = document.createElement('span');
    primarySpan.className = 'fyp-primary-label';
    primarySpan.textContent = label;
    btn.appendChild(primarySpan);

    const secondarySpan = document.createElement('span');
    secondarySpan.className = 'fyp-secondary-label';
    secondarySpan.textContent = `→ ${primaryLabel}`;
    btn.appendChild(secondarySpan);

    if (entry.also_look_at.length > 0) {
      const badges = document.createElement('div');
      badges.className = 'fyp-badges';
      for (const nodeId of entry.also_look_at) {
        const n = data.nodes.find(x => x.id === nodeId);
        if (n) {
          const color = LAYER_COLORS[n.layer];
          const nodeLabel = isAnalytical ? n.label_analytical : n.label_experiential;
          const badge = document.createElement('span');
          badge.className = 'fyp-badge';
          badge.textContent = nodeLabel;
          badge.style.backgroundColor = color + '4D'; // ~30% opacity
          badge.style.color = color;
          badges.appendChild(badge);
        }
      }
      btn.appendChild(badges);
    }

    li.appendChild(btn);
    list.appendChild(li);
  }
}

document.addEventListener('languagechange', (e) => {
  if (isSidebarOpen()) renderSidebar(e.detail.language);
});
