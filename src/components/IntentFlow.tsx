"use client";

import { useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export type FlowPhase =
  | "idle"
  | "listening"
  | "fired"
  | "blocked"
  | "review";

type FlowNodeData = {
  label: string;
  sub?: string;
  tone?: "default" | "mint" | "ember" | "danger" | "info";
  active?: boolean;
};

function FlowCard({ data }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <div
      className={`rf-node tone-${d.tone ?? "default"} ${d.active ? "active" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="rf-handle" />
      <strong>{d.label}</strong>
      {d.sub ? <span>{d.sub}</span> : null}
      <Handle type="source" position={Position.Right} className="rf-handle" />
    </div>
  );
}

const nodeTypes = { flowCard: FlowCard };

function buildGraph(phase: FlowPhase, active: boolean): {
  nodes: Node[];
  edges: Edge[];
} {
  const path =
    phase === "blocked"
      ? "block"
      : phase === "review"
        ? "review"
        : phase === "fired"
          ? "fire"
          : active || phase === "listening"
            ? "mid"
            : "idle";

  const on = (ids: string[]) => new Set(ids);

  const lit =
    path === "fire"
      ? on(["hear", "decide", "fire", "audit"])
      : path === "block"
        ? on(["hear", "decide", "block", "audit"])
        : path === "review"
          ? on(["hear", "decide", "review", "audit"])
          : path === "mid"
            ? on(["hear", "decide"])
            : on([]);

  const nodes: Node[] = [
    {
      id: "hear",
      type: "flowCard",
      position: { x: 0, y: 88 },
      data: {
        label: "Hear",
        sub: "partial transcript",
        tone: "mint",
        active: lit.has("hear"),
      },
    },
    {
      id: "decide",
      type: "flowCard",
      position: { x: 200, y: 88 },
      data: {
        label: "Jev decide",
        sub: "choice · score · noul",
        tone: "ember",
        active: lit.has("decide"),
      },
    },
    {
      id: "fire",
      type: "flowCard",
      position: { x: 420, y: 0 },
      data: {
        label: "Fire early",
        sub: "acted mid-sentence",
        tone: "ember",
        active: lit.has("fire"),
      },
    },
    {
      id: "block",
      type: "flowCard",
      position: { x: 420, y: 88 },
      data: {
        label: "Hard block",
        sub: "stop dangerous cmd",
        tone: "danger",
        active: lit.has("block"),
      },
    },
    {
      id: "review",
      type: "flowCard",
      position: { x: 420, y: 176 },
      data: {
        label: "Ask human",
        sub: "low confidence",
        tone: "info",
        active: lit.has("review"),
      },
    },
    {
      id: "audit",
      type: "flowCard",
      position: { x: 640, y: 88 },
      data: {
        label: "Audit ledger",
        sub: "append-only",
        tone: "mint",
        active: lit.has("audit"),
      },
    },
  ];

  const edge = (
    id: string,
    source: string,
    target: string,
    hot: boolean,
  ): Edge => ({
    id,
    source,
    target,
    animated: hot,
    style: {
      stroke: hot ? "#e0703c" : "#314056",
      strokeWidth: hot ? 2.2 : 1.2,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: hot ? "#e0703c" : "#314056",
      width: 16,
      height: 16,
    },
  });

  const edges: Edge[] = [
    edge("e1", "hear", "decide", lit.has("hear") && lit.has("decide")),
    edge("e2", "decide", "fire", lit.has("fire") || path === "mid"),
    edge("e3", "decide", "block", lit.has("block")),
    edge("e4", "decide", "review", lit.has("review")),
    edge("e5", "fire", "audit", lit.has("fire") && lit.has("audit")),
    edge("e6", "block", "audit", lit.has("block") && lit.has("audit")),
    edge("e7", "review", "audit", lit.has("review") && lit.has("audit")),
  ];

  if (path === "mid") {
    edges[1].animated = true;
    edges[1].style = { stroke: "#e0703c", strokeWidth: 2 };
  }

  return { nodes, edges };
}

export function IntentFlow({
  phase = "idle",
  active = false,
}: {
  phase?: FlowPhase;
  active?: boolean;
}) {
  const { nodes, edges } = useMemo(
    () => buildGraph(phase, active),
    [phase, active],
  );

  useEffect(() => {
    // ensure xyflow measures after mount on dashboard layouts
  }, [phase]);

  return (
    <div className="rf-shell">
      <p className="kicker">live decision graph</p>
      <div className="rf-canvas">
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
          zoomOnPinch={false}
          preventScrolling
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} size={1} color="#222b38" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
