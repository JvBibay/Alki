/** Lower-cases, trims and squashes spaces, so "  GCash " and "gcash" count as the same name. */
export const normName = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** True if another account already uses this name (case and spacing ignored). `exceptId` is the one being edited. */
export function nameTaken(accounts: { id: string; name: string }[], name: string, exceptId?: string): boolean {
  const n = normName(name);
  return n !== "" && accounts.some((a) => a.id !== exceptId && normName(a.name) === n);
}
