import Link from "next/link";
import { notFound } from "next/navigation";
import { ToolActions } from "../../_components/ToolActions";
import { getTool, tools } from "../../../lib/tool-registry";
import { statusLabels } from "../../../lib/tool-status";

export function generateStaticParams() {
  return tools.map((tool) => ({ toolId: tool.id }));
}

export default async function ToolDetailPage({ params }: { params: Promise<{ toolId: string }> }) {
  const { toolId } = await params;
  const tool = getTool(toolId);

  if (!tool) notFound();

  return (
    <main id="main-content" className="detail-page" tabIndex={-1}>
      <Link className="back-link" href="/">← 返回工具箱</Link>

      <article className="detail-card">
        <header className="detail-header">
          <div>
            <p className="detail-overline">{tool.category} · {statusLabels[tool.status]}</p>
            <h1>{tool.name}</h1>
            <p className="detail-summary">{tool.summary}</p>
          </div>
          <dl className="detail-meta">
            <div><dt>状态</dt><dd>{statusLabels[tool.status]}</dd></div>
            <div><dt>版本</dt><dd>{tool.version}</dd></div>
          </dl>
        </header>

        <ToolActions localUrl={tool.localUrl} repository={tool.repository} status={tool.status} />

        <div className="detail-columns">
          <section className="detail-section" aria-labelledby="inputs-heading">
            <p className="section-index" aria-hidden="true">01</p>
            <h2 id="inputs-heading">输入材料</h2>
            <ul>{tool.inputs.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section className="detail-section" aria-labelledby="outputs-heading">
            <p className="section-index" aria-hidden="true">02</p>
            <h2 id="outputs-heading">输出结果</h2>
            <ul>{tool.outputs.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </div>

        <section className="steps-section" aria-labelledby="steps-heading">
          <div className="section-title-row">
            <p className="section-index" aria-hidden="true">03</p>
            <h2 id="steps-heading">使用步骤</h2>
          </div>
          <ol>
            {tool.steps.map((step, index) => (
              <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>
            ))}
          </ol>
        </section>

        <aside className="notice-box">
          <p className="section-index" aria-hidden="true">须知</p>
          <div><h2>使用提示</h2><p>{tool.notice}</p></div>
        </aside>
      </article>
    </main>
  );
}
