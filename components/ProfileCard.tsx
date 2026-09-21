"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Labels } from "@/lib/i18n";
import type { Person, Union } from "@/lib/types";

type Props = {
  person: Person;
  people: Person[];
  unions: Union[];
  labels: Labels;
  onClose: () => void;
  onOpen: (id: string) => void;
};

export default function ProfileCard({ person, people, unions, labels, onClose, onOpen }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { parents, spouses } = useMemo(() => {
    const byId = new Map(people.map((p) => [p.id, p]));
    const pick = (ids: Array<string | null>): Person[] =>
      ids.map((id) => (id ? byId.get(id) : undefined)).filter((p): p is Person => !!p);
    const pu = unions.find((u) => u.id === person.parent_union_id);
    const parents = pu ? pick([pu.a_id, pu.b_id]) : [];
    const spouses = pick(
      unions
        .filter((u) => u.a_id === person.id || u.b_id === person.id)
        .map((u) => (u.a_id === person.id ? u.b_id : u.a_id))
    );
    return { parents, spouses };
  }, [person, people, unions]);

  const links = (list: Person[]) =>
    list.length === 0
      ? labels.none
      : list.map((p, i) => (
          <span key={p.id}>
            {i > 0 && ` ${labels.and} `}
            <button type="button" className="link" onClick={() => onOpen(p.id)}>
              {p.name}
            </button>
          </span>
        ));

  const first = Array.from(person.name.trim())[0] ?? "•";

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-name"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="card-close" onClick={onClose} aria-label={labels.close} title={labels.close}>
          ×
        </button>
        {person.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="card-photo" src={person.photo_url} alt={person.name} />
        ) : (
          <div className="card-photo card-photo-empty" aria-hidden="true">
            {first}
          </div>
        )}
        <div className="card-body">
          <h2 id="card-name">{person.name}</h2>
          <dl>
            <dt>{labels.parents}</dt>
            <dd>{links(parents)}</dd>
            <dt>{labels.spouse}</dt>
            <dd>{links(spouses)}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
