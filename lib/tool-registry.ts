import toolData from "../data/tools.json" with { type: "json" };

export const categories = [
  "全部工具",
  "数据安全",
  "基础工作",
  "文书制作",
  "专业法律分析",
] as const;

export const statuses = ["connected", "installable", "planned", "building"] as const;

export type Category = (typeof categories)[number];
export type ToolStatus = (typeof statuses)[number];

export type ToolRecord = {
  id: string;
  name: string;
  category: Exclude<Category, "全部工具">;
  status: ToolStatus;
  summary: string;
  version: string;
  repository?: string | null;
  localUrl?: string | null;
  inputs: string[];
  outputs: string[];
  steps: string[];
  notice: string;
};

export const tools = toolData as ToolRecord[];

export function getTool(toolId: string): ToolRecord | undefined {
  return tools.find((tool) => tool.id === toolId);
}
