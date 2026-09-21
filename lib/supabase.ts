import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { shrinkImage } from "./image";
import type { Person, Union } from "./types";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("Supabase environment variables are missing (see .env.example).");
    }
    client = createClient(url, key);
  }
  return client;
}

export async function fetchTree(): Promise<{ people: Person[]; unions: Union[] }> {
  const sb = getSupabase();
  const [p, u] = await Promise.all([
    sb.from("people").select("*"),
    sb.from("unions").select("*"),
  ]);
  if (p.error) throw p.error;
  if (u.error) throw u.error;
  return { people: (p.data ?? []) as Person[], unions: (u.data ?? []) as Union[] };
}

const BUCKET = "photos";

export async function uploadPhoto(file: File): Promise<string> {
  const sb = getSupabase();
  const blob = await shrinkImage(file);
  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
  });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Best-effort cleanup of an old photo. */
export async function removePhoto(url: string): Promise<void> {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i < 0) return;
  const path = decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  await getSupabase().storage.from(BUCKET).remove([path]);
}
