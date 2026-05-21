import { initGraph, LAYER_COLORS } from './graph.js';
import { initLanguage, getLanguage } from './toggle.js';
import { initInteractions, syncToggleUI, selectLoop } from './interactions.js';
import './sidebar.js';

const DATA_URL = 'data/graph.json';

async function init() {
  let graphData;
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    graphData = await res.json();
  } catch (err) {
    showLoadError(err.message);
    return;
  }

  validate(graphData);

  const lang = initLanguage(graphData.meta.default_language);
  initGraph(graphData, lang);
  initInteractions();
  syncToggleUI(lang);

  renderLayerLegend(graphData, lang);

  document.addEventListener('languagechange', (e) => {
    updateLoopLegendLabels(graphData, e.detail.language);
  });

  const footer = document.getElementById('footer-version');
  if (footer && graphData.meta) {
    footer.innerHTML = `v${graphData.meta.version} · ${graphData.meta.last_updated} · <a href="https://github.com/the-structure-map/the-structure" target="_blank" rel="noopener noreferrer" aria-label="GitHub" class="footer-github-link"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg></a>`;
  }
}

function renderLayerLegend(graphData, lang) {
  const legend = document.getElementById('layer-legend');
  if (!legend) return;

  // Build unique layer entries ordered 1→5
  const layers = [];
  const seen = new Set();
  for (const node of graphData.nodes) {
    if (!seen.has(node.layer)) {
      seen.add(node.layer);
      layers.push({ layer: node.layer, layer_name: node.layer_name });
    }
  }
  layers.sort((a, b) => a.layer - b.layer);

  legend.innerHTML = '';
  for (const { layer, layer_name } of layers) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.setAttribute('role', 'listitem');

    const swatch = document.createElement('div');
    swatch.className = 'legend-swatch';
    swatch.style.backgroundColor = LAYER_COLORS[layer];

    const label = document.createElement('span');
    label.textContent = `Layer ${layer} — ${layer_name}`;

    item.appendChild(swatch);
    item.appendChild(label);
    legend.appendChild(item);
  }

  // Feedback loop entries
  const loops = graphData.feedback_loops || [];
  if (loops.length > 0) {
    const divider = document.createElement('div');
    divider.className = 'legend-divider';
    divider.setAttribute('role', 'separator');
    legend.appendChild(divider);

    for (const loop of loops) {
      const btn = document.createElement('button');
      btn.className = 'legend-loop-item';
      btn.setAttribute('role', 'listitem');
      btn.dataset.loopId = loop.id;

      const swatch = document.createElement('div');
      swatch.className = 'legend-loop-swatch';

      const label = document.createElement('span');
      label.textContent = lang === 'analytical' ? loop.name_analytical : loop.name_experiential;

      btn.appendChild(swatch);
      btn.appendChild(label);
      btn.addEventListener('click', () => selectLoop(loop.id));
      legend.appendChild(btn);
    }
  }
}

function updateLoopLegendLabels(graphData, lang) {
  const legend = document.getElementById('layer-legend');
  if (!legend) return;
  const loops = graphData.feedback_loops || [];
  for (const loop of loops) {
    const btn = legend.querySelector(`[data-loop-id="${loop.id}"]`);
    if (btn) {
      const label = btn.querySelector('span');
      if (label) label.textContent = lang === 'analytical' ? loop.name_analytical : loop.name_experiential;
    }
  }
}

function showLoadError(msg) {
  const cy = document.getElementById('cy');
  cy.style.cssText = 'display:flex;align-items:center;justify-content:center;color:#E8E8E8;font-family:system-ui;font-size:16px;padding:40px;text-align:center;';
  cy.textContent = `Failed to load graph data: ${msg}`;
}

function warn(msg, val) {
  console.warn(`[The Structure data warning] ${msg}: ${val}`);
}

function validate(d) {
  const { nodes = [], feedback_loops = [], feedback_edges = [], solidarity_map = [], find_your_pain = [] } = d;

  const nodeIds = new Set();
  for (const n of nodes) {
    if (nodeIds.has(n.id)) warn('Duplicate node ID', n.id);
    nodeIds.add(n.id);
  }

  for (const n of nodes) {
    if (![1, 2, 3, 4, 5].includes(n.layer)) warn('Invalid layer', `${n.id} layer=${n.layer}`);
  }

  for (const n of nodes) {
    for (const id of n.upstream_causes) {
      if (!nodeIds.has(id)) warn(`Unknown upstream_causes ID in ${n.id}`, id);
    }
    for (const id of n.downstream_effects) {
      if (!nodeIds.has(id)) warn(`Unknown downstream_effects ID in ${n.id}`, id);
    }
    for (const id of n.solidarity_connections) {
      if (!nodeIds.has(id)) warn(`Unknown solidarity_connections ID in ${n.id}`, id);
    }
    for (const id of (n.amplifies || [])) {
      if (!nodeIds.has(id)) warn(`Unknown amplifies ID in ${n.id}`, id);
    }
  }

  for (const fe of feedback_edges) {
    if (!nodeIds.has(fe.source)) warn('Unknown feedback_edge source', fe.source);
    if (!nodeIds.has(fe.target)) warn('Unknown feedback_edge target', fe.target);
  }

  for (const loop of feedback_loops) {
    for (const id of loop.node_sequence) {
      if (!nodeIds.has(id)) warn(`Unknown node_sequence ID in loop ${loop.id}`, id);
    }
  }

  for (const sm of solidarity_map) {
    for (const id of sm.shared_nodes) {
      if (!nodeIds.has(id)) warn(`Unknown shared_nodes ID in ${sm.id}`, id);
    }
  }

  for (const fyp of find_your_pain) {
    if (!nodeIds.has(fyp.primary_node)) warn(`Unknown primary_node in ${fyp.id}`, fyp.primary_node);
    for (const id of fyp.also_look_at) {
      if (!nodeIds.has(id)) warn(`Unknown also_look_at ID in ${fyp.id}`, id);
    }
  }

  for (const n of nodes) {
    for (const targetId of n.downstream_effects) {
      const target = nodes.find(x => x.id === targetId);
      if (target && !target.upstream_causes.includes(n.id)) {
        warn(`Bidirectional inconsistency: ${n.id}→${targetId} but ${targetId} missing ${n.id} in upstream_causes`, '');
      }
    }
  }
}

init();
