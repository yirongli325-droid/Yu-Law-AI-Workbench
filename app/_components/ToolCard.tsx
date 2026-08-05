import Link from "next/link";
import type { ToolRecord } from "../../lib/tool-registry";
import { statusLabels } from "../../lib/tool-status";
import { ToolActions } from "./ToolActions";

export function ToolCard({ tool }: { tool: ToolRecord }) {
  const featured = tool.id === "local-legal-redaction";

  return (
    <article className={`tool-card${featured ? " tool-card-featured" : ""}`}>
      <div className="card-topline">
        <span className="category-label">{tool.category}</span>
        <span className={`status-badge status-${tool.status}`}>{statusLabels[tool.status]}</span>
      </div>
      {featured ? <p className="featured-label">优先推荐 · 全程本机处理</p> : null}
      <h2>
        <Link href={`/tools/${tool.id}`}>{tool.name}</Link>
      </h2>
      <p className="tool-summary">{tool.summary}</p>
      <div className="card-footer">
        <ToolActions
          localUrl={tool.localUrl}
          repository={tool.repository}
          status={tool.status}
          compact
        />
        <Link className="detail-link" href={`/tools/${tool.id}`}>
          查看详情 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
