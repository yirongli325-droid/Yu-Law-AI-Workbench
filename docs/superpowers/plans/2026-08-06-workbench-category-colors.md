# Workbench Category Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sidebar's numeric disclaimer label with “注意” and add restrained, coordinated green category accents to homepage navigation and tool cards.

**Architecture:** Keep category identity in the existing registry data and expose it to CSS through `data-category` attributes on category buttons and tool cards. Use exact CSS attribute selectors for a five-step green palette, preserving the current white card surfaces and all existing behavior.

**Tech Stack:** React 19, TypeScript, CSS, Node test runner, vinext

---

### Task 1: Add regression coverage for the approved homepage semantics

**Files:**
- Modify: `tests/rendered-html.test.mjs`

- [ ] **Step 1: Write the failing tests**

Add assertions to the homepage accessibility test that require the new notice label and all five category attributes:

```js
assert.match(html, /<div class="sidebar-note">\s*<strong>注意<\/strong>/);
assert.doesNotMatch(html, /<div class="sidebar-note">\s*<span[^>]*>01<\/span>/);
for (const category of ["数据安全", "基础工作", "文书制作", "专业法律分析", "Anthropic Legal"]) {
  assert.match(html, new RegExp(`data-category="${category}"`));
}
```

- [ ] **Step 2: Run the rendered HTML test to verify it fails**

Run: `npm run build && node --test tests/rendered-html.test.mjs`

Expected: FAIL because the sidebar still renders `01` and category elements do not expose `data-category`.

### Task 2: Implement the notice and category styling hooks

**Files:**
- Modify: `app/_components/WorkbenchShell.tsx`
- Modify: `app/_components/ToolCard.tsx`

- [ ] **Step 1: Update the sidebar notice and category buttons**

In `WorkbenchShell`, render the approved notice heading and expose each specific category to CSS:

```tsx
<button
  data-category={item === "全部工具" ? undefined : item}
  className={category === item ? "category-button is-active" : "category-button"}
  type="button"
  aria-pressed={category === item}
  onClick={() => setCategory(item)}
  key={item}
>
  <span>{item}</span>
  <span className="category-count">{count}</span>
</button>
```

```tsx
<div className="sidebar-note">
  <strong>注意</strong>
  <p>工具结果仅供工作辅助，关键结论须由经办律师复核。</p>
</div>
```

- [ ] **Step 2: Expose each tool card category to CSS**

In `ToolCard`, add the existing category value without changing card behavior:

```tsx
<article
  className={`tool-card${featured ? " tool-card-featured" : ""}`}
  data-category={tool.category}
>
```

### Task 3: Add the restrained single-family color scale

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Define category tokens**

Add the five approved values to `:root`:

```css
--category-security: #29443a;
--category-foundation: #3f5e52;
--category-documents: #587667;
--category-analysis: #718d7f;
--category-anthropic: #8da397;
```

- [ ] **Step 2: Apply category values through a shared local token**

Assign `--category-accent` with exact selectors for both buttons and cards, then use it only for category text/count accents and a 4px card top border:

```css
[data-category="数据安全"] { --category-accent: var(--category-security); }
[data-category="基础工作"] { --category-accent: var(--category-foundation); }
[data-category="文书制作"] { --category-accent: var(--category-documents); }
[data-category="专业法律分析"] { --category-accent: var(--category-analysis); }
[data-category="Anthropic Legal"] { --category-accent: var(--category-anthropic); }

.category-button[data-category]:not(.is-active) { color: var(--category-accent); }
.category-button[data-category]:not(.is-active) .category-count { color: var(--category-accent); opacity: 1; }
.tool-card[data-category] { border-top: 4px solid var(--category-accent); }
.tool-card-featured[data-category] { border-color: var(--forest); border-top-color: var(--category-accent); }
```

- [ ] **Step 3: Style the notice title as text rather than a number**

Replace the numeric heading rule with a compact text label:

```css
.sidebar-note strong {
  display: block;
  color: var(--sage);
  font-size: 12px;
  letter-spacing: .12em;
}
```

### Task 4: Verify and publish

**Files:**
- Verify: `tests/rendered-html.test.mjs`
- Verify: `tests/tool-registry.test.mjs`

- [ ] **Step 1: Verify the focused rendered HTML test passes**

Run: `npm run build && node --test tests/rendered-html.test.mjs`

Expected: all rendered HTML tests pass.

- [ ] **Step 2: Verify the complete project**

Run: `npm test && npm run lint && git diff --check`

Expected: all tests pass, lint reports no errors, and no whitespace errors are present.

- [ ] **Step 3: Commit and publish the validated source**

Commit the UI update, push the current branch to the public source repository, package the validated site, save a new hosted version, and deploy it to the existing public URL.
