// Parse query param yang bekerja untuk hash-router (`#/path?token=...`)
// maupun URL biasa (`/path?token=...`). svelte-spa-router menaruh query
// di dalam location.hash, sehingga location.search selalu kosong.
export function getQueryParam(name: string): string | null {
  const fromSearch = new URLSearchParams(window.location.search).get(name);
  if (fromSearch !== null) return fromSearch;
  const hash = window.location.hash;
  const qIndex = hash.indexOf('?');
  if (qIndex === -1) return null;
  return new URLSearchParams(hash.slice(qIndex)).get(name);
}
