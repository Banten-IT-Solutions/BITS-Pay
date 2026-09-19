// Tema light/dark via [data-theme] di <html> — pola sama dengan landing.
export type Theme = 'light' | 'dark';

export function getTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem('bits-theme', next);
  } catch {
    // storage penuh/ditolak — abaikan, tema tetap berlaku untuk sesi ini
  }
  return next;
}
