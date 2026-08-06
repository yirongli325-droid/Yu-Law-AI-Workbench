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
    version: "v0.1.16（本机 Skill）",
    repository:
      "https://github.com/zhy1126/PE-VC-Financing-Agreement-Review/tree/main/pe-vc-transaction-docs-review",
    localUrl: null,
    inputs: [
      "交易架构与委托方立场",
      "Term Sheet / SPA / SHA / 章程等文件",
      "当前版本、上一版及既有问题清单",
      "项目事实、审阅偏好与重点关注事项",
    ],
    outputs: [
      "问题清单与 Major Issue List",
      "Word《审阅关注点确认单》",
      "逐条修改建议、批注或红线稿",
      "多轮响应矩阵与跨文件一致性检查",
      "律师确认后的最终 Word 审查报告",
    ],
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
    id: "drafting-legal-service-contracts",
    name: "法律服务合同受控起草",
    category: "文书制作",
    status: "local-skill",
    version: "main（本机 Skill）",
    repository: "https://github.com/zhy1126/drafting-legal-service-contracts",
    localUrl: null,
    inputs: [
      "合同路由（常年顾问、并购/尽调专项或诉讼仲裁）",
      "双方主体、委托事项、服务范围与期限",
      "团队、收费、付款节点与第三方费用",
      "争议解决、内部审批状态与适用 Word 母版",
    ],
    outputs: [
      "清洁版法律服务合同 Word",
      "项目参数摘要",
      "待律师确认事项",
      "相对基准模板的变更清单",
    ],
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

const expectedAnthropicTools = [
  ["ai-tool-handoff", "AI 批量审阅工具交接", "将批量条款提取交给 Luminance、Kira 等工具，并按信任等级复核输出。"],
  ["board-minutes", "董事会及委员会会议纪要", "根据议程、会议材料和记录起草董事会或委员会会议纪要。"],
  ["closing-checklist", "交割清单管理", "维护交割事项、责任人、状态、关键路径和预计交割日。"],
  ["cold-start-interview", "项目与团队配置访谈", "通过一次结构化访谈建立团队偏好、项目范围和工作环境。"],
  ["deal-team-summary", "交易团队摘要", "把尽调发现压缩成适合管理层或项目团队阅读的简报。"],
  ["diligence-issue-extraction", "尽调问题提取", "按预设分类和重要性标准，从资料室文件中提取尽调问题。"],
  ["entity-compliance", "主体合规事项跟踪", "维护主体合规台账、申报期限、完成状态和健康检查。"],
  ["integration-management", "并购后整合管理", "维护交割后整合计划、同意事项、合同转让和周报。"],
  ["material-contract-schedule", "重大合同披露清单", "依据交易文件中的重大合同定义，从尽调结果生成披露清单。"],
  ["matter-workspace", "项目工作空间管理", "创建、切换和关闭相互隔离的项目工作空间。"],
  ["tabular-review", "批量表格化审阅", "按一份文件一行、一项信息一列的方式批量审阅并保留出处。"],
  ["written-consent", "董事会书面决议", "参照既有范本起草董事会或委员会一致书面决议。"],
];

test("exports the supported category and status filters", () => {
  assert.deepEqual(registry.categories, [
    "全部工具",
    "数据安全",
    "基础工作",
    "文书制作",
    "专业法律分析",
    "Anthropic Legal",
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
  assert.equal(registry.tools.length, 21);
  assert.deepEqual(
    registry.tools.filter((tool) => expectedTools.some(({ id }) => id === tool.id)).map(({
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

test("deploys all installed Anthropic legal skills with local invocations and source links", () => {
  const anthropicTools = registry.tools.filter((tool) => tool.category === "Anthropic Legal");
  assert.equal(anthropicTools.length, expectedAnthropicTools.length);

  for (const [id, name, summary] of expectedAnthropicTools) {
    const tool = registry.getTool(id);
    assert.ok(tool, `missing Anthropic legal skill: ${id}`);
    assert.equal(tool.name, name);
    assert.equal(tool.summary, summary);
    assert.equal(tool.status, "local-skill");
    assert.equal(tool.localUrl, null);
    assert.equal(
      tool.repository,
      `https://github.com/zhy1126/Anthropic-Legal-Skills/tree/main/skills/${id}`,
    );
    assert.equal(tool.steps[0], `在本地 Codex 中调用 $${id}`);
    assert.match(tool.notice, /Anthropic claude-for-legal/);
    assert.match(tool.notice, /律师/);
  }
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
