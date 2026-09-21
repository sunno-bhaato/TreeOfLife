import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { Person, Union } from "./types";

/* ---------- geometry ---------- */
export const NW = 168; // person node width
export const NH = 56; // person node height
export const SP_GAP = 96; // gap between spouses (children descend from its midpoint)
export const H_GAP = 36; // gap between sibling branches
export const LEVEL_H = 180; // vertical distance between generations
export const JR = 6; // radius of the marriage dot

export type Pos = { x: number; y: number };

export type EdgeData = {
  kind: "spouse" | "single" | "child";
  unionId: string;
  childId?: string;
};

/* ---------- helpers ---------- */
export function unionsOfPerson(id: string, unions: Union[]): Union[] {
  return unions.filter((u) => u.a_id === id || u.b_id === id);
}

/** True if `candidateId` is `ofId` itself or one of its ancestors. */
export function isAncestor(
  candidateId: string,
  ofId: string,
  people: Person[],
  unions: Union[]
): boolean {
  const pm = new Map(people.map((p) => [p.id, p]));
  const um = new Map(unions.map((u) => [u.id, u]));
  const seen = new Set<string>();
  const stack = [ofId];
  while (stack.length) {
    const id = stack.pop() as string;
    if (id === candidateId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const p = pm.get(id);
    const u = p?.parent_union_id ? um.get(p.parent_union_id) : undefined;
    if (u) {
      stack.push(u.a_id);
      if (u.b_id) stack.push(u.b_id);
    }
  }
  return false;
}

/* ---------- automatic layout (one root ancestor, top to bottom) ---------- */
export function autoLayout(people: Person[], unions: Union[]): Record<string, Pos> {
  const ids = new Set(people.map((p) => p.id));
  const unionsOf = new Map<string, Union[]>(); // unions where the person is `a` (blood side)
  for (const u of unions) {
    if (!ids.has(u.a_id)) continue;
    const list = unionsOf.get(u.a_id) ?? [];
    list.push(u);
    unionsOf.set(u.a_id, list);
  }
  const childrenOf = new Map<string, Person[]>(); // by union id
  for (const p of people) {
    if (!p.parent_union_id) continue;
    const list = childrenOf.get(p.parent_union_id) ?? [];
    list.push(p);
    childrenOf.set(p.parent_union_id, list);
  }
  const marriedIn = new Set<string>();
  for (const u of unions) if (u.b_id) marriedIn.add(u.b_id);

  const widths = new Map<string, number>();
  const measured = new Set<string>();

  const coupleUnions = (id: string) => (unionsOf.get(id) ?? []).filter((u) => u.b_id && ids.has(u.b_id));
  const kidsOf = (id: string) => (unionsOf.get(id) ?? []).flatMap((u) => childrenOf.get(u.id) ?? []);

  const measure = (id: string): number => {
    if (measured.has(id)) return widths.get(id) ?? NW;
    measured.add(id);
    const n = coupleUnions(id).length;
    const rowW = NW * (1 + n) + SP_GAP * n;
    const kids = kidsOf(id);
    let cw = 0;
    for (const k of kids) cw += measure(k.id) + H_GAP;
    if (kids.length) cw -= H_GAP;
    const w = Math.max(rowW, cw);
    widths.set(id, w);
    return w;
  };

  const out: Record<string, Pos> = {};
  let maxDepth = 0;

  const place = (id: string, left: number, depth: number) => {
    if (out[id]) return;
    maxDepth = Math.max(maxDepth, depth);
    const w = widths.get(id) ?? NW;
    const couples = coupleUnions(id);
    const n = couples.length;
    const leftCount = Math.floor(n / 2);
    const rowW = NW * (1 + n) + SP_GAP * n;
    const rowStart = left + (w - rowW) / 2;
    const y = depth * LEVEL_H;
    const x0 = rowStart + leftCount * (NW + SP_GAP);
    out[id] = { x: x0, y };
    let r = 0;
    let l = 0;
    couples.forEach((u, i) => {
      const spouseId = u.b_id as string;
      if (i % 2 === 0) {
        r += 1;
        out[spouseId] = { x: x0 + r * (NW + SP_GAP), y };
      } else {
        l += 1;
        out[spouseId] = { x: x0 - l * (NW + SP_GAP), y };
      }
    });
    const kids = kidsOf(id);
    let cw = 0;
    for (const k of kids) cw += (widths.get(k.id) ?? NW) + H_GAP;
    if (kids.length) cw -= H_GAP;
    let x = left + (w - cw) / 2;
    for (const k of kids) {
      place(k.id, x, depth + 1);
      x += (widths.get(k.id) ?? NW) + H_GAP;
    }
  };

  const roots = people.filter((p) => !p.parent_union_id && !marriedIn.has(p.id));
  let cursor = 0;
  for (const r of roots) {
    const w = measure(r.id);
    place(r.id, cursor, 0);
    cursor += w + H_GAP * 2;
  }
  // Anything left over (unusual links) goes on a row underneath.
  let extraX = 0;
  for (const p of people) {
    if (out[p.id]) continue;
    out[p.id] = { x: extraX, y: (maxDepth + 1) * LEVEL_H };
    extraX += NW + H_GAP;
  }
  return out;
}

export function initialPositions(people: Person[], unions: Union[]): Record<string, Pos> {
  const allZero = people.length > 1 && people.every((p) => p.pos_x === 0 && p.pos_y === 0);
  if (allZero) return autoLayout(people, unions);
  const out: Record<string, Pos> = {};
  for (const p of people) out[p.id] = { x: p.pos_x, y: p.pos_y };
  return out;
}

/* ---------- React Flow nodes and edges ---------- */
export function buildGraph(
  people: Person[],
  unions: Union[],
  pos: Record<string, Pos>,
  opts: { editable: boolean; selectedNode: string | null; selectedEdges: Set<string> }
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const at = (p: Person): Pos => pos[p.id] ?? { x: p.pos_x, y: p.pos_y };
  const byId = new Map(people.map((p) => [p.id, p]));

  for (const p of people) {
    nodes.push({
      id: p.id,
      type: "person",
      position: at(p),
      data: { person: p, editable: opts.editable },
      width: NW,
      height: NH,
      selected: opts.selectedNode === p.id,
      deletable: false,
    });
  }

  const unionIds = new Set<string>();
  const arrow = { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "#2F5D4E" };

  for (const u of unions) {
    const pa = byId.get(u.a_id);
    if (!pa) continue;
    const pb = u.b_id ? byId.get(u.b_id) : undefined;
    const a = at(pa);
    const ca = { x: a.x + NW / 2, y: a.y + NH / 2 };
    let jx: number;
    let jy: number;
    let cb: Pos | null = null;
    if (pb) {
      const b = at(pb);
      cb = { x: b.x + NW / 2, y: b.y + NH / 2 };
      jx = (ca.x + cb.x) / 2;
      jy = (ca.y + cb.y) / 2;
    } else {
      jx = ca.x;
      jy = a.y + NH + 30;
    }
    const jid = "u:" + u.id;
    unionIds.add(u.id);

    nodes.push({
      id: jid,
      type: "union",
      position: { x: jx - JR, y: jy - JR },
      data: { single: !pb },
      width: JR * 2,
      height: JR * 2,
      draggable: false,
      selectable: false,
      connectable: false,
      deletable: false,
      focusable: false,
    });

    if (pb && cb) {
      const pairs: Array<["a" | "b", string, Pos]> = [
        ["a", pa.id, ca],
        ["b", pb.id, cb],
      ];
      for (const [side, personId, c] of pairs) {
        const fromLeft = c.x < jx;
        const id = `s${side}:${u.id}`;
        edges.push({
          id,
          source: personId,
          target: jid,
          sourceHandle: fromLeft ? "right" : "left",
          targetHandle: fromLeft ? "jl" : "jr",
          type: "straight",
          className: "edge-spouse",
          selectable: opts.editable,
          deletable: opts.editable,
          selected: opts.selectedEdges.has(id),
          data: { kind: "spouse", unionId: u.id },
        });
      }
    } else {
      const id = "s1:" + u.id;
      edges.push({
        id,
        source: pa.id,
        target: jid,
        sourceHandle: "bottom",
        targetHandle: "jt",
        type: "straight",
        className: "edge-single",
        selectable: opts.editable,
        deletable: opts.editable,
        selected: opts.selectedEdges.has(id),
        data: { kind: "single", unionId: u.id },
      });
    }
  }

  for (const p of people) {
    if (!p.parent_union_id || !unionIds.has(p.parent_union_id)) continue;
    const id = "c:" + p.id;
    edges.push({
      id,
      source: "u:" + p.parent_union_id,
      target: p.id,
      sourceHandle: "jb",
      targetHandle: "top",
      type: "smoothstep",
      className: "edge-child",
      markerEnd: arrow,
      selectable: opts.editable,
      deletable: opts.editable,
      selected: opts.selectedEdges.has(id),
      data: { kind: "child", unionId: p.parent_union_id, childId: p.id },
    });
  }

  return { nodes, edges };
}
