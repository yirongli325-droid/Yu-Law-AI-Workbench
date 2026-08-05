"use client";

import { useMemo, useState } from "react";
import { categories, statuses, type Category, type ToolRecord, type ToolStatus } from "../../lib/tool-registry";
import { statusLabels } from "../../lib/tool-status";
import { ToolCard } from "./ToolCard";

const allStatuses = "all" as const;

export function WorkbenchShell({ tools }: { tools: readonly ToolRecord[] }) {
  const [category, setCategory] = useState<Category>("全部工具");
  const [status, setStatus] = useState<ToolStatus | typeof allStatuses>(allStatuses);
  const [query, setQuery] = useState("");

  const filteredTools = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("zh-CN");

    return tools.filter((tool) => {
      const matchesCategory = category === "全部工具" || tool.category === category;
      const matchesStatus = status === allStatuses || tool.status === status;
      const matchesKeyword =
        !keyword ||
        [tool.name, tool.category, tool.summary, ...tool.inputs, ...tool.outputs]
          .join(" ")
          .toLocaleLowerCase("zh-CN")
          .includes(keyword);
      return matchesCategory && matchesStatus && matchesKeyword;
    });
  }, [category, query, status, tools]);

  const hasFilters = category !== "全部工具" || status !== allStatuses || query.trim() !== "";

  function clearFilters() {
    setCategory("全部工具");
    setStatus(allStatuses);
    setQuery("");
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true">虞律</div>
        <div className="brand-copy">
          <p className="eyebrow">YU LAW TEAM</p>
          <p className="brand-name">虞律团队 AI 工作台</p>
        </div>
      </header>

      <section className="hero" aria-labelledby="workbench-title">
        <div>
          <p className="hero-kicker">AI TOOLBOX · INTERNAL</p>
          <h1 id="workbench-title">虞律团队 AI 工作台</h1>
          <p className="hero-subtitle">团队专属的 AI 工具与 Skill 统一入口</p>
        </div>
        <aside className="privacy-note" aria-label="数据安全提示">
          <span className="privacy-dot" aria-hidden="true" />
          <div>
            <strong>客户材料留在本机</strong>
            <p>本入口不会上传客户文件，仅提供工具导航与使用说明。</p>
          </div>
        </aside>
      </section>

      <div className="workbench-layout">
        <aside className="category-panel">
          <p className="panel-label">工具分类</p>
          <nav aria-label="工具分类">
            {categories.map((item) => {
              const count = item === "全部工具" ? tools.length : tools.filter((tool) => tool.category === item).length;
              return (
                <button
                  className={category === item ? "category-button is-active" : "category-button"}
                  type="button"
                  aria-pressed={category === item}
                  onClick={() => setCategory(item)}
                  key={item}
                >
                  <span>{item}</span>
                  <span className="category-count">{count}</span>
                </button>
              );
            })}
          </nav>
          <div className="sidebar-note">
            <span aria-hidden="true">01</span>
            <p>工具结果仅供工作辅助，关键结论须由经办律师复核。</p>
          </div>
        </aside>

        <main id="main-content" tabIndex={-1}>
          <div className="toolbar">
            <div className="search-field">
              <label htmlFor="tool-search">搜索工具</label>
              <input
                id="tool-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索名称、场景或输入输出"
              />
            </div>
            <div className="status-field">
              <label htmlFor="status-filter">接入状态</label>
              <select
                id="status-filter"
                value={status}
                onChange={(event) => setStatus(event.target.value as ToolStatus | typeof allStatuses)}
              >
                <option value={allStatuses}>全部状态</option>
                {statuses.map((item) => (
                  <option value={item} key={item}>{statusLabels[item]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="result-heading" aria-live="polite">
            <p><strong>{filteredTools.length}</strong> 个工具</p>
            <button
              className="clear-button"
              type="button"
              onClick={clearFilters}
              hidden={!hasFilters}
              disabled={!hasFilters}
            >
              清除筛选
            </button>
          </div>

          {filteredTools.length ? (
            <section className="tool-grid" aria-label="工具列表">
              {filteredTools.map((tool) => <ToolCard tool={tool} key={tool.id} />)}
            </section>
          ) : (
            <section className="empty-state" aria-live="polite">
              <p className="empty-index">00</p>
              <h2>暂未找到匹配工具</h2>
              <p>可以换一个关键词，或清除当前筛选条件。</p>
              <button className="action action-primary" type="button" onClick={clearFilters}>清除筛选</button>
            </section>
          )}
        </main>
      </div>

      <footer className="site-footer">
        <p>虞律团队 · 内部工作入口</p>
        <p>AI 提效，专业判断始终由律师完成。</p>
      </footer>
    </div>
  );
}
