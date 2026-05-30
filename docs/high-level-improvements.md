# Rules Engine Simulator: High-Level Improvement Opportunities

## Purpose
This document identifies five high-level improvements that would materially improve the simulator as a product, not just as a demo. The focus is readability, learnability, control, and trust in the engine visualization.

---

## 1. Make The Main Canvas A True “Mission Control” Surface

### Current issue
The simulator is stronger than it was initially, but the main canvas still behaves partly like a graph viewer and partly like a teaching surface. Important controls and important context are split across the page instead of feeling unified around the network itself.

### Improvement
Turn the canvas area into a single primary control surface:
- keep execution controls inside the canvas
- keep zoom/pan controls inside the canvas
- add a compact persistent status rail inside the canvas
- move current step, rule context, replay phase, and selected node summary into one stable strip

### Why this matters
Users should not need to scan the page to answer:
- what phase am I in?
- what is currently active?
- what rule am I looking at?
- what step am I on?

### Outcome
The simulator will feel more like a serious operator tool and less like a collection of panels.

---

## 2. Create A Stronger Separation Between “Build Network” And “Run Fact”

### Current issue
The split view is better than before, but users can still confuse network construction with fact execution because both views share the same graph skeleton and still look closely related.

### Improvement
Make the two phases visually and structurally distinct:

For `Network build`:
- keep future nodes ghosted
- reveal nodes and edges in a more obvious creation sequence
- label creation steps more explicitly
- show reused alpha nodes differently from newly created alpha nodes

For `Fact execution`:
- show the full network immediately
- emphasize movement and fact routing
- visually distinguish pass, fail, join, and fire events more clearly

### Why this matters
This simulator’s teaching value depends on users understanding that the engine:
1. compiles rules into a network
2. runs facts through that network

### Outcome
Users will understand the engine lifecycle faster, especially junior engineers.

---

## 3. Add A Proper Rule Editing Workflow Instead Of Light Sidebar Mutation

### Current issue
The new sidebar is useful as a navigator, but editing is still shallow. Adding a rule or condition works, but there is not yet a complete authored editing flow with obvious form controls, validation, and saved drafts.

### Improvement
Turn the sidebar into navigation and quick actions, then pair it with a focused rule editor panel:
- selected rule opens an editable detail view
- conditions can be edited with form fields instead of raw JSON mutation only
- trigger/operator/action changes become explicit UI controls
- validation errors should be shown inline before compilation
- draft state should be visible before it affects the network

### Why this matters
Right now the simulator is good for viewing and replay. To become truly useful, it needs a clean authoring flow that still respects the engine’s compiled behavior.

### Outcome
The tool becomes useful for both understanding and shaping rules.

---

## 4. Build A First-Class Explanation Layer For Each Node And Step

### Current issue
The replay text is much better now, and clickable references help, but the explanation system is still text-first. Users still need to infer too much from graph state and timeline detail.

### Improvement
Add a dedicated explanation layer tied to the selected step:
- “why this node exists”
- “what condition created this alpha”
- “what branches formed this beta”
- “why this production fired”
- “what exact fact values passed or failed here”

This should appear as a structured explanation card, not just a sentence.

### Why this matters
A rules-engine simulator should not only show motion. It should explain causality.

### Outcome
Engine behavior becomes inspectable instead of merely observable.

---

## 5. Introduce A Cleaner Product Information Architecture

### Current issue
The app has accumulated many useful pieces:
- simulator
- split view
- rules view
- timeline
- quirks
- sidebar

They work, but the overall information architecture is still dense and slightly improvised. There is still some cognitive overhead when moving between navigation, execution, explanation, and configuration.

### Improvement
Restructure the product into clearer layers:

Primary layer:
- sidebar
- main canvas
- embedded timeline

Secondary layer:
- explanation / node detail
- quirks / engine notes
- authored rule details

Progressive disclosure:
- default experience should prioritize the simulator and rule tree
- advanced surfaces should expand only when needed

### Why this matters
Good simulator tools feel deep, but not crowded. The current app is close, but it still needs stronger prioritization of what is primary versus secondary.

### Outcome
The app will feel calmer, more intentional, and easier to onboard into.

---

## Recommended Priority Order

1. Mission-control canvas refinement
2. Clearer build vs execution separation
3. Structured explanation layer
4. Full rule editing workflow
5. Information architecture cleanup

---

## Closing Note
The simulator is already strong in one important respect: it no longer looks like a generic graph toy. The next leap is to make it feel like a professional engine-operations product where graph, explanation, and authoring all reinforce each other cleanly.
