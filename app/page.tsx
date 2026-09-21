"use client";

import { useCallback, useEffect, useState } from "react";
import TreeCanvas from "@/components/TreeCanvas";
import ProfileCard from "@/components/ProfileCard";
import { fetchTree } from "@/lib/supabase";
import { hi } from "@/lib/i18n";
import type { Person, Union } from "@/lib/types";

export default function Home() {
  const [data, setData] = useState<{ people: Person[]; unions: Union[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetchTree().then(setData).catch(() => setFailed(true));
  }, []);

  const close = useCallback(() => setOpenId(null), []);

  if (failed) return <p className="status">{hi.loadError}</p>;
  if (!data) return <p className="status">{hi.loading}</p>;

  const open = data.people.find((p) => p.id === openId) ?? null;

  return (
    <main className="canvas-wrap">
      <TreeCanvas
        people={data.people}
        unions={data.unions}
        editable={false}
        labels={hi}
        onOpen={setOpenId}
      />
      {open && (
        <ProfileCard
          person={open}
          people={data.people}
          unions={data.unions}
          labels={hi}
          onClose={close}
          onOpen={setOpenId}
        />
      )}
    </main>
  );
}
