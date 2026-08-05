import type { ToolRecord } from "../../lib/tool-registry";

type ToolActionsProps = Pick<ToolRecord, "localUrl" | "repository" | "status"> & {
  compact?: boolean;
};

export function ToolActions({ localUrl, repository, status, compact = false }: ToolActionsProps) {
  if (!localUrl && !repository) {
    return (
      <span className="unavailable-action" aria-label="工具接入状态">
        {status === "local-skill"
          ? "通过本地 Codex 调用"
          : status === "building"
            ? "建设中"
            : "等待接入"}
      </span>
    );
  }

  return (
    <div className={`tool-actions${compact ? " tool-actions-compact" : ""}`}>
      {localUrl ? (
        <a className="action action-primary" href={localUrl}>
          打开本地工具
        </a>
      ) : null}
      {repository ? (
        <a
          className="action action-secondary"
          href={repository}
          target="_blank"
          rel="noreferrer"
        >
          安装 / 查看 GitHub
        </a>
      ) : null}
    </div>
  );
}
