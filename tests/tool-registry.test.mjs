import assert from "node:assert/strict";
import test from "node:test";

const registry = await import("../lib/tool-registry.ts");
const allowedRecordKeys = [
  "id",
  "name",
  "category",
  "summary",
  "status",
  "version",
  "repository",
  "localUrl",
  "inputs",
  "outputs",
  "steps",
  "notice",
].sort();

const expectedTools = [
  {
    id: "local-legal-redaction",
    name: "本地律师材料脱敏",
    category: "数据安全",
    status: "connected",
    version: "feat/legal-redaction-mvp",
    repository:
      "https://github.com/zhy1126/Local-LLM-based-Legal-Document-De-identification-System/tree/feat/legal-redaction-mvp",
    localUrl: "http://127.0.0.1:8501",
    inputs: ["TXT", "DOCX", "PDF"],
    outputs: ["脱敏文本", "简洁 DOCX", "风险报告", "完整结果包"],
    steps: [
      "确认本机已安装工具",
      "打开本地页面并选择材料",
      "检查识别结果",
      "下载并由律师复核",
    ],
    notice: "原始材料和映射仅在本机处理，输出须由律师复核。",
  },
  {
    id: "pe-vc-financing-doc-review",
    name: "PE/VC 融资交易文件审阅",
    category: "专业法律分析",
    status: "local-skill",
    version: "本机 Skill",
    repository: null,
    localUrl: null,
    inputs: ["交易架构与委托方立场", "Term Sheet / SPA / SHA / 章程等文件", "文件版本与修改轮次", "重点关注事项"],
    outputs: ["重大问题清单", "逐条修改建议", "修订稿 / 红线版", "跨文件一致性检查"],
  },
  {
    id: "basic-work-skills",
    name: "基础工作 Skill",
    category: "基础工作",
    status: "planned",
    version: "v0.1.0",
    repository: null,
    localUrl: null,
    inputs: ["任务说明", "待处理材料"],
    outputs: ["结构化结果", "待确认事项"],
  },
  {
    id: "legal-service-proposal",
    name: "法律服务建议书",
    category: "文书制作",
    status: "building",
    version: "v0.1.0",
    repository: null,
    localUrl: null,
    inputs: ["批准模板", "项目资料", "律师信息", "案例信息"],
    outputs: ["建议书初稿", "检查清单", "待确认项"],
  },
  {
    id: "quotation-letter",
    name: "报价函",
    category: "文书制作",
    status: "planned",
    version: "v0.1.0",
    repository: null,
    localUrl: null,
    inputs: ["客户信息", "服务范围", "计费方案"],
    outputs: ["报价函初稿", "费用核对表"],
  },
  {
    id: "tender-response",
    name: "标书 / 响应文件",
    category: "文书制作",
    status: "planned",
    version: "v0.1.0",
    repository: null,
    localUrl: null,
    inputs: ["招标文件", "响应模板", "团队与案例"],
    outputs: ["响应文件初稿", "偏离表", "缺件清单"],
  },
  {
    id: "contract-drafting",
    name: "合同制作",
    category: "文书制作",
    status: "planned",
    version: "v0.1.0",
    repository: null,
    localUrl: null,
    inputs: ["合同模板家族", "项目字段", "商务条件"],
    outputs: ["合同初稿", "偏离项", "待确认问题"],
  },
  {
    id: "transaction-structure-planning",
    name: "中国并购交易结构方案规划",
    category: "专业法律分析",
    status: "local-skill",
    version: "main（本机 Skill）",
    repository:
      "https://github.com/zhy1126/Cross-border-M-and-A-Investment/tree/main/skills/handling-china-ma-transactions",
    localUrl: null,
    inputs: [
      "事项信息（阶段、立场、法域、基准日与保密等级）",
      "商业目标（控制目标、并表目标、预算与期限）",
      "交易事实（股权、表决权、治理、标的与交易对方）",
      "可选路径（股权、增资、资产、分步或间接收购）",
      "硬约束（审批、资金、时间、税务、国资、外资与数据）",
      "材料与缺口（版本、未确认事实、责任人与关闭证据）",
    ],
    outputs: [
      "项目状态与一页式方案结论",
      "三维目标及基准、备选、兜底方案比较",
      "推荐方案、成立条件、关键反证与待决策事项",
      "签署至控制取得及并表判断时间线",
      "管理层决策版与律师执行版",
      "尽调、交易文件、审批、会计四类任务包",
    ],
  },
];

test("exports the supported category and status filters", () => {
  assert.deepEqual(registry.categories, [
    "全部工具",
    "数据安全",
    "基础工作",
    "文书制作",
    "专业法律分析",
  ]);
  assert.deepEqual(registry.statuses, [
    "connected",
    "local-skill",
    "installable",
    "planned",
    "building",
  ]);
});

test("defines approved tool identities and integration details", () => {
  assert.equal(registry.tools.length, 8);
  assert.deepEqual(
    registry.tools.map(({
      id,
      name,
      category,
      status,
      version,
      repository,
      localUrl,
      inputs,
      outputs,
      steps,
      notice,
    }) => ({
      id,
      name,
      category,
      status,
      version,
      repository,
      localUrl,
      inputs,
      outputs,
      ...(id === "local-legal-redaction" ? { steps, notice } : {}),
    })).toSorted((left, right) => left.id.localeCompare(right.id)),
    expectedTools.toSorted((left, right) => left.id.localeCompare(right.id)),
  );
  assert.equal(
    registry.getTool("legal-service-proposal")?.notice,
    "仅可使用已批准的内容库。",
  );
});

test("keeps every tool record safe, complete, and displayable", () => {
  const allowedStatuses = new Set([
    "connected",
    "local-skill",
    "installable",
    "planned",
    "building",
  ]);
  const ids = new Set();

  assert.ok(Object.isFrozen(registry.tools), "validated tools must be frozen");

  for (const tool of registry.tools) {
    assert.match(tool.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!ids.has(tool.id), `duplicate tool ID: ${tool.id}`);
    ids.add(tool.id);

    for (const field of ["name", "category", "summary", "version", "notice"]) {
      assert.equal(typeof tool[field], "string", `${tool.id}.${field} must be a string`);
      assert.ok(tool[field].trim(), `${tool.id}.${field} must not be empty`);
    }
    assert.ok(allowedStatuses.has(tool.status), `${tool.id} has an invalid status`);

    for (const field of ["inputs", "outputs", "steps"]) {
      assert.ok(Array.isArray(tool[field]), `${tool.id}.${field} must be an array`);
      assert.ok(tool[field].length > 0, `${tool.id}.${field} must not be empty`);
      assert.ok(
        tool[field].every((value) => typeof value === "string" && value.trim()),
        `${tool.id}.${field} must contain non-empty strings`,
      );
    }

    assert.deepEqual(
      Object.keys(tool).sort(),
      allowedRecordKeys,
      `${tool.id} must use only the allowlisted metadata keys`,
    );

    for (const field of ["repository", "localUrl"]) {
      assert.ok(Object.hasOwn(tool, field), `${tool.id}.${field} must be explicit`);
      assert.ok(
        tool[field] === null || typeof tool[field] === "string",
        `${tool.id}.${field} must be a string or null`,
      );
    }
    if (tool.repository !== null) {
      const repositoryUrl = new URL(tool.repository);
      assert.equal(repositoryUrl.protocol, "https:");
      assert.equal(repositoryUrl.hostname, "github.com");
      assert.equal(repositoryUrl.username, "");
      assert.equal(repositoryUrl.password, "");
      assert.ok(
        repositoryUrl.pathname.split("/").filter(Boolean).length >= 2,
        `${tool.id}.repository must include an owner and repository`,
      );
    }
    if (tool.localUrl !== null) {
      const localUrl = new URL(tool.localUrl);
      const port = Number(localUrl.port);
      assert.equal(localUrl.protocol, "http:");
      assert.equal(localUrl.hostname, "127.0.0.1");
      assert.equal(localUrl.username, "");
      assert.equal(localUrl.password, "");
      assert.ok(Number.isInteger(port) && port >= 1 && port <= 65535);
    }
  }
});

test("rejects unknown or unsafe metadata during registry validation", () => {
  assert.equal(typeof registry.validateToolRecords, "function");

  const [firstTool] = registry.tools;
  const invalidRecords = [
    [{ ...firstTool, shell: "open terminal" }],
    [{ ...firstTool, category: "全部工具" }],
    [{ ...firstTool, status: "experimental" }],
    [{ ...firstTool, repository: "https://github.com@not-github.example/org/repo" }],
    [{ ...firstTool, localUrl: "http://127.0.0.1:0" }],
    [{ ...firstTool, inputs: ["safe", 42] }],
  ];

  for (const invalidTools of invalidRecords) {
    assert.throws(() => registry.validateToolRecords(invalidTools));
  }
});

test("looks up a tool by stable ID", () => {
  assert.equal(registry.getTool("local-legal-redaction")?.name, "本地律师材料脱敏");
  assert.equal(registry.getTool("unknown-tool"), undefined);
});
