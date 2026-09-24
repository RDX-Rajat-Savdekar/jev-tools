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

type Phase = "idle" | "sweeping" | "done";

type CardData = {
  label: string;
  sub?: string;
  active?: boolean;
  done?: boolean;
};

function CalNode({ data }: NodeProps) {
  const d = data as CardData;
  return (
    <div
      className={`rf-node tone-ember ${d.active ? "active" : ""} ${d.done ? "done" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="rf-handle" />
      <strong>{d.label}</strong>
      {d.sub ? <span>{d.sub}</span> : null}
      <Handle type="source" position={Position.Right} className="rf-handle" />
    </div>
  );
}

const nodeTypes = { cal: CalNode };

export function CalibrationFlow({
  phase,
  revealed,
  total,
}: {
  phase: Phase;
  revealed: number;
  total: number;
}) {
  const step =
    phase === "done"
      ? 4
      : phase === "sweeping"
        ? Math.min(3, 1 + Math.floor((revealed / Math.max(total, 1)) * 3))
        : 0;

  const { nodes, edges } = useMemo(() => {
    const labels = [
      { id: "seed", label: "Seed cases", sub: `${total} examples` },
      { id: "perturb", label: "Perturb prompts", sub: "variants" },
      { id: "score", label: "Score ECE", sub: "Brier · bins" },
      { id: "lock", label: "Lock thresholds", sub: "production" },
    ];

    const nodes: Node[] = labels.map((l, i) => ({
      id: l.id,
      type: "cal",
      position: { x: i * 190, y: 36 },
      data: {
        label: l.label,
        sub: l.sub,
        active: step === i + 1 || (phase === "sweeping" && i < step),
        done: phase === "done" || i < step,
      },
    }));

    const edges: Edge[] = labels.slice(0, -1).map((l, i) => {
      const hot = step > i + 1 || phase === "done" || (phase === "sweeping" && step >= i + 1);
      return {
        id: `c${i}`,
        source: l.id,
        target: labels[i + 1].id,
        animated: phase === "sweeping" && step === i + 1,
        style: {
          stroke: hot ? "#2dd4a8" : "#314056",
          strokeWidth: hot ? 2.2 : 1.2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: hot ? "#2dd4a8" : "#314056",
          width: 14,
          height: 14,
        },
      };
    });

    return { nodes, edges };
  }, [phase, step, total]);

  return (
    <div className="rf-shell rf-shell-bench">
      <p className="kicker">calibration graph</p>
      <div className="rf-canvas rf-canvas-sm">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          preventScrolling
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={1} color="#222b38" />
        </ReactFlow>
      </div>
    </div>
  );
}
