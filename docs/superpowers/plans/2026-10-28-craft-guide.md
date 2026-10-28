# Craft Guide Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. All phases authorized by the user.

**Goal:** Ship a local-first Minecraft guide for Windows and the browser.
**Architecture:** Shared JS domain/validation plus platform storage and scanning adapters; Rust owns native filesystem and Codex process access.
**Tech Stack:** Tauri 2, Rust, Vite, vanilla ES modules, fflate (Web JAR extraction), Node test, Playwright.
**Spec:** ../specs/2026-10-28-craft-guide-design.md

## Global Constraints
No paid API, no automatic external data transmission, no game writes, Windows JSON/Web localStorage, Japanese accessible pixel UI, independent installers and Pages deploy.

## Review Focus
Corrupt or future data never overwritten; ambiguous recipes not asserted active; alternate/cyclic ingredients deterministic; import references validated; offline and subpath assets work.

## Tasks
- [x] Domain tests RED then schema/migrations/catalog/recipes/calculation/prompts implementation GREEN. Files src/domain/*.js, tests/domain.test.js.
- [x] Storage protection tests RED then Web adapter and Rust atomic JSON implementation GREEN. Files src/platform/*.js, src-tauri/src/*.rs, tests/storage.test.js.
- [x] Implement native selected-root scanning and Web folder/archive scanning, test fixture extraction and unsupported forms. Limit untrusted input sizes.
- [x] Implement responsive pixel UI, original SVG scenic backgrounds, environment settings, recipes, notes, instructions, explicit-send AI pane.
- [x] Add Playwright end-to-end for settings, persistence, corrupt imports, backup, environment isolation, subpath and offline; build native installer, launch WebView2 and test native save/read/scan.
- [x] Fresh whole-project review; fix material findings; Git commit. Set up GitHub Actions and deploy only with available authentication. Document delivered artifacts and exact remaining gaps.

## Execution ledger
Initial: Node 24, npm 11, Rust/Cargo, Git available. Existing folders left intact. GitHub CLI not authenticated; user notified. Codex CLI installed and reports ChatGPT authentication; no inference made during inspection.

Domain/storage tests: 7 behavior failures observed with stubs, then 7/7 pass; review regressions 3 failures observed, then 10/10 pass. Rust 3/3 pass. Playwright 6/6 pass. Actual WebView2/Rust save/reload/native fixture scan/ChatGPT auth pass in isolated temporary data. One synthetic AI connection inference passed; no personal environment data sent. Production subpath, scenic assets, offline reload/calculation pass.

Review: fresh read-only reviewer found external-backup restore blocked during corruption and silent Web extraction truncation. Both fixed with RED→GREEN Node regressions and end-to-end restore coverage. Modern tag-string support also added. No remaining critical/important source findings.

Ruling: Use installed official Codex CLI exec instead of a custom app-server client — verified ChatGPT login and end-to-end response without paid API; avoids a larger protocol/auth implementation. Requires CLI on the user's PC; Web falls back to explicit copy.
Ruling: Use original code-generated SVG scenery/icons rather than game assets — keeps assets local, light and redistributable; appearance is a stylized pixel interpretation.
Ruling: Runtime MOD snapshots remain a future extension — no companion MOD was approved for installation; static data carries explicit limits, and special recipes are disclosed as unsupported.

Final: Windows, Web and deploy CI jobs all succeeded (run 40605059244). Actual public URL verified. Release artifacts and source tag synchronized. See docs/VERIFICATION.md for exact tests and remaining compatibility limits.
