"use client";

import { useMemo } from "react";
import {
  Background,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type CardData = { label: string; active?: boolean; tone?: string };

function MiniNode({ data }: NodeProps) {
  const d = data as CardData;
  return (
    <div className={`rf-node tone-${d.tone ?? "default"} ${d.active ? "active" : ""}`}>
      <Handle type="target" position={Position.Top} className="rf-handle" />
      <strong>{d.label}</strong>
      <Handle type="source" position={Position.Bottom} className="rf-handle" />
    </div>
  );
}

const nodeTypes = { mini: MiniNode };

export function AuditRouteFlow({
  verdict,
}: {
  verdict: string | null;
}) {
  const path =
    verdict === "block"
      ? "block"
      : verdict === "review" || verdict === "needs_review"
        ? "review"
        : verdict === "fire"
          ? "fire"
          : null;

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [
      {
        id: "in",
        type: "mini",
        position: { x: 110, y: 0 },
        data: { label: "Decision in", tone: "mint", active: true },
      },
      {
        id: "gate",
        type: "mini",
        position: { x: 110, y: 70 },
        data: { label: "Confidence gate", tone: "ember", active: !!path },
      },
      {
        id: "fire",
        type: "mini",
        position: { x: 0, y: 150 },
        data: { label: "Fire", tone: "ember", active: path === "fire" },
      },
      {
        id: "block",
        type: "mini",
        position: { x: 110, y: 150 },
        data: { label: "Block", tone: "danger", active: path === "block" },
      },
      {
        id: "review",
        type: "mini",
        position: { x: 220, y: 150 },
        data: { label: "Review", tone: "info", active: path === "review" },
      },
    ];

    const mk = (id: string, s: string, t: string, hot: boolean): Edge => ({
      id,
      source: s,
      target: t,
      animated: hot,
      style: { stroke: hot ? "#e0703c" : "#314056", strokeWidth: hot ? 2 : 1.2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: hot ? "#e0703c" : "#314056",
        width: 12,
        height: 12,
      },
    });

    const edges: Edge[] = [
      mk("a", "in", "gate", !!path),
      mk("b", "gate", "fire", path === "fire"),
      mk("c", "gate", "block", path === "block"),
      mk("d", "gate", "review", path === "review"),
    ];

    return { nodes, edges };
  }, [path]);

  return (
    <div className="rf-shell">
      <p className="kicker">routing path</p>
      <div className="rf-canvas rf-canvas-audit">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          preventScrolling
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={14} size={1} color="#222b38" />
        </ReactFlow>
      </div>
    </div>
  );
}
