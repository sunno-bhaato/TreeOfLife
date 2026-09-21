"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export type UnionNodeData = { single: boolean };
export type UnionFlowNode = Node<UnionNodeData, "union">;

/** The small ring on the line between two spouses. Children's arrows start here. */
export default function UnionNode({ data }: NodeProps<UnionFlowNode>) {
  return (
    <div className={"union-dot" + (data.single ? " single" : "")}>
      <Handle type="target" position={Position.Left} id="jl" />
      <Handle type="target" position={Position.Right} id="jr" />
      <Handle type="target" position={Position.Top} id="jt" />
      <Handle type="source" position={Position.Bottom} id="jb" />
    </div>
  );
}
