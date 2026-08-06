"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ToolRecord } from "../../lib/tool-registry";
import {
  businessStages,
  getWorkflowProfile,
  systemStages,
  workflowLevels,
  type SystemStage,
} from "../../lib/tool-workflow";

export function WorkflowMap({ tools }: { tools: readonly ToolRecord[] }) {
  const [activeStage, setActiveStage] = useState<SystemStage | null>(null);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.id === selectedToolId),
    [selectedToolId, tools],
  );
  const selectedProfile = selectedTool ? getWorkflowProfile(selectedTool.id) : undefined;

  function isRelevant(tool: ToolRecord) {
    if (!activeStage) return true;
    return getWorkflowProfile(tool.id)?.systemStages.includes(activeStage) ?? false;
  }

  function selectTool(toolId: string) {
    const profile = getWorkflowProfile(toolId);
    setSelectedToolId(toolId);
    setActiveStage(null);
    if (!profile) setSelectedToolId(null);
  }

  return (
    <section className="workflow-view" aria-labelledby="workflow-map-title">
      <div className="workflow-heading">
        <div>
          <p className="panel-label">任务流程</p>
          <h2 id="workflow-map-title">从律师发起任务到复核归档</h2>
        </div>
        <p>横向看业务阶段，纵向看能力层级。点击流程环节可查看相关 Skill。</p>
      </div>

      <div className="system-flow" aria-label="任务运行流程">
        {systemStages.map((stage) => (
          <button
            className={activeStage === stage ? "flow-stage is-active" : "flow-stage"}
            type="button"
            aria-pressed={activeStage === stage}
            onClick={() => {
              setActiveStage(activeStage === stage ? null : stage);
              setSelectedToolId(null);
            }}
            key={stage}
          >
            {stage}
          </button>
        ))}
      </div>

      <div className="workflow-matrix">
        <div className="workflow-matrix-head" aria-hidden="true">
          <span>能力层级</span>
          {businessStages.map((stage) => <span key={stage}>{stage}</span>)}
        </div>

        {workflowLevels.map((level) => (
          <section className="workflow-row" aria-label={level} key={level}>
            <div className="workflow-level">
              <strong>{level}</strong>
              <span>{level === "通用能力层" ? "整理任务与材料" : level === "专业法律工作层" ? "分析、审阅与项目管理" : "形成可复核交付物"}</span>
            </div>
            {businessStages.map((businessStage) => (
              <div className="workflow-cell" data-stage={businessStage} key={businessStage}>
                <div className="workflow-tool-list">
                  {tools
                    .filter((tool) => {
                      const profile = getWorkflowProfile(tool.id);
                      return profile?.level === level && profile.businessStages.includes(businessStage);
                    })
                    .map((tool) => (
                      <button
                        className={`workflow-tool${selectedToolId === tool.id ? " is-selected" : ""}${isRelevant(tool) ? "" : " is-dimmed"}`}
                        data-workflow-tool={tool.id}
                        type="button"
                        onClick={() => selectTool(tool.id)}
                        key={`${businessStage}-${tool.id}`}
                      >
                        {tool.name}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </section>
        ))}

        <section className="workflow-safeguard-row" aria-label="入口与保障层">
          <div className="workflow-level">
            <strong>入口与保障层</strong>
            <span>贯穿全部业务阶段</span>
          </div>
          <div className="workflow-safeguards">
            {tools
              .filter((tool) => getWorkflowProfile(tool.id)?.level === "入口与保障层")
              .map((tool) => (
                <button
                  className={`workflow-tool${selectedToolId === tool.id ? " is-selected" : ""}${isRelevant(tool) ? "" : " is-dimmed"}`}
                  data-workflow-tool={tool.id}
                  type="button"
                  onClick={() => selectTool(tool.id)}
                  key={tool.id}
                >
                  {tool.name}
                </button>
              ))}
          </div>
        </section>
      </div>

      <div className="workflow-selection" aria-live="polite">
        {selectedTool && selectedProfile ? (
          <>
            <div>
              <strong>{selectedTool.name}</strong>
              <p>{selectedProfile.level} · {selectedProfile.businessStages.join("、")}</p>
            </div>
            <p className="workflow-route">{selectedProfile.systemStages.join(" → ")}</p>
            <Link href={`/tools/${selectedTool.id}`}>查看使用说明 →</Link>
          </>
        ) : activeStage ? (
          <p><strong>{activeStage}</strong>：已高亮本环节相关的 Skill。</p>
        ) : (
          <p>选择一个流程环节或 Skill，查看它在整个工作流中的位置。</p>
        )}
      </div>
    </section>
  );
}
