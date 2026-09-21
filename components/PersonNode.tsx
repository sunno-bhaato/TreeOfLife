"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { Person } from "@/lib/types";

export type PersonNodeData = { person: Person; editable: boolean };
export type PersonFlowNode = Node<PersonNodeData, "person">;

export default function PersonNode({ data, selected }: NodeProps<PersonFlowNode>) {
  const { person, editable } = data;
  const first = Array.from(person.name.trim())[0] ?? "•";
  const cls = "person-node" + (selected ? " is-selected" : "") + (editable ? " is-editable" : "");
  return (
    <div className={cls} title={person.name}>
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <span className="avatar" aria-hidden="true">
        {person.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.photo_url} alt="" loading="lazy" draggable={false} />
        ) : (
          first
        )}
      </span>
      <span className="pname">{person.name}</span>
    </div>
  );
}
