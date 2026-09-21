"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Connection, Edge } from "@xyflow/react";
import TreeCanvas from "./TreeCanvas";
import { fetchTree, getSupabase, removePhoto, uploadPhoto } from "@/lib/supabase";
import {
  H_GAP,
  LEVEL_H,
  NW,
  SP_GAP,
  autoLayout,
  isAncestor,
  unionsOfPerson,
  type EdgeData,
} from "@/lib/graph";
import { en } from "@/lib/i18n";
import type { Person, Union } from "@/lib/types";

const errText = (e: unknown): string =>
  e && typeof e === "object" && "message" in e
    ? String((e as { message: unknown }).message)
    : "Something went wrong.";

async function insertPerson(
  name: string,
  file: File | null,
  pos: { x: number; y: number },
  parentUnionId: string | null = null
): Promise<Person> {
  const sb = getSupabase();
  const photo_url = file ? await uploadPhoto(file) : null;
  const { data, error } = await sb
    .from("people")
    .insert({
      name: name.trim(),
      photo_url,
      pos_x: pos.x,
      pos_y: pos.y,
      parent_union_id: parentUnionId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Person;
}

/* ---------------- small form pieces ---------------- */

function PersonFields(props: {
  submitLabel: string;
  initialName?: string;
  showRemovePhoto?: boolean;
  disabled?: boolean;
  extra?: ReactNode;
  onSubmit: (name: string, file: File | null, dropPhoto: boolean) => Promise<void> | void;
}) {
  const { submitLabel, initialName = "", showRemovePhoto = false, disabled, extra, onSubmit } = props;
  const [name, setName] = useState(initialName);
  const [file, setFile] = useState<File | null>(null);
  const [drop, setDrop] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit(name, file, drop);
    if (!initialName) setName("");
    setFile(null);
    setDrop(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field">
        <span>Name (Devanagari)</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="नाम"
          lang="hi"
          required
        />
      </label>
      <label className="field">
        <span>Photo (optional)</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {showRemovePhoto && (
        <label className="check">
          <input type="checkbox" checked={drop} onChange={(e) => setDrop(e.target.checked)} />
          Remove current photo
        </label>
      )}
      {extra}
      <button className="btn btn-primary" type="submit" disabled={disabled || !name.trim()}>
        {submitLabel}
      </button>
    </form>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setErr(null);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) setErr(error.message);
    } catch (x) {
      setErr(errText(x));
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="login">
      <form className="stack login-card" onSubmit={submit}>
        <h1>Admin sign in</h1>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        {err && <p className="alert" role="alert">{err}</p>}
        <button className="btn btn-primary" type="submit" disabled={pending}>
          Sign in
        </button>
      </form>
    </main>
  );
}

/* ---------------- main admin screen ---------------- */

export default function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [unions, setUnions] = useState<Union[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* auth */
  useEffect(() => {
    try {
      const sb = getSupabase();
      sb.auth.getSession().then(({ data }) => setSession(data.session));
      const { data: sub } = sb.auth.onAuthStateChange((_evt, s) => setSession(s));
      return () => sub.subscription.unsubscribe();
    } catch (e) {
      setError(errText(e));
      setSession(null);
    }
  }, []);

  useEffect(() => {
    if (!session) {
      setIsAdmin(null);
      return;
    }
    getSupabase()
      .rpc("is_admin")
      .then(({ data, error: err }) => setIsAdmin(!err && data === true));
  }, [session]);

  /* data */
  const reload = useCallback(async () => {
    const t = await fetchTree();
    setPeople(t.people);
    setUnions(t.unions);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (isAdmin) reload().catch((e) => setError(errText(e)));
  }, [isAdmin, reload]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(errText(e));
      } finally {
        try {
          await reload();
        } catch {
          /* ignore */
        }
        setBusy(false);
      }
    },
    [reload]
  );

  const saveLayout = () =>
    run(async () => {
      const pos = autoLayout(people, unions);
      const rows = people.map((p) => ({
        ...p,
        pos_x: pos[p.id]?.x ?? 0,
        pos_y: pos[p.id]?.y ?? 0,
      }));
      const { error: err } = await getSupabase().from("people").upsert(rows);
      if (err) throw err;
    });

  // Imported data with no saved positions: arrange it once and save.
  useEffect(() => {
    if (loaded && people.length > 1 && people.every((p) => p.pos_x === 0 && p.pos_y === 0)) {
      void saveLayout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.name ?? "?";

  /* ---- person actions ---- */
  const addUnlinked = (name: string, file: File | null) =>
    run(async () => {
      const x = people.length ? Math.max(...people.map((p) => p.pos_x)) + NW + H_GAP : 0;
      const y = people.length ? Math.min(...people.map((p) => p.pos_y)) : 0;
      await insertPerson(name, file, { x, y });
    });

  const addChild = (parent: Person, name: string, file: File | null, choice: string) =>
    run(async () => {
      const sb = getSupabase();
      let unionId = choice;
      if (!unionId) {
        const { data, error: err } = await sb.from("unions").insert({ a_id: parent.id }).select().single();
        if (err) throw err;
        unionId = (data as Union).id;
      }
      const sibs = people.filter((p) => p.parent_union_id === unionId);
      const x = sibs.length ? Math.max(...sibs.map((s) => s.pos_x)) + NW + H_GAP : parent.pos_x;
      await insertPerson(name, file, { x, y: parent.pos_y + LEVEL_H }, unionId);
    });

  const addSpouse = (person: Person, name: string, file: File | null) =>
    run(async () => {
      const sb = getSupabase();
      const mine = unions.filter((u) => u.a_id === person.id);
      const n = mine.filter((u) => u.b_id).length;
      const dx = (Math.floor(n / 2) + 1) * (NW + SP_GAP);
      const spouse = await insertPerson(name, file, {
        x: n % 2 === 0 ? person.pos_x + dx : person.pos_x - dx,
        y: person.pos_y,
      });
      const single = mine.find((u) => !u.b_id);
      if (single) {
        const { error: err } = await sb.from("unions").update({ b_id: spouse.id }).eq("id", single.id);
        if (err) throw err;
      } else {
        const { error: err } = await sb.from("unions").insert({ a_id: person.id, b_id: spouse.id });
        if (err) throw err;
      }
    });

  const savePerson = (p: Person, name: string, file: File | null, dropPhoto: boolean) =>
    run(async () => {
      let photo_url = p.photo_url;
      if (file) {
        photo_url = await uploadPhoto(file);
        if (p.photo_url) await removePhoto(p.photo_url);
      } else if (dropPhoto && p.photo_url) {
        await removePhoto(p.photo_url);
        photo_url = null;
      }
      const { error: err } = await getSupabase()
        .from("people")
        .update({ name: name.trim(), photo_url })
        .eq("id", p.id);
      if (err) throw err;
    });

  const deletePerson = (p: Person) => {
    if (!window.confirm(`Delete ${p.name}? Their children stay in the tree but lose the link to this parent.`)) return;
    void run(async () => {
      if (p.photo_url) await removePhoto(p.photo_url);
      const { error: err } = await getSupabase().from("people").delete().eq("id", p.id);
      if (err) throw err;
      setSelectedId(null);
    });
  };

  /* ---- arrows drawn on the canvas ---- */
  const linkSpouses = (x: string, y: string) =>
    run(async () => {
      if (unions.some((u) => (u.a_id === x && u.b_id === y) || (u.a_id === y && u.b_id === x))) return;
      const sb = getSupabase();
      const single = unions.find((u) => u.a_id === x && !u.b_id);
      if (single) {
        const { error: err } = await sb.from("unions").update({ b_id: y }).eq("id", single.id);
        if (err) throw err;
      } else {
        const { error: err } = await sb.from("unions").insert({ a_id: x, b_id: y });
        if (err) throw err;
      }
    });

  const linkChild = (parentId: string, childId: string) =>
    run(async () => {
      const child = people.find((p) => p.id === childId);
      if (!child) return;
      if (isAncestor(childId, parentId, people, unions)) {
        throw new Error("A person cannot be their own ancestor.");
      }
      if (child.parent_union_id) {
        throw new Error(`${child.name} already has parents. Select the old arrow and press Delete first.`);
      }
      const sb = getSupabase();
      const cands = unionsOfPerson(parentId, unions);
      let unionId: string | undefined = cands[0]?.id;
      if (cands.length > 1) {
        const list = cands
          .map((u, i) => `${i + 1}) with ${nameOf(u.a_id === parentId ? u.b_id : u.a_id)}`)
          .join("\n");
        const ans = window.prompt(`Which marriage is ${child.name} a child of?\n${list}`, "1");
        const idx = Number(ans) - 1;
        if (!(idx >= 0 && idx < cands.length)) throw new Error("Cancelled.");
        unionId = cands[idx].id;
      }
      if (!unionId) {
        const { data, error: err } = await sb.from("unions").insert({ a_id: parentId }).select().single();
        if (err) throw err;
        unionId = (data as Union).id;
      }
      const { error: err } = await sb.from("people").update({ parent_union_id: unionId }).eq("id", childId);
      if (err) throw err;
    });

  const onConnectPeople = (c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    const side = (h?: string | null) => h === "left" || h === "right";
    if (side(c.sourceHandle) && side(c.targetHandle)) {
      void linkSpouses(c.source, c.target);
    } else if (c.sourceHandle === "bottom" && c.targetHandle === "top") {
      void linkChild(c.source, c.target);
    } else if (c.sourceHandle === "top" && c.targetHandle === "bottom") {
      void linkChild(c.target, c.source);
    } else {
      setError("Join spouses with the side dots (left/right). For a child, drag from the parent's bottom dot to the child's top dot.");
    }
  };

  const onDeleteEdges = (edges: Edge[]) => {
    const items = edges
      .map((e) => e.data as EdgeData | undefined)
      .filter((d): d is EdgeData => !!d);
    if (!items.length) return;
    const unionIds = Array.from(new Set(items.filter((d) => d.kind !== "child").map((d) => d.unionId)));
    const childIds = items.filter((d) => d.kind === "child" && d.childId).map((d) => d.childId as string);
    if (unionIds.length) {
      const hasKids = unionIds.some((id) => people.some((p) => p.parent_union_id === id));
      const msg = hasKids
        ? "Remove this marriage line? Its children will be detached from these parents."
        : "Remove this marriage line?";
      if (!window.confirm(msg)) return;
    }
    void run(async () => {
      const sb = getSupabase();
      if (unionIds.length) {
        const { error: err } = await sb.from("unions").delete().in("id", unionIds);
        if (err) throw err;
      }
      for (const cid of childIds) {
        const child = people.find((p) => p.id === cid);
        const uid = child?.parent_union_id;
        if (!child || !uid) continue;
        const { error: err } = await sb.from("people").update({ parent_union_id: null }).eq("id", cid);
        if (err) throw err;
        const u = unions.find((x) => x.id === uid);
        const remaining = people.filter((p) => p.parent_union_id === uid && !childIds.includes(p.id)).length;
        if (u && !u.b_id && remaining === 0 && !unionIds.includes(uid)) {
          await sb.from("unions").delete().eq("id", uid);
        }
      }
    });
  };

  const onMovePeople = useCallback(async (moves: { id: string; x: number; y: number }[]) => {
    setPeople((prev) =>
      prev.map((p) => {
        const m = moves.find((mv) => mv.id === p.id);
        return m ? { ...p, pos_x: m.x, pos_y: m.y } : p;
      })
    );
    const sb = getSupabase();
    const results = await Promise.all(
      moves.map((m) => sb.from("people").update({ pos_x: m.x, pos_y: m.y }).eq("id", m.id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) setError(errText(failed.error));
  }, []);

  /* ---------------- render ---------------- */
  if (session === undefined) return <p className="status">Loading…</p>;
  if (!session) return (
    <>
      {error && <p className="alert alert-top" role="alert">{error}</p>}
      <Login />
    </>
  );
  if (isAdmin === null) return <p className="status">Checking access…</p>;
  if (!isAdmin) {
    return (
      <main className="login">
        <div className="stack login-card">
          <h1>No admin access</h1>
          <p>
            You are signed in as <strong>{session.user.email}</strong>, but this email is not in the
            <code> admins </code> table.
          </p>
          <button className="btn" onClick={() => getSupabase().auth.signOut()}>
            Sign out
          </button>
        </div>
      </main>
    );
  }

  const selected = people.find((p) => p.id === selectedId) ?? null;
  const childChoices = selected
    ? unionsOfPerson(selected.id, unions).map((u) => {
        const other = u.a_id === selected.id ? u.b_id : u.a_id;
        return { id: u.id, label: other ? `With ${nameOf(other)}` : "Single parent" };
      })
    : [];

  return (
    <div className="admin-shell">
      <div className="admin-canvas">
        {loaded ? (
          <TreeCanvas
            people={people}
            unions={unions}
            editable
            labels={en}
            onSelect={setSelectedId}
            onConnectPeople={onConnectPeople}
            onDeleteEdges={onDeleteEdges}
            onMovePeople={onMovePeople}
          />
        ) : (
          <p className="status">Loading…</p>
        )}
      </div>

      <aside className="panel">
        <div className="panel-head">
          <div>
            <strong>Admin</strong>
            <div className="muted small">{session.user.email}</div>
          </div>
          <button className="btn" onClick={() => getSupabase().auth.signOut()}>
            Sign out
          </button>
        </div>

        {error && <p className="alert" role="alert">{error}</p>}
        {busy && <p className="muted small">Saving…</p>}

        <button className="btn" disabled={busy || people.length < 2} onClick={() => void saveLayout()}>
          Auto-arrange everyone and save
        </button>

        {selected ? (
          <section className="stack" key={selected.id}>
            <h2 lang="hi">{selected.name}</h2>
            <PersonFields
              submitLabel="Save changes"
              initialName={selected.name}
              showRemovePhoto={!!selected.photo_url}
              disabled={busy}
              onSubmit={(n, f, d) => savePerson(selected, n, f, d)}
            />

            <h3>Add a child</h3>
            <ChildForm
              choices={childChoices}
              disabled={busy}
              onSubmit={(n, f, choice) => addChild(selected, n, f, choice)}
            />

            <h3>Add a spouse</h3>
            <PersonFields
              submitLabel="Add spouse"
              disabled={busy}
              onSubmit={(n, f) => addSpouse(selected, n, f)}
            />

            <button className="btn btn-danger" disabled={busy} onClick={() => deletePerson(selected)}>
              Delete this person
            </button>
          </section>
        ) : (
          <p className="muted">Click a person on the canvas to edit them or add a child or spouse.</p>
        )}

        <section className="stack">
          <h3>Add a person (not linked yet)</h3>
          <PersonFields submitLabel="Add person" disabled={busy} onSubmit={(n, f) => addUnlinked(n, f)} />
        </section>

        <section className="help small muted">
          <p><strong>Joining people with arrows</strong></p>
          <p>Marriage: drag from one person's right or left dot to another person's left or right dot.</p>
          <p>Child: drag from the parent's bottom dot to the child's top dot.</p>
          <p>Remove a connection: click the line, then press Delete.</p>
          <p>Drag any name to move it; the new position is saved for everyone.</p>
        </section>
      </aside>
    </div>
  );
}

function ChildForm(props: {
  choices: { id: string; label: string }[];
  disabled?: boolean;
  onSubmit: (name: string, file: File | null, choice: string) => Promise<void> | void;
}) {
  const { choices, disabled, onSubmit } = props;
  const [choice, setChoice] = useState(choices[0]?.id ?? "");
  return (
    <PersonFields
      submitLabel="Add child"
      disabled={disabled}
      extra={
        choices.length > 1 ? (
          <label className="field">
            <span>Child of</span>
            <select value={choice} onChange={(e) => setChoice(e.target.value)}>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        ) : null
      }
      onSubmit={(n, f) => onSubmit(n, f, choices.length ? choice || choices[0].id : "")}
    />
  );
}
