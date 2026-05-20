# Contributing to The Structure

The map is open source and contributions are welcome. This document covers how the project is structured, what kinds of contributions are most useful, and what won't be accepted.

---

## Running it locally

```bash
git clone https://github.com/the-structure-map/the-structure.git
cd the-structure
python -m http.server 8080
```

Open `http://localhost:8080`. Do not open `index.html` directly — ES modules require a local server.

---

## Two kinds of contribution

### Content changes (no code required)

All map content lives in `data/graph.json`. If you want to:
- Correct a factual claim in a node
- Suggest a new causal relationship
- Improve the wording of a node in either language register
- Add a Find Your Pain entry
- Add a solidarity map entry

...you only need to edit `graph.json`. The schema is documented in the README. You do not need to understand the rendering code.

**For content changes, open an issue first** describing the change and its basis. The map is non-partisan and non-prescriptive — see the constraints below before proposing changes.

### Code changes

The rendering code is in `js/`. The stack is static HTML/CSS/JS with no build step. See `claude/architecture.md` for the full technical specification — all implementation decisions are recorded there.

For non-trivial code changes, open an issue to discuss before building.

---

## Branch workflow

- `main` — production. Do not open PRs directly against main.
- `dev` — integration branch. All PRs go here.
- Branch naming: `fix/description`, `feature/description`, `content/description`

---

## What won't be merged

**On content:**

- Statistics, percentages, or extracted figures from research. The map uses directional and structural claims only ("wages have not kept pace with productivity" — not "productivity rose 64%"). Statistics date fast, invite factual disputes, and distract from structural recognition.
- Prescriptive content — calls to action, electoral recommendations, solution proposals. The map stops at recognition.
- Partisan framing. Structural critique is not the same as partisan positioning. If a change makes the map read as a left-wing or right-wing document, it won't be merged.
- New nodes that aren't structurally grounded. Each node needs clear upstream causes and downstream effects that connect to the existing map.

**On code:**

- External dependencies, CDN links, or package managers. The stack is intentionally self-contained.
- Framework introductions. No React, Vue, Svelte, etc.
- Build steps or bundlers.

---

## Content constraints

The map is built on a few non-negotiable principles:

1. **Honesty over simplicity.** We don't simplify the structure to make it more palatable. We make it navigable.
2. **Attribute-agnostic entry.** Any lived experience is a valid entry point. No contribution should narrow who can find themselves in the map.
3. **Non-partisan.** Both major parties have contributed to the conditions described. The map names structural forces, not political villains.
4. **Tone.** Clarity, relief, and recognition. Not doom, outrage, or recruitment.

---

## License

By contributing, you agree that your contributions are licensed under the same terms as the rest of the project: MIT for code, CC BY-SA 4.0 for content changes to `data/graph.json`.
