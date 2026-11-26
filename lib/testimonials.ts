import { getSupabase } from "./supabase";

export interface Testimonial {
  id: string;
  message: string;
  /** Already masked by the database, e.g. "J***". */
  author: string;
}

let cache: Testimonial[] | null = null;

/** Approved testimonials (the public_testimonials view). Empty if unavailable: the UI just shows nothing. */
export async function fetchTestimonials(): Promise<Testimonial[]> {
  if (cache) return cache;
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from("public_testimonials").select("id, message, author").limit(30);
    if (error || !data) return [];
    cache = data.filter((r) => typeof r.message === "string" && r.message.trim()).map((r) => ({ id: String(r.id), message: String(r.message).slice(0, 400), author: String(r.author || "Kwenta user").slice(0, 40) }));
    return cache;
  } catch {
    return [];
  }
}

/** The name sent with a public testimonial: trimmed and capped. The database shows only its first letter. */
export const cleanName = (raw: string): string => raw.replace(/\s+/g, " ").trim().slice(0, 30);
