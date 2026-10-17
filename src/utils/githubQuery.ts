// GitHub search queries put qualifiers in one param value, e.g. `q=is:issue state:open label:"good first issue"`.
// A pair is [qualifier, value]; free text (no colon) is ['', text].
export type Qualifier = [string, string];

// Keeps quoted spans intact so `label:"good first issue"` stays one token.
const TOKEN = /(?:[^\s"]+|"[^"]*")+/g;

export function parseQualifiers(value: string): Qualifier[] {
  return (value.match(TOKEN) ?? []).map((t) => {
    const i = t.indexOf(':');
    return i > 0 && !t.slice(0, i).includes('"') ? [t.slice(0, i), t.slice(i + 1)] : ['', t];
  });
}

export function serializeQualifiers(pairs: Qualifier[]): string {
  return pairs
    .map(([k, v]) => (k ? `${k}:${v}` : v))
    .filter(Boolean)
    .join(' ');
}

export function isGitHubQuery(hostname: string, value: string): boolean {
  return hostname === 'github.com' && parseQualifiers(value).some(([k]) => k);
}

// qualifier → distinct values seen across the given raw query strings.
export function qualifierHistory(values: string[]): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const v of values) {
    for (const [k, val] of parseQualifiers(v)) {
      if (!k) continue;
      if (!map.has(k)) map.set(k, new Set());
      map.get(k)!.add(val);
    }
  }
  return new Map(Array.from(map, ([k, s]) => [k, Array.from(s)]));
}
