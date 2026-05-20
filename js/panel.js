import { getCy, getGraphData, LAYER_COLORS } from './graph.js';
import { renderMarkdown } from './markdown.js';

let _currentNodeId = null;
let _currentLoopId = null;
let _panelOpen = false;

function isMobile() {
  return window.innerWidth < 900;
}

function getContentContainer() {
  return isMobile()
    ? document.getElementById('mobile-sheet-content')
    : document.getElementById('panel-content');
}

export function isPanelOpen() {
  return _panelOpen;
}

export function openLoopPanel(loopId, lang) {
  _currentNodeId = null;
  _currentLoopId = loopId;
  _panelOpen = true;

  renderLoopPanel(loopId, lang);

  if (isMobile()) {
    const sheet = document.getElementById('mobile-sheet');
    sheet.removeAttribute('hidden');
    sheet.getBoundingClientRect();
    sheet.classList.remove('expanded');
    sheet.classList.add('open');
  } else {
    const panel = document.getElementById('detail-panel');
    panel.removeAttribute('hidden');
    panel.getBoundingClientRect();
    panel.classList.add('open');
    document.body.classList.add('panel-open');
    requestAnimationFrame(() => {
      const cy = getCy();
      if (cy) cy.resize();
    });
  }
}

export function openPanel(nodeId, lang) {
  _currentNodeId = nodeId;
  _currentLoopId = null;
  _panelOpen = true;

  renderPanel(nodeId, lang);

  if (isMobile()) {
    const sheet = document.getElementById('mobile-sheet');
    sheet.removeAttribute('hidden');
    sheet.getBoundingClientRect();
    sheet.classList.remove('expanded');
    sheet.classList.add('open');
  } else {
    const panel = document.getElementById('detail-panel');
    panel.removeAttribute('hidden');
    panel.getBoundingClientRect();
    panel.classList.add('open');
    document.body.classList.add('panel-open');
    requestAnimationFrame(() => {
      const cy = getCy();
      if (cy) {
        cy.resize();
        cy.center(cy.$('#' + nodeId));
      }
    });
  }
}

export function closePanel() {
  if (!_panelOpen) return;
  _panelOpen = false;
  _currentNodeId = null;
  _currentLoopId = null;

  if (isMobile()) {
    const sheet = document.getElementById('mobile-sheet');
    sheet.classList.remove('open', 'expanded');
    sheet.addEventListener('transitionend', () => {
      sheet.setAttribute('hidden', '');
    }, { once: true });
  } else {
    const panel = document.getElementById('detail-panel');
    panel.classList.remove('open');
    document.body.classList.remove('panel-open');
    panel.addEventListener('transitionend', () => {
      panel.setAttribute('hidden', '');
      const cy = getCy();
      if (cy) cy.resize();
    }, { once: true });
  }
}

export function updatePanelLanguage(lang) {
  if (_currentNodeId) renderPanel(_currentNodeId, lang);
  else if (_currentLoopId) renderLoopPanel(_currentLoopId, lang);
}

function renderPanel(nodeId, lang) {
  const data = getGraphData();
  const node = data.nodes.find(n => n.id === nodeId);
  if (!node) return;

  const layerColor = LAYER_COLORS[node.layer];
  const label = node[`label_${lang}`];
  const body = node[`body_${lang}`];

  let html = '';

  // 1. Layer badge
  html += `<div class="panel-layer-badge" style="background-color:${layerColor}33;color:${layerColor}">Layer ${node.layer} — ${esc(node.layer_name)}</div>`;

  // 2. Node ID
  html += `<span class="panel-node-id">${esc(node.id)}</span>`;

  // 3. Node label (also provides aria-labelledby target)
  html += `<h1 class="panel-node-label" id="panel-node-label">${esc(label)}</h1>`;

  // 4. Affected groups
  if (node.affected_groups) {
    html += `<p class="panel-affected-groups">${esc(node.affected_groups)}</p>`;
  }

  // 5. Divider
  html += `<hr class="panel-rule">`;

  // 6. Body content
  html += `<div class="panel-body">${renderMarkdown(body)}</div>`;

  // 7. Upstream Causes
  if (node.upstream_causes.length > 0) {
    const heading = lang === 'analytical' ? 'Upstream Causes' : 'What brought you here';
    html += buildLinkSection(heading, node.upstream_causes, data, lang);
  }

  // 8. This Leads To
  if (node.downstream_effects.length > 0) {
    html += buildLinkSection('This Leads To', node.downstream_effects, data, lang);
  }

  // 9. Solidarity Connections
  if (node.solidarity_connections && node.solidarity_connections.length > 0) {
    const heading = lang === 'analytical' ? 'Solidarity Connections' : 'Who else is here';
    html += buildLinkSection(heading, node.solidarity_connections, data, lang);
  }

  getContentContainer().innerHTML = html;
}

function renderLoopPanel(loopId, lang) {
  const data = getGraphData();
  const loop = data.feedback_loops.find(l => l.id === loopId);
  if (!loop) return;

  const name = lang === 'analytical' ? loop.name_analytical : loop.name_experiential;
  const desc = lang === 'analytical' ? loop.description_analytical : loop.description_experiential;

  let html = '';

  html += `<div class="panel-layer-badge" style="background-color:#C8794133;color:#C87941">Feedback Loop</div>`;
  html += `<h1 class="panel-node-label" id="panel-node-label">${esc(name)}</h1>`;
  html += `<hr class="panel-rule">`;

  // Node sequence as linked buttons (deduplicated, in sequence order)
  const seen = new Set();
  const uniqueNodes = loop.node_sequence.filter(id => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  html += buildLinkSection('Loop Sequence', uniqueNodes, data, lang);

  html += `<div class="panel-body">${renderMarkdown(desc)}</div>`;

  if (loop.historical_note) {
    html += `<div class="panel-section">`;
    html += `<p class="panel-section-heading">Historical Note</p>`;
    html += `<div class="panel-body">${renderMarkdown(loop.historical_note)}</div>`;
    html += `</div>`;
  }

  getContentContainer().innerHTML = html;
}

function buildLinkSection(heading, nodeIds, data, lang) {
  let html = `<div class="panel-section"><p class="panel-section-heading">${esc(heading)}</p><div class="panel-node-links">`;
  for (const id of nodeIds) {
    const n = data.nodes.find(x => x.id === id);
    if (n) {
      html += `<button class="panel-node-link" data-node-id="${id}">${esc(id)} — ${esc(n[`label_${lang}`])}</button>`;
    }
  }
  html += `</div></div>`;
  return html;
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('languagechange', (e) => {
  if (isPanelOpen()) updatePanelLanguage(e.detail.language);
});
