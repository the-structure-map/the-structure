// Cytoscape.js is loaded as a global from vendor/cytoscape.min.js

export const LAYER_COLORS = {
  1: '#C87941',
  2: '#4A8FA8',
  3: '#7A6FA8',
  4: '#A86A6A',
  5: '#5A7A8A'
};

const LAYER_Y = { 1: 80, 2: 240, 3: 400, 4: 560, 5: 720 };

let cy = null;
let _graphData = null;

// --- Color helpers ---

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = hue(h + 1 / 3);
    g = hue(h);
    b = hue(h - 1 / 3);
  }
  const hex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function brighten(hex, amount) {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.min(100, l + amount));
}

// --- Element construction ---

function buildElements(data, lang) {
  const elements = [];

  for (const node of data.nodes) {
    const base = LAYER_COLORS[node.layer];
    elements.push({
      group: 'nodes',
      data: {
        id: node.id,
        label: node[`label_${lang}`],
        label_analytical: node.label_analytical,
        label_experiential: node.label_experiential,
        layer: node.layer,
        layer_name: node.layer_name,
        layerColor: base,
        layerColorBright: brighten(base, 15),
        affected_groups: node.affected_groups,
        upstream_causes: node.upstream_causes,
        downstream_effects: node.downstream_effects,
        solidarity_connections: node.solidarity_connections
      }
    });
  }

  for (const edge of data.edges) {
    elements.push({
      group: 'edges',
      data: { id: edge.id, source: edge.source, target: edge.target, type: edge.type }
    });
  }

  return elements;
}

// --- Cytoscape style ---

function buildStyles() {
  return [
    {
      selector: 'node',
      style: {
        shape: 'roundrectangle',
        width: 'label',
        height: 'label',
        padding: '12px',
        label: 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'wrap',
        'text-max-width': '140px',
        'font-family': 'IBM Plex Sans, system-ui, sans-serif',
        'font-size': '12px',
        'font-weight': '500',
        color: '#E8E8E8',
        'background-color': 'data(layerColor)',
        'border-width': 0,
        'min-zoomed-font-size': 6
      }
    },
    {
      selector: 'edge[type = "causal"]',
      style: {
        width: 1.5,
        'line-color': '#3A3F4D',
        'target-arrow-color': '#3A3F4D',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 1.2,
        'curve-style': 'bezier',
        opacity: 0.8
      }
    },
    {
      selector: 'edge[type = "feedback"]',
      style: {
        width: 2,
        'line-color': '#C87941',
        'target-arrow-color': '#C87941',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 1.2,
        'curve-style': 'unbundled-bezier',
        'control-point-distances': [-80],
        'control-point-weights': [0.5],
        'line-style': 'dashed',
        'line-dash-pattern': [8, 4],
        opacity: 0.9
      }
    },
    {
      selector: 'edge[type = "solidarity"]',
      style: {
        width: 1.5,
        'line-color': '#4A8FA8',
        'line-style': 'dashed',
        'line-dash-pattern': [4, 6],
        'curve-style': 'bezier',
        'target-arrow-shape': 'none',
        'source-arrow-shape': 'none',
        opacity: 0.6
      }
    },
    {
      selector: 'node.hover',
      style: {
        'border-width': 2,
        'border-color': '#E8B84B',
        'background-color': 'data(layerColorBright)',
        'z-index': 10
      }
    },
    {
      selector: 'node.graph-cursor',
      style: {
        'border-width': 3,
        'border-color': '#E8B84B',
        'background-color': 'data(layerColorBright)',
        'overlay-color': '#E8B84B',
        'overlay-padding': 8,
        'overlay-opacity': 0.18,
        'z-index': 30
      }
    },
    {
      selector: 'node.selected',
      style: {
        'border-width': 3,
        'border-color': '#E8B84B',
        'background-color': 'data(layerColorBright)',
        'z-index': 20
      }
    },
    {
      selector: 'node.dimmed',
      style: { opacity: 0.3 }
    },
    {
      selector: 'edge.dimmed',
      style: { opacity: 0.1 }
    },
    {
      selector: 'edge.highlighted',
      style: {
        'line-color': '#6A7A8A',
        'target-arrow-color': '#6A7A8A',
        opacity: 1,
        width: 2.5
      }
    },
    {
      selector: 'node.also-look-at',
      style: {
        'border-width': 1,
        'border-color': '#6A7A8A',
        'border-style': 'dashed',
        opacity: 0.7
      }
    }
  ];
}

// --- Public API ---

export function initGraph(data, lang) {
  _graphData = data;

  const roots = data.nodes
    .filter(n => n.layer === 1)
    .map(n => '#' + n.id);

  const layout = {
    name: 'breadthfirst',
    directed: true,
    roots,
    padding: 40,
    spacingFactor: 1.75,
    avoidOverlap: true,
    nodeDimensionsIncludeLabels: true,
    animate: false,
    fit: true,
    circle: false,
    grid: false
  };

  cy = cytoscape({
    container: document.getElementById('cy'),
    elements: buildElements(data, lang),
    style: buildStyles(),
    layout,
    minZoom: 0.3,
    maxZoom: 3.0,
    wheelSensitivity: 3.5,
    boxSelectionEnabled: false,
    autoungrabify: true,
    userZoomingEnabled: true,
    userPanningEnabled: true
  });

  // Snap each node to its layer's fixed y-coordinate
  cy.batch(() => {
    cy.nodes().forEach(node => {
      node.position('y', LAYER_Y[node.data('layer')]);
    });
  });

  // Per-layer x-redistribution — corrects diagonal cascade from breadthfirst
  const NODE_SPACING = 220;

  const byLayer = {};
  cy.nodes().forEach(n => {
    const l = n.data('layer');
    if (!byLayer[l]) byLayer[l] = [];
    byLayer[l].push(n);
  });

  cy.batch(() => {
    for (const nodes of Object.values(byLayer)) {
      nodes.sort((a, b) => a.position().x - b.position().x);
      const n = nodes.length;
      const totalWidth = (n - 1) * NODE_SPACING;
      nodes.forEach((node, i) => {
        node.position('x', -totalWidth / 2 + i * NODE_SPACING);
      });
    }
  });

  cy.fit(undefined, window.innerWidth < 900 ? 20 : 40);

  return cy;
}

export function getCy() {
  return cy;
}

export function getGraphData() {
  return _graphData;
}

export function updateAllNodeLabels(lang) {
  if (!cy) return;
  cy.batch(() => {
    cy.nodes().forEach(node => {
      node.data('label', node.data(`label_${lang}`));
    });
  });
}

document.addEventListener('languagechange', (e) => {
  updateAllNodeLabels(e.detail.language);
});
