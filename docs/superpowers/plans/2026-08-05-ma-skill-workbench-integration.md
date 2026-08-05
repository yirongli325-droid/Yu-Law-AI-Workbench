# M&A Skill Workbench Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the merged `handling-china-ma-transactions` Skill as the workbench's official China M&A transaction-structure planning entry.

**Architecture:** Reuse the existing `transaction-structure-planning` route and tool-card layout instead of creating a duplicate. Update its registry metadata from the merged GitHub `main` branch, retain the truthful local-Codex handoff, and expose the GitHub source alongside it.

**Tech Stack:** Vinext/React, JSON tool registry, Node test runner.

---

### Task 1: Upgrade the existing M&A workbench entry

**Files:**
- Modify: `tests/tool-registry.test.mjs`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `data/tools.json`
- Modify: `app/_components/ToolActions.tsx`

- [ ] **Step 1: Write the failing tests**

Update the expected `transaction-structure-planning` record to require the official product name, merged GitHub Skill URL, six input groups, three-axis workflow, dual outputs, four downstream task packages, and `$handling-china-ma-transactions` invocation. Add a rendered-detail test requiring both `通过本地 Codex 调用` and `安装 / 查看 GitHub`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run the registry and rendered HTML tests. Expected: failure because the current record still uses the old label, lacks the repository URL and full product contract, and hides the local-Codex handoff when a repository exists.

- [ ] **Step 3: Implement the minimal registry and action changes**

Replace only the existing `transaction-structure-planning` metadata. Update `ToolActions` so a `local-skill` with a repository shows the local Codex handoff plus the GitHub link; do not add an Agent Bridge or fake launch URL.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the registry and rendered HTML tests. Expected: all pass.

- [ ] **Step 5: Run full verification and commit**

Run the full test suite, lint, and `git diff --check`. Commit only the workbench entry, tests, component adjustment, and this plan.
