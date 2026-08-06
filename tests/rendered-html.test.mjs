import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost"), {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the workbench homepage and approved tools", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]+lang="zh-CN"/i);
  assert.match(html, /<title>虞律团队 AI 工作台<\/title>/i);
  assert.match(html, /团队专属的 AI 工具与 Skill 统一入口/);
  assert.match(html, /本地律师材料脱敏/);
  assert.match(html, /法律服务建议书/);
  assert.match(html, /PE\/VC 融资交易文件审阅/);
  assert.match(html, /中国并购交易结构方案规划/);
  assert.match(html, /Anthropic Legal/);
  assert.match(html, /尽调问题提取/);
  assert.match(html, /董事会书面决议/);
  assert.match(html, /href="\/tools\/local-legal-redaction"/);
  assert.match(html, /本入口不会上传客户文件/);
  assert.doesNotMatch(html, /<input[^>]+type=["']file["']/i);
  assert.doesNotMatch(html, /react-loading-skeleton|Your site is taking shape|codex-preview/i);
});

test("Anthropic legal skills are deployed with local invocation and repository source", async () => {
  const response = await render("/tools/diligence-issue-extraction");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /尽调问题提取/);
  assert.match(html, /\$diligence-issue-extraction/);
  assert.match(html, /资料室文件/);
  assert.match(html, /问题清单/);
  assert.match(html, /通过本地 Codex 调用/);
  assert.match(html, /安装 \/ 查看 GitHub/);
  assert.match(html, /Anthropic claude-for-legal/);
  assert.match(html, /美国法/);
  assert.match(
    html,
    /href="https:\/\/github\.com\/zhy1126\/Anthropic-Legal-Skills\/tree\/main\/skills\/diligence-issue-extraction"/,
  );
});

test("PE/VC review skill is deployed with lawyer confirmation and GitHub source", async () => {
  const response = await render("/tools/pe-vc-financing-doc-review");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /PE\/VC 融资交易文件审阅/);
  assert.match(html, /v0\.1\.16/);
  assert.match(html, /\$pe-vc-transaction-docs-review/);
  assert.match(html, /Word《审阅关注点确认单》/);
  assert.match(html, /事实问题与法律分析/);
  assert.match(html, /律师确认后的最终 Word 审查报告/);
  assert.match(html, /跨文件一致性检查/);
  assert.match(html, /通过本地 Codex 调用/);
  assert.match(html, /安装 \/ 查看 GitHub/);
  assert.match(
    html,
    /href="https:\/\/github\.com\/zhy1126\/PE-VC-Financing-Agreement-Review\/tree\/main\/pe-vc-transaction-docs-review"/,
  );
  assert.doesNotMatch(html, /href="http:\/\/127\.0\.0\.1:8765/);
});

test("M&A planning skill is deployed with its local invocation and GitHub source", async () => {
  const response = await render("/tools/transaction-structure-planning");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /中国并购交易结构方案规划/);
  assert.match(html, /\$handling-china-ma-transactions/);
  assert.match(html, /控制权、收购方式、合并财务报表/);
  assert.match(html, /管理层决策版与律师执行版/);
  assert.match(html, /尽调、交易文件、审批、会计四类任务包/);
  assert.match(html, /通过本地 Codex 调用/);
  assert.match(html, /安装 \/ 查看 GitHub/);
  assert.match(
    html,
    /href="https:\/\/github\.com\/zhy1126\/Cross-border-M-and-A-Investment\/tree\/main\/skills\/handling-china-ma-transactions"/,
  );
});

test("homepage exposes accessible navigation, filters, and tool landmarks", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /<a[^>]+href="#main-content"[^>]*>跳到主要内容<\/a>/i);
  assert.match(html, /<nav[^>]+aria-label="工具分类"/i);
  assert.match(html, /<main[^>]+id="main-content"/i);
  assert.match(html, /<article\b/i);
  assert.match(html, /<label[^>]+for="tool-search"/i);
  assert.match(html, /<label[^>]+for="status-filter"/i);
  assert.match(html, /清除筛选/);
});

test("redaction detail exposes metadata, workflow, and safe actions", async () => {
  const response = await render("/tools/local-legal-redaction");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /本地律师材料脱敏/);
  assert.match(html, /feat\/legal-redaction-mvp/);
  assert.match(html, /输入材料/);
  assert.match(html, /输出结果/);
  assert.match(html, /使用步骤/);
  assert.match(html, /打开本地工具/);
  assert.match(html, /href="http:\/\/127\.0\.0\.1:8501"/);
  assert.match(html, /安装 \/ 查看 GitHub/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noreferrer"/);
  assert.match(html, /返回工具箱/);
});

test("unknown tool IDs return a friendly Chinese 404", async () => {
  const response = await render("/tools/not-a-real-tool");
  assert.equal(response.status, 404);

  const html = await response.text();
  assert.match(html, /没有找到这个工具/);
  assert.match(html, /返回 AI 工作台/);
});
