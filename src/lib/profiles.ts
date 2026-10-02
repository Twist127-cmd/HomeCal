import type { Profile } from "./types";

/** Expand profile ids (couple, group, household) into the PERSON profile ids they cover. */
export function resolvePersons(profileIds: string[], profiles: Profile[]): Set<string> {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const persons = new Set<string>();
  for (const id of profileIds) {
    const p = byId.get(id);
    if (!p) continue;
    if (p.type === "PERSON") persons.add(p.id);
    else if (p.type === "HOUSEHOLD") profiles.filter((x) => x.type === "PERSON").forEach((x) => persons.add(x.id));
    else p.memberIds.forEach((m) => persons.add(m));
  }
  return persons;
}

/** Does an event with `eventProfileIds` concern the profile `filterId`? */
export function concernsProfile(eventProfileIds: string[], filterId: string, profiles: Profile[]): boolean {
  if (eventProfileIds.includes(filterId)) return true;
  const filter = profiles.find((p) => p.id === filterId);
  if (!filter) return false;
  const eventPersons = resolvePersons(eventProfileIds, profiles);
  if (filter.type === "PERSON") return eventPersons.has(filter.id);
  const filterPersons = resolvePersons([filterId], profiles);
  // couple/group/household filter: show events touching any of its members
  return [...filterPersons].some((p) => eventPersons.has(p));
}

/**
 * Pick the most specific profile covering exactly a set of persons:
 * {Clément, Compagne} -> the COUPLE profile if it exists.
 */
export function bestProfileFor(personIds: string[], profiles: Profile[]): string[] {
  const target = new Set(personIds);
  if (target.size <= 1) return [...target];
  const persons = profiles.filter((p) => p.type === "PERSON");
  if (target.size === persons.length) {
    const hh = profiles.find((p) => p.type === "HOUSEHOLD");
    const couple = profiles.find((p) => p.type === "COUPLE" && sameSet(resolvePersons([p.id], profiles), target));
    if (couple) return [couple.id];
    if (hh) return [hh.id];
  }
  const match = profiles.find(
    (p) => (p.type === "COUPLE" || p.type === "GROUP") && sameSet(resolvePersons([p.id], profiles), target),
  );
  return match ? [match.id] : [...target];
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

export function profileColor(profileIds: string[], profiles: Profile[]): string {
  const p = profiles.find((x) => x.id === profileIds[0]);
  return p?.color ?? "#64748b";
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Find profiles by (fuzzy) name. */
export function findProfilesByName(names: string[], profiles: Profile[]): Profile[] {
  const out: Profile[] = [];
  for (const raw of names) {
    const n = normalize(raw);
    if (!n) continue;
    const p =
      profiles.find((x) => normalize(x.name) === n) ??
      profiles.find((x) => normalize(x.name).startsWith(n) || n.startsWith(normalize(x.name)));
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}
