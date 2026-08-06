export const businessStages = ["前期准备", "具体工作", "文书起草"] as const;
export const workflowLevels = ["通用能力层", "专业法律工作层", "文书交付层"] as const;
export const systemStages = [
  "发起任务",
  "权限确认",
  "资料读取 / 脱敏",
  "Skill 执行",
  "结果整理",
  "律师复核 / 归档",
] as const;

export type BusinessStage = (typeof businessStages)[number];
export type WorkflowLevel = (typeof workflowLevels)[number] | "入口与保障层";
export type SystemStage = (typeof systemStages)[number];

export type WorkflowProfile = {
  level: WorkflowLevel;
  businessStages: readonly BusinessStage[];
  systemStages: readonly SystemStage[];
};

const allBusinessStages = businessStages;
const sourceToReview = ["资料读取 / 脱敏", "Skill 执行", "结果整理", "律师复核 / 归档"] as const;
const executionToReview = ["Skill 执行", "结果整理", "律师复核 / 归档"] as const;

export const toolWorkflowProfiles: Readonly<Record<string, WorkflowProfile>> = Object.freeze({
  "local-legal-redaction": {
    level: "入口与保障层",
    businessStages: allBusinessStages,
    systemStages: ["资料读取 / 脱敏", "律师复核 / 归档"],
  },
  "matter-workspace": {
    level: "入口与保障层",
    businessStages: allBusinessStages,
    systemStages: ["权限确认", ...sourceToReview],
  },
  "cold-start-interview": {
    level: "通用能力层",
    businessStages: ["前期准备"],
    systemStages: ["发起任务", "权限确认"],
  },
  "basic-work-skills": {
    level: "通用能力层",
    businessStages: ["前期准备", "具体工作"],
    systemStages: sourceToReview,
  },
  "ai-tool-handoff": {
    level: "通用能力层",
    businessStages: ["具体工作"],
    systemStages: ["资料读取 / 脱敏", "Skill 执行", "律师复核 / 归档"],
  },
  "transaction-structure-planning": {
    level: "专业法律工作层",
    businessStages: ["前期准备", "具体工作"],
    systemStages: sourceToReview,
  },
  "pe-vc-financing-doc-review": {
    level: "专业法律工作层",
    businessStages: ["具体工作"],
    systemStages: sourceToReview,
  },
  "diligence-issue-extraction": {
    level: "专业法律工作层",
    businessStages: ["具体工作"],
    systemStages: sourceToReview,
  },
  "tabular-review": {
    level: "专业法律工作层",
    businessStages: ["具体工作"],
    systemStages: sourceToReview,
  },
  "material-contract-schedule": {
    level: "专业法律工作层",
    businessStages: ["具体工作"],
    systemStages: sourceToReview,
  },
  "closing-checklist": {
    level: "专业法律工作层",
    businessStages: ["具体工作"],
    systemStages: executionToReview,
  },
  "integration-management": {
    level: "专业法律工作层",
    businessStages: ["具体工作"],
    systemStages: executionToReview,
  },
  "entity-compliance": {
    level: "专业法律工作层",
    businessStages: ["具体工作"],
    systemStages: executionToReview,
  },
  "deal-team-summary": {
    level: "文书交付层",
    businessStages: ["具体工作"],
    systemStages: ["结果整理", "律师复核 / 归档"],
  },
  "legal-service-proposal": {
    level: "文书交付层",
    businessStages: ["文书起草"],
    systemStages: executionToReview,
  },
  "quotation-letter": {
    level: "文书交付层",
    businessStages: ["文书起草"],
    systemStages: executionToReview,
  },
  "tender-response": {
    level: "文书交付层",
    businessStages: ["文书起草"],
    systemStages: executionToReview,
  },
  "drafting-legal-service-contracts": {
    level: "文书交付层",
    businessStages: ["文书起草"],
    systemStages: executionToReview,
  },
  "board-minutes": {
    level: "文书交付层",
    businessStages: ["文书起草"],
    systemStages: executionToReview,
  },
  "written-consent": {
    level: "文书交付层",
    businessStages: ["文书起草"],
    systemStages: executionToReview,
  },
});

export function getWorkflowProfile(toolId: string): WorkflowProfile | undefined {
  return toolWorkflowProfiles[toolId];
}
