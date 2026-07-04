"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Handle,
  Node,
  Position,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { CalculationResult } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// PRD §7: tree/flow view of the derivation — hajb exclusions, furud assignment, asabah
// distribution — with citations on hover. The estate flows to each awarded heir (colored
// by category); blocked heirs hang off the heir that excluded them (dashed red edge).

interface NodeData {
  title: string;
  sub: string;
  variant: "root" | "furud" | "asabah" | "radd" | "blocked" | "stage";
  hover?: string;
}

function FlowNode({ data }: { data: NodeData }) {
  const cls = `rf-node rf-${data.variant}`;
  return (
    <div className={cls} title={data.hover}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="rf-title">{data.title}</div>
      <div className="rf-sub">{data.sub}</div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { faraid: FlowNode };

export default function DerivationFlow({ result }: { result: CalculationResult }) {
  const { lang, t } = useI18n();
  const { nodes, edges } = useMemo(() => {
    const nodes: Node<NodeData>[] = [];
    const edges: Edge[] = [];
    const src = result.sources;

    const awarded = result.shares.filter((s) => s.category !== "harta_bersama");
    const rootSub = `${t("pokok_masalah")} ${result.pokok_masalah}${
      result.aul_applied ? ` · 'aul → ${result.aul_base}` : ""
    }${result.radd_applied ? " · radd" : ""}`;

    nodes.push({
      id: "root",
      type: "faraid",
      position: { x: 0, y: Math.max(60, (awarded.length * 92) / 2 - 40) },
      data: { title: t('divisible_estate'), sub: rootSub, variant: "root" },
    });

    const relationToNode: Record<string, string> = {};
    awarded.forEach((s, i) => {
      const id = `share-${i}`;
      relationToNode[s.relation] = id;
      const variant = (s.category === "furud" || s.category === "asabah" || s.category === "radd"
        ? s.category
        : "furud") as NodeData["variant"];
      const cite = src[s.source_id];
      nodes.push({
        id,
        type: "faraid",
        position: { x: 360, y: i * 92 },
        data: {
          title: `${s.label}${s.count > 1 ? ` ×${s.count}` : ""}`,
          sub: `${s.share.text} · ${s.category_label}`,
          variant,
          hover: `${s.reason}${cite ? `  [${cite.reference}]` : ""}`,
        },
      });
      edges.push({
        id: `e-root-${id}`,
        source: "root",
        target: id,
        label: s.share.text,
        animated: s.category === "asabah",
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    });

    result.blocked.forEach((b, i) => {
      const id = `blocked-${i}`;
      const cite = src[b.source_id];
      nodes.push({
        id,
        type: "faraid",
        position: { x: 720, y: i * 92 },
        data: {
          title: `${b.label}${b.count > 1 ? ` ×${b.count}` : ""}`,
          sub: t("blocked_title"),
          variant: "blocked",
          hover: `${b.reason}${cite ? `  [${cite.reference}]` : ""}`,
        },
      });
      const source = relationToNode[b.blocked_by] ?? "root";
      edges.push({
        id: `e-${source}-${id}`,
        source,
        target: id,
        label: lang === "id" ? "terhalang" : "blocked",
        style: { stroke: "var(--blocked)", strokeDasharray: "5 4" },
        labelStyle: { fill: "var(--blocked)" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--blocked)" },
      });
    });

    return { nodes, edges };
  }, [result, lang, t]);

  return (
    <div className="flow-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        minZoom={0.3}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
