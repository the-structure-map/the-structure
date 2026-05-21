import { getCy, getGraphData } from './graph.js';
import { openPanel, closePanel, isPanelOpen, openLoopPanel } from './panel.js';
import { getLanguage, setLanguage } from './toggle.js';
import { openSidebar, closeSidebar, isSidebarOpen } from './sidebar.js';

let _calloutLoopId = null;
let _closeCalloutListener = null;

// Graph keyboard navigation state
let _graphFocusCursorIdx = -1;
let _graphNodeOrder = [];
let _savedCursorIdx = -1; // cursor position saved when Enter opens a node; restored on panel close

function isMobile() {
  return window.innerWidth < 900;
}

function buildGraphNodeOrder() {
  const cy = getCy();
  const nodes = cy.nodes().toArray();
  nodes.sort((a, b) => {
    if (a.data('layer') !== b.data('layer')) return a.data('layer') - b.data('layer');
    return a.position().x - b.position().x;
  });
  _graphNodeOrder = nodes.map(n => n.id());
}

function setGraphFocusCursor(idx) {
  const cy = getCy();
  if (_graphFocusCursorIdx >= 0 && _graphFocusCursorIdx < _graphNodeOrder.length) {
    cy.$('#' + _graphNodeOrder[_graphFocusCursorIdx]).removeClass('graph-cursor');
  }
  _graphFocusCursorIdx = idx;
  if (idx >= 0 && idx < _graphNodeOrder.length) {
    const nodeId = _graphNodeOrder[idx];
    const node = cy.$('#' + nodeId);
    node.addClass('graph-cursor');
    const pos = node.renderedPosition();
    const margin = 80;
    if (pos.x < margin || pos.x > cy.width() - margin || pos.y < margin || pos.y > cy.height() - margin) {
      cy.animate({ center: { eles: node } }, { duration: 200 });
    }
  }
}

function clearGraphFocusCursor() {
  const cy = getCy();
  if (_graphFocusCursorIdx >= 0 && _graphFocusCursorIdx < _graphNodeOrder.length) {
    cy.$('#' + _graphNodeOrder[_graphFocusCursorIdx]).removeClass('graph-cursor');
  }
  _graphFocusCursorIdx = -1;
}

export function selectLoop(loopId) {
  const cy = getCy();
  const data = getGraphData();
  const loop = data.feedback_loops.find(l => l.id === loopId);
  if (!loop) return;

  clearGraphFocusCursor();
  hideFeedbackCallout();

  const loopNodes = new Set(loop.node_sequence);

  cy.batch(() => {
    cy.elements().removeClass('selected dimmed highlighted highlighted-inbound highlighted-outbound highlighted-solidarity also-look-at loop-member loop-edge hover graph-cursor');
    cy.nodes().addClass('dimmed');
    cy.edges().addClass('dimmed');

    loopNodes.forEach(nodeId => {
      const node = cy.$('#' + nodeId);
      node.removeClass('dimmed').addClass('loop-member');
    });

    // Un-dim and highlight edges where both endpoints are in the loop sequence
    cy.edges().forEach(edge => {
      if (loopNodes.has(edge.data('source')) && loopNodes.has(edge.data('target'))) {
        edge.removeClass('dimmed').addClass('loop-edge');
      }
    });
  });

  openLoopPanel(loopId, getLanguage());
}

export function initInteractions() {
  const cy = getCy();

  // Language toggle buttons
  document.getElementById('toggle-experiential').addEventListener('click', () => {
    setLanguage('experiential');
  });
  document.getElementById('toggle-analytical').addEventListener('click', () => {
    setLanguage('analytical');
  });

  document.addEventListener('languagechange', (e) => {
    updateToggleButtonState(e.detail.language);
    updateHeaderLabels(e.detail.language);
  });

  // Node click
  cy.on('tap', 'node', function(evt) {
    hideFeedbackCallout();
    _savedCursorIdx = -1;
    const node = evt.target;
    if (node.hasClass('selected')) {
      deselectAll();
      closePanel();
    } else {
      selectNode(node.id());
    }
  });

  // Background click
  cy.on('tap', function(evt) {
    if (evt.target === cy) {
      hideFeedbackCallout();
      _savedCursorIdx = -1;
      deselectAll();
      if (isPanelOpen()) closePanel();
    }
  });

  // Double-tap background → reset view to fit all nodes
  cy.on('dbltap', function(evt) {
    if (evt.target === cy) {
      cy.animate({
        fit: { eles: cy.elements(), padding: window.innerWidth < 900 ? 20 : 40 }
      }, { duration: 300 });
    }
  });

  // Feedback edge click
  cy.on('tap', 'edge[type="feedback"]', function(evt) {
    evt.stopPropagation();
    hideFeedbackCallout();
    const edge = evt.target;
    const data = getGraphData();
    const loop = findLoopForEdge(edge.data('source'), edge.data('target'), data)
      || buildFeedbackStub(edge.data('source'), edge.data('target'), data);
    if (!loop) return;
    // Use click position if available, otherwise compute from edge midpoint
    const pos = evt.renderedPosition || (() => {
      const zoom = cy.zoom();
      const pan = cy.pan();
      const mid = edge.midpoint();
      return { x: mid.x * zoom + pan.x, y: mid.y * zoom + pan.y };
    })();
    showFeedbackCallout(loop, pos);
  });

  // "See full description" button in callout
  document.getElementById('feedback-callout-expand').addEventListener('click', () => {
    const loopId = _calloutLoopId;
    hideFeedbackCallout();
    if (loopId && loopId !== '__stub__') openLoopPanel(loopId, getLanguage());
  });

  // Update callout content on language change
  document.addEventListener('languagechange', (e) => {
    if (_calloutLoopId) {
      const data = getGraphData();
      const loop = data.feedback_loops.find(l => l.id === _calloutLoopId);
      if (loop) updateCalloutContent(loop, e.detail.language);
    }
  });

  // Hover (desktop only — mouseover/out don't fire on touch)
  cy.on('mouseover', 'node', function(evt) {
    evt.target.addClass('hover');
    showTooltip(evt.target, evt.renderedPosition);
  });

  cy.on('mouseout', 'node', function(evt) {
    evt.target.removeClass('hover');
    hideTooltip();
  });

  // Escape key — close sidebar first, then panel, then exit graph nav
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isSidebarOpen()) {
        closeSidebar();
      } else if (isPanelOpen()) {
        const savedIdx = _savedCursorIdx;
        _savedCursorIdx = -1;
        closePanel();
        deselectAll();
        document.getElementById('cy').focus();
        if (savedIdx >= 0) setGraphFocusCursor(savedIdx);
      }
    }
  });

  // Graph keyboard navigation
  const cyEl = document.getElementById('cy');
  const PAN_STEP = 80;
  const ZOOM_FACTOR = 1.2;

  cyEl.addEventListener('keydown', (e) => {
    const cy = getCy();
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        cy.panBy({ x: PAN_STEP, y: 0 });
        break;
      case 'ArrowRight':
        e.preventDefault();
        cy.panBy({ x: -PAN_STEP, y: 0 });
        break;
      case 'ArrowUp':
        e.preventDefault();
        cy.panBy({ x: 0, y: PAN_STEP });
        break;
      case 'ArrowDown':
        e.preventDefault();
        cy.panBy({ x: 0, y: -PAN_STEP });
        break;
      case '+':
      case '=':
        e.preventDefault();
        cy.zoom({
          level: Math.min(cy.zoom() * ZOOM_FACTOR, cy.maxZoom()),
          renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }
        });
        break;
      case '-':
        e.preventDefault();
        cy.zoom({
          level: Math.max(cy.zoom() / ZOOM_FACTOR, cy.minZoom()),
          renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }
        });
        break;
      case 'Tab': {
        e.preventDefault();
        e.stopPropagation();
        if (_graphNodeOrder.length === 0) buildGraphNodeOrder();
        if (_graphNodeOrder.length === 0) break;
        const len = _graphNodeOrder.length;
        if (e.shiftKey) {
          const prev = _graphFocusCursorIdx <= 0 ? len - 1 : _graphFocusCursorIdx - 1;
          setGraphFocusCursor(prev);
        } else {
          const next = _graphFocusCursorIdx >= len - 1 ? 0 : _graphFocusCursorIdx + 1;
          setGraphFocusCursor(next);
        }
        break;
      }
      case 'Enter':
      case ' ': {
        if (_graphFocusCursorIdx >= 0 && _graphFocusCursorIdx < _graphNodeOrder.length) {
          e.preventDefault();
          const nodeId = _graphNodeOrder[_graphFocusCursorIdx];
          _savedCursorIdx = _graphFocusCursorIdx;
          clearGraphFocusCursor();
          selectNode(nodeId);
          requestAnimationFrame(() => {
            const closeBtn = isMobile()
              ? document.getElementById('mobile-sheet-close')
              : document.getElementById('panel-close');
            if (closeBtn) closeBtn.focus();
          });
        }
        break;
      }
      case 'Escape':
        if (_graphFocusCursorIdx >= 0) {
          e.stopPropagation();
          clearGraphFocusCursor();
          document.getElementById('toggle-experiential').focus();
        }
        break;
    }
  });

  cyEl.addEventListener('blur', () => {
    clearGraphFocusCursor();
  });

  // Clicking Cytoscape's canvas children doesn't automatically focus #cy,
  // so arrow keys and +/- won't work until focus is explicitly set here.
  // Guard against calling focus() on an already-focused element — some browsers
  // fire blur+focus in that case, which would reset the keyboard cursor.
  cyEl.addEventListener('mousedown', () => {
    clearGraphFocusCursor();
    if (document.activeElement !== cyEl) {
      cyEl.focus({ preventScroll: true });
    }
  });

  // Panel close button (desktop)
  document.getElementById('panel-close').addEventListener('click', () => {
    const savedIdx = _savedCursorIdx;
    _savedCursorIdx = -1;
    closePanel();
    deselectAll();
    document.getElementById('cy').focus();
    if (savedIdx >= 0) setGraphFocusCursor(savedIdx);
  });

  // Mobile sheet close button
  document.getElementById('mobile-sheet-close').addEventListener('click', () => {
    const savedIdx = _savedCursorIdx;
    _savedCursorIdx = -1;
    closePanel();
    deselectAll();
    document.getElementById('cy').focus();
    if (savedIdx >= 0) setGraphFocusCursor(savedIdx);
  });

  // Delegate clicks on panel-node-link buttons — covers both desktop panel and mobile sheet
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.panel-node-link');
    if (btn && btn.dataset.nodeId) {
      _savedCursorIdx = -1;
      selectNode(btn.dataset.nodeId);
    }
  });

  // Delegate clicks on panel-loop-link buttons (loop membership in node cards)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.panel-loop-link');
    if (btn && btn.dataset.loopId) {
      _savedCursorIdx = -1;
      selectLoop(btn.dataset.loopId);
    }
  });

  // FYP trigger button
  document.getElementById('fyp-trigger').addEventListener('click', () => {
    if (isSidebarOpen()) {
      closeSidebar();
    } else {
      openSidebar(getLanguage());
    }
  });

  // FYP close button
  document.getElementById('fyp-close').addEventListener('click', () => {
    closeSidebar();
  });

  // FYP entry selection (delegated on the list)
  document.getElementById('fyp-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-primary-node]');
    if (!btn) return;
    const primaryNodeId = btn.dataset.primaryNode;
    const alsoLookAt = JSON.parse(btn.dataset.alsoLookAt || '[]');
    closeSidebar();
    navigateFromFyp(primaryNodeId, alsoLookAt);
  });

  initMobileGestures();
}

function initMobileGestures() {
  // Bottom-sheet swipe: swipe up expands (60%→90%), swipe down collapses or closes
  const sheet = document.getElementById('mobile-sheet');
  let sheetStartY = 0;

  sheet.addEventListener('touchstart', (e) => {
    sheetStartY = e.touches[0].clientY;
  }, { passive: true });

  sheet.addEventListener('touchend', (e) => {
    const delta = e.changedTouches[0].clientY - sheetStartY;
    if (Math.abs(delta) < 20) return; // ignore small movements
    if (delta > 60) {
      // Swipe down
      if (sheet.classList.contains('expanded')) {
        sheet.classList.remove('expanded'); // collapse to 60%
      } else {
        closePanel();
        deselectAll();
      }
    } else if (delta < -60) {
      // Swipe up
      if (!sheet.classList.contains('expanded')) {
        sheet.classList.add('expanded'); // expand to 90%
      }
    }
    e.stopPropagation();
  }, { passive: true });

  // FYP sidebar swipe-right close (mobile full-screen overlay)
  const sidebar = document.getElementById('fyp-sidebar');
  let sidebarStartX = 0;

  sidebar.addEventListener('touchstart', (e) => {
    sidebarStartX = e.touches[0].clientX;
  }, { passive: true });

  sidebar.addEventListener('touchend', (e) => {
    const delta = e.changedTouches[0].clientX - sidebarStartX;
    if (delta > 80) {
      closeSidebar();
    }
    e.stopPropagation();
  }, { passive: true });
}

function selectNode(nodeId) {
  const cy = getCy();
  clearGraphFocusCursor();

  cy.batch(() => {
    cy.elements().removeClass('selected dimmed highlighted highlighted-inbound highlighted-outbound highlighted-solidarity also-look-at loop-member loop-edge hover graph-cursor');
    cy.nodes().addClass('dimmed');
    cy.edges().addClass('dimmed');

    const node = cy.$('#' + nodeId);
    node.removeClass('dimmed').addClass('selected');

    node.connectedEdges().forEach(edge => {
      edge.removeClass('dimmed');
      if (edge.data('type') === 'solidarity') {
        edge.addClass('highlighted-solidarity');
      } else if (edge.target().id() === nodeId) {
        edge.addClass('highlighted-inbound');
      } else {
        edge.addClass('highlighted-outbound');
      }
    });
    node.connectedEdges().connectedNodes().removeClass('dimmed');
  });

  const node = cy.$('#' + nodeId);
  if (isMobile()) {
    cy.animate({ center: { eles: node }, zoom: 1.3 }, { duration: 400 });
  } else {
    // Pan horizontally to bring node into view if it's near an edge
    const pos = node.renderedPosition();
    const w = cy.width();
    if (pos.x < 60 || pos.x > w - 60) {
      cy.animate({ panBy: { x: w / 2 - pos.x, y: 0 } }, { duration: 300 });
    }
  }

  openPanel(nodeId, getLanguage());
}

function deselectAll() {
  const cy = getCy();
  clearGraphFocusCursor();
  cy.batch(() => {
    cy.elements().removeClass('selected dimmed highlighted highlighted-inbound highlighted-outbound highlighted-solidarity also-look-at loop-member loop-edge graph-cursor');
  });
}

function navigateFromFyp(primaryNodeId, alsoLookAt) {
  const cy = getCy();

  cy.batch(() => {
    cy.elements().removeClass('selected dimmed highlighted highlighted-inbound highlighted-outbound highlighted-solidarity also-look-at loop-member loop-edge hover');
    cy.nodes().addClass('dimmed');
    cy.edges().addClass('dimmed');

    const node = cy.$('#' + primaryNodeId);
    node.removeClass('dimmed').addClass('selected');

    node.connectedEdges().forEach(edge => {
      edge.removeClass('dimmed');
      if (edge.data('type') === 'solidarity') {
        edge.addClass('highlighted-solidarity');
      } else if (edge.target().id() === primaryNodeId) {
        edge.addClass('highlighted-inbound');
      } else {
        edge.addClass('highlighted-outbound');
      }
    });
    node.connectedEdges().connectedNodes().removeClass('dimmed');

    for (const id of alsoLookAt) {
      cy.$('#' + id).removeClass('dimmed').addClass('also-look-at');
    }
  });

  cy.animate({ center: { eles: cy.$('#' + primaryNodeId) }, zoom: 1.3 }, { duration: 400 });

  openPanel(primaryNodeId, getLanguage());

  requestAnimationFrame(() => {
    const closeBtn = isMobile()
      ? document.getElementById('mobile-sheet-close')
      : document.getElementById('panel-close');
    if (closeBtn) closeBtn.focus();
  });
}

function showTooltip(node, renderedPos) {
  const container = document.getElementById('cy');
  const rect = container.getBoundingClientRect();
  const tooltip = document.getElementById('node-tooltip');

  tooltip.querySelector('.tooltip-label').textContent = node.data(`label_${getLanguage()}`);
  tooltip.querySelector('.tooltip-layer').textContent = node.data('layer_name');
  tooltip.style.left = (rect.left + renderedPos.x + 8) + 'px';
  tooltip.style.top = (rect.top + renderedPos.y + 12) + 'px';
  tooltip.style.display = 'block';
}

function hideTooltip() {
  const tooltip = document.getElementById('node-tooltip');
  if (tooltip) tooltip.style.display = 'none';
}

export function syncToggleUI(lang) {
  updateToggleButtonState(lang);
  updateHeaderLabels(lang);
}

function updateToggleButtonState(lang) {
  const expBtn = document.getElementById('toggle-experiential');
  const anaBtn = document.getElementById('toggle-analytical');
  expBtn.setAttribute('aria-pressed', String(lang === 'experiential'));
  anaBtn.setAttribute('aria-pressed', String(lang === 'analytical'));
  expBtn.classList.toggle('active', lang === 'experiential');
  anaBtn.classList.toggle('active', lang === 'analytical');
}

function updateHeaderLabels(lang) {
  const fypTrigger = document.getElementById('fyp-trigger');
  fypTrigger.textContent = lang === 'analytical' ? 'Find Your Entry Point' : 'Find Your Pain';
}

function findLoopForEdge(source, target, data) {
  // Pass 1: look for a loop where source and target appear consecutively
  for (const loop of data.feedback_loops) {
    const seq = loop.node_sequence;
    for (let i = 0; i < seq.length - 1; i++) {
      if (seq[i] === source && seq[i + 1] === target) return loop;
    }
  }
  // Pass 2: look for a loop that contains both nodes
  for (const loop of data.feedback_loops) {
    const seq = loop.node_sequence;
    if (seq.includes(source) && seq.includes(target)) return loop;
  }
  return null;
}

// For feedback edges not covered by a named loop — show what we know from the nodes themselves.
// Uses a sentinel ID '__stub__' so hideFeedbackCallout works correctly (it guards on _calloutLoopId).
function buildFeedbackStub(source, target, data) {
  const srcNode = data.nodes.find(n => n.id === source);
  const tgtNode = data.nodes.find(n => n.id === target);
  if (!srcNode || !tgtNode) return null;
  return {
    id: '__stub__',
    name_analytical: 'Feedback Relationship',
    name_experiential: 'Feedback Relationship',
    description_analytical: `${srcNode.label_analytical} reinforces ${tgtNode.label_analytical} — a feedback that tightens the structural pressure upstream.`,
    description_experiential: `${srcNode.label_experiential} feeds back into ${tgtNode.label_experiential} — the downstream effect makes the upstream cause worse.`,
    node_sequence: [source, target]
  };
}

function showFeedbackCallout(loop, renderedPos) {
  _calloutLoopId = loop.id;
  updateCalloutContent(loop, getLanguage());
  // Hide the expand button for stubs (no named loop panel to open)
  const expandBtn = document.getElementById('feedback-callout-expand');
  if (expandBtn) expandBtn.style.display = (loop.id && loop.id !== '__stub__') ? '' : 'none';

  const callout = document.getElementById('feedback-callout');
  const cyEl = document.getElementById('cy');
  const rect = cyEl.getBoundingClientRect();

  let left = rect.left + renderedPos.x + 12;
  let top = rect.top + renderedPos.y + 12;

  // Keep callout within viewport
  const calloutW = 280;
  const calloutH = 140;
  if (left + calloutW > window.innerWidth - 8) left = rect.left + renderedPos.x - calloutW - 12;
  if (top + calloutH > window.innerHeight - 8) top = rect.top + renderedPos.y - calloutH - 12;

  callout.style.left = left + 'px';
  callout.style.top = top + 'px';
  callout.style.display = 'block';
  callout.removeAttribute('aria-hidden');

  // Close when clicking outside the callout
  _closeCalloutListener = (e) => {
    if (!callout.contains(e.target)) hideFeedbackCallout();
  };
  setTimeout(() => {
    document.addEventListener('click', _closeCalloutListener, true);
  }, 0);
}

function updateCalloutContent(loop, lang) {
  const callout = document.getElementById('feedback-callout');
  const name = lang === 'analytical' ? loop.name_analytical : loop.name_experiential;
  const desc = lang === 'analytical' ? loop.description_analytical : loop.description_experiential;
  // Show first 2 sentences of description
  const shortDesc = desc.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
  callout.querySelector('.callout-name').textContent = name;
  callout.querySelector('.callout-desc').textContent = shortDesc;
}

function hideFeedbackCallout() {
  if (!_calloutLoopId) return;
  _calloutLoopId = null;
  const callout = document.getElementById('feedback-callout');
  callout.style.display = 'none';
  callout.setAttribute('aria-hidden', 'true');
  if (_closeCalloutListener) {
    document.removeEventListener('click', _closeCalloutListener, true);
    _closeCalloutListener = null;
  }
}
