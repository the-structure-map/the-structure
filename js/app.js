import { initGraph, LAYER_COLORS } from './graph.js';
import { initLanguage, getLanguage } from './toggle.js';
import { initInteractions, syncToggleUI } from './interactions.js';
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

  renderLayerLegend(graphData);

  const footer = document.getElementById('footer-version');
  if (footer && graphData.meta) {
    footer.textContent = `v${graphData.meta.version} · ${graphData.meta.last_updated}`;
  }
}

function renderLayerLegend(graphData) {
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
  const { nodes = [], edges = [], feedback_loops = [], solidarity_map = [], find_your_pain = [] } = d;

  const nodeIds = new Set();
  for (const n of nodes) {
    if (nodeIds.has(n.id)) warn('Duplicate node ID', n.id);
    nodeIds.add(n.id);
  }

  const edgeIds = new Set();
  for (const e of edges) {
    if (edgeIds.has(e.id)) warn('Duplicate edge ID', e.id);
    edgeIds.add(e.id);
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

  for (const e of edges) {
    if (!nodeIds.has(e.source)) warn(`Unknown edge source in ${e.id}`, e.source);
    if (!nodeIds.has(e.target)) warn(`Unknown edge target in ${e.id}`, e.target);
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
