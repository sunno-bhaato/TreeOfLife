"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import PersonNode from "./PersonNode";
import UnionNode from "./UnionNode";
import { NH, NW, buildGraph, initialPositions, type Pos } from "@/lib/graph";
import type { Labels } from "@/lib/i18n";
import type { Person, Union } from "@/lib/types";

const nodeTypes = { person: PersonNode, union: UnionNode };

export type TreeCanvasProps = {
  people: Person[];
  unions: Union[];
  /** true = admin (can draw/delete arrows, positions are saved). false = public, view only. */
  editable: boolean;
  labels: Labels;
  onOpen?: (id: string) => void;
  onSelect?: (id: string | null) => void;
  onConnectPeople?: (c: Connection) => void;
  onDeleteEdges?: (edges: Edge[]) => void;
  onMovePeople?: (moves: { id: string; x: number; y: number }[]) => void;
};

function Inner({
  people,
  unions,
  editable,
  labels,
  onOpen,
  onSelect,
  onConnectPeople,
  onDeleteEdges,
  onMovePeople,
}: TreeCanvasProps) {
  const rf = useReactFlow();
  const [positions, setPositions] = useState<Record<string, Pos>>(() =>
    initialPositions(people, unions)
  );
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdges, setSelectedEdges] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");

  // Whenever the saved data changes, go back to the saved arrangement.
  useEffect(() => {
    setPositions(initialPositions(people, unions));
  }, [people, unions]);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  useEffect(() => {
    onSelectRef.current?.(selectedNode);
  }, [selectedNode]);

  const graph = useMemo(
    () => buildGraph(people, unions, positions, { editable, selectedNode, selectedEdges }),
    [people, unions, positions, editable, selectedNode, selectedEdges]
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const moves: Record<string, Pos> = {};
    for (const c of changes) {
      if (c.type === "position" && c.position) {
        if (!c.id.startsWith("u:")) moves[c.id] = c.position;
      } else if (c.type === "select") {
        if (c.id.startsWith("u:")) continue;
        if (c.selected) setSelectedNode(c.id);
        else setSelectedNode((cur) => (cur === c.id ? null : cur));
      }
    }
    if (Object.keys(moves).length) setPositions((prev) => ({ ...prev, ...moves }));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const c of changes) {
      if (c.type !== "select") continue;
      setSelectedEdges((prev) => {
        const next = new Set(prev);
        if (c.selected) next.add(c.id);
        else next.delete(c.id);
        return next;
      });
    }
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return people.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, people]);

  const focusPerson = (id: string) => {
    const p = positions[id];
    if (!p) return;
    setSelectedNode(id);
    setQuery("");
    rf.setCenter(p.x + NW / 2, p.y + NH / 2, { zoom: 1.2, duration: 500 });
  };

  return (
    <ReactFlow
      className={editable ? "canvas canvas-admin" : "canvas canvas-public"}
      nodes={graph.nodes}
      edges={graph.edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => {
        if (node.type === "person" && !editable) onOpen?.(node.id);
      }}
      onNodeDragStop={(_e, _node, dragged: Node[]) => {
        if (!editable) return;
        const moves = dragged
          .filter((n) => n.type === "person")
          .map((n) => ({ id: n.id, x: n.position.x, y: n.position.y }));
        if (moves.length) onMovePeople?.(moves);
      }}
      onConnect={editable ? onConnectPeople : undefined}
      onEdgesDelete={editable ? onDeleteEdges : undefined}
      onBeforeDelete={async ({ nodes, edges }) => (nodes.length > 0 ? false : { nodes, edges })}
      deleteKeyCode={editable ? ["Backspace", "Delete"] : null}
      nodesConnectable={editable}
      connectionMode={ConnectionMode.Loose}
      fitView
      fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
      minZoom={0.08}
      maxZoom={2.5}
      zoomOnDoubleClick={false}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#C9D3CD" />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => (n.type === "union" ? "#B8862B" : "#2F5D4E")}
        maskColor="rgba(241,243,240,0.75)"
      />

      <Panel position="top-left" className="topbar">
        <h1 className="brand">{labels.title}</h1>
        <div className="search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.search}
            aria-label={labels.search}
            autoComplete="off"
          />
          {query.trim() !== "" && (
            <ul className="results">
              {matches.length === 0 && <li className="muted">{labels.noMatch}</li>}
              {matches.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => focusPerson(p.id)}>
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Panel position="bottom-left" className="zoombar">
        <button type="button" onClick={() => rf.zoomIn({ duration: 200 })} aria-label={labels.zoomIn} title={labels.zoomIn}>
          +
        </button>
        <button type="button" onClick={() => rf.zoomOut({ duration: 200 })} aria-label={labels.zoomOut} title={labels.zoomOut}>
          −
        </button>
        <button type="button" onClick={() => rf.fitView({ padding: 0.25, maxZoom: 1, duration: 400 })}>
          {labels.fit}
        </button>
        {!editable && (
          <button
            type="button"
            onClick={() => {
              setPositions(initialPositions(people, unions));
              setTimeout(() => rf.fitView({ padding: 0.25, maxZoom: 1, duration: 400 }), 30);
            }}
          >
            {labels.reset}
          </button>
        )}
      </Panel>

      {people.length === 0 && <div className="empty">{labels.empty}</div>}
    </ReactFlow>
  );
}

export default function TreeCanvas(props: TreeCanvasProps) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}
