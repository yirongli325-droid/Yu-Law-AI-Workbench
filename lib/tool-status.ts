import type { ToolStatus } from "./tool-registry";

export const statusLabels: Record<ToolStatus, string> = {
  connected: "已接入",
  installable: "可安装",
  building: "建设中",
  planned: "规划中",
};
