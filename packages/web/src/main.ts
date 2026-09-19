import './style.css';

// VITE_API_URL wajib diisi saat build produksi. Fallback = host yang sama + port
// default API dev (7001), supaya akses via IP LAN tetap jalan tanpa edit .env.
const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:7001`;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Nav toggle
const toggle = document.querySelector<HTMLButtonElement>('#nav-toggle')!;
const menu = document.querySelector<HTMLElement>('#nav-menu')!;

toggle?.addEventListener('click', () => {
  const open = menu?.classList.toggle('open') ?? false;
  toggle.setAttribute('aria-expanded', String(open));
});

// Pill navbar: elevasi saat halaman di-scroll.
const navbar = document.querySelector<HTMLElement>('.navbar');
if (navbar) {
  const onScroll = (): void => {
    navbar.classList.toggle('scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

menu?.querySelectorAll('a').forEach((a) => {
  a.addEventListener('click', () => {
    menu.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
  });
});

// Theme switcher — persist ke localStorage.
const html = document.documentElement;
document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  try {
    localStorage.setItem('bits-theme', next);
  } catch {
    /* private mode */
  }
});

// Modal
function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach((el) => {
    (el as HTMLElement).style.display = 'none';
  });
}

function openModal(id: string) {
  closeAllModals();
  const modal = document.getElementById(id)!;
  modal.style.display = 'flex';
  // Fokus ke input pertama supaya keyboard/screen-reader langsung masuk form.
  modal.querySelector<HTMLInputElement>('input')?.focus();
}
function closeModal(id: string) {
  document.getElementById(id)!.style.display = 'none';
}

function showError(id: string, msg: string) {
  const el = document.getElementById(id)!;
  el.textContent = msg;
  el.className = 'form-error';
  el.style.display = 'block';
}

function showSuccess(id: string, msg: string) {
  const el = document.getElementById(id)!;
  el.textContent = msg;
  el.className = 'form-success';
  el.style.display = 'block';
}

function hideError(id: string) {
  document.getElementById(id)!.style.display = 'none';
}

// Open modals from nav links
document.querySelectorAll('a[href="/login"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('login-modal');
  });
});
document.querySelectorAll('a[href="/signup"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('signup-modal');
  });
});

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach((el) => {
  el.addEventListener('click', (e) => {
    if (e.target === el) closeModal(el.id);
  });
});

// Login
async function handleLogin(e: Event) {
  e.preventDefault();
  hideError('login-error');
  const email = (document.getElementById('login-email') as HTMLInputElement).value;
  const password = (document.getElementById('login-password') as HTMLInputElement).value;
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = (await res.json()) as {
      success?: boolean;
      error?: { message?: string };
      data?: { token?: string };
    };
    if (!res.ok || !json.success || !json.data?.token) {
      showError('login-error', json.error?.message || 'Login gagal');
      return;
    }
    const token: string = json.data.token;
    localStorage.setItem('token', token);
    // Dev: web di 7002, user SPA di 7003 (beda origin, localStorage tidak shared).
    if (window.location.port === '7002') {
      window.location.href = `http://${window.location.hostname}:7003/?token=${encodeURIComponent(token)}`;
    } else {
      window.location.href = '/user/';
    }
  } catch {
    showError('login-error', 'Gagal terhubung ke server');
  }
}

// Signup
async function handleSignup(e: Event) {
  e.preventDefault();
  hideError('signup-error');
  const name = (document.getElementById('signup-name') as HTMLInputElement).value;
  const email = (document.getElementById('signup-email') as HTMLInputElement).value;
  const password = (document.getElementById('signup-password') as HTMLInputElement).value;
  try {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const json = (await res.json()) as {
      success?: boolean;
      error?: { message?: string };
    };
    if (!res.ok || !json.success) {
      showError('signup-error', json.error?.message || 'Daftar gagal');
      return;
    }
    // Verifikasi email dikirim; beri instruksi sukses.
    showSuccess(
      'signup-error',
      'Pendaftaran berhasil! Silakan cek email kamu untuk verifikasi akun.',
    );
  } catch {
    showError('signup-error', 'Gagal terhubung ke server');
  }
}

// Google OAuth
function handleGoogleAuth(e?: Event) {
  e?.preventDefault();
  window.location.href = `${API_URL}/auth/google`;
}

// Expose for inline handlers
declare global {
  interface Window {
    openModal: typeof openModal;
    closeModal: typeof closeModal;
    handleLogin: typeof handleLogin;
    handleSignup: typeof handleSignup;
    handleGoogleAuth: typeof handleGoogleAuth;
  }
}
window.openModal = openModal;
window.closeModal = closeModal;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleGoogleAuth = handleGoogleAuth;

document.querySelectorAll('.btn-google').forEach((btn) => {
  btn.addEventListener('click', handleGoogleAuth);
});

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllModals();
});

// ── Odometer kode unik ─────────────────────────────────────
// Kolom digit 0–9 ditumpuk vertikal, digeser translateY sampai digit final.
// Reduced motion: langsung render angka final sebagai teks.
function initOdometer() {
  const el = document.getElementById('odometer');
  if (!el) return;
  const final = (el.dataset.final ?? '042').slice(-3).padStart(3, '0');
  el.textContent = '';

  final.split('').forEach((digit, i) => {
    const col = document.createElement('span');
    col.className = 'odo-col';

    if (prefersReducedMotion) {
      col.textContent = digit;
      el.appendChild(col);
      return;
    }

    const stack = document.createElement('span');
    stack.className = 'odo-stack';
    // Kolom belakang berputar lebih lama (efek slot machine berurutan).
    const cycles = 2 + i;
    const target = cycles * 10 + Number(digit);
    for (let n = 0; n <= target; n++) {
      const d = document.createElement('span');
      d.className = 'odo-digit';
      d.textContent = String(n % 10);
      stack.appendChild(d);
    }
    stack.style.transitionDelay = `${i * 120}ms`;
    col.appendChild(stack);
    el.appendChild(col);

    // Double rAF: pastikan posisi awal ter-render sebelum transisi mulai.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        stack.style.transform = `translateY(-${target}em)`;
      });
    });
  });
}

// Mulai setelah hero settle sebentar — bukan animasi yang dipicu scroll.
window.setTimeout(initOdometer, 350);

// ── Countdown expiry (demo) ────────────────────────────────
// Tick tiap detik dari 15:00, loop ulang saat habis.
// Merah saat < 1 menit. Progress bar ikut menyusut.
const expEl = document.getElementById('exp-countdown');
if (expEl) {
  const TOTAL = 15 * 60;
  let remain = TOTAL;
  const tick = () => {
    const mm = String(Math.floor(remain / 60)).padStart(2, '0');
    const ss = String(remain % 60).padStart(2, '0');
    expEl.textContent = `${mm}:${ss}`;
    expEl.classList.toggle('urgent', remain < 60);
    remain = remain > 0 ? remain - 1 : TOTAL;
  };
  tick();
  window.setInterval(tick, 1000);
}

// ── Reveal on scroll ───────────────────────────────────────
const revealEls = document.querySelectorAll<HTMLElement>('.reveal');
if (prefersReducedMotion || !('IntersectionObserver' in window)) {
  revealEls.forEach((el) => el.classList.add('visible'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 },
  );
  revealEls.forEach((el) => io.observe(el));
}

// ── Scrollspy navbar ───────────────────────────────────────
// Link section aktif dapat highlight pill saat section-nya terlihat.
const spyLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.nav-link[href^="#"]'));
const spyTargets = spyLinks
  .map((a) => ({ a, el: document.querySelector(a.getAttribute('href') ?? '') }))
  .filter((x): x is { a: HTMLAnchorElement; el: Element } => x.el !== null);
if ('IntersectionObserver' in window && spyTargets.length > 0) {
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        spyLinks.forEach((l) => l.classList.remove('active'));
        spyTargets.find((x) => x.el === entry.target)?.a.classList.add('active');
      });
    },
    { rootMargin: '-35% 0px -60% 0px' },
  );
  spyTargets.forEach((x) => spy.observe(x.el));
}

// ── Demo loop: Menunggu → Terverifikasi ────────────────────
// Badge flip hijau sebentar, lalu transaksi "baru" dengan kode unik baru.
const payStatus = document.querySelector<HTMLElement>('.pay-status');
const payStatusText = payStatus?.querySelector<HTMLElement>('.pay-status-text');
if (payStatus && payStatusText && !prefersReducedMotion) {
  window.setInterval(() => {
    payStatus.classList.add('success');
    payStatusText.textContent = 'Terverifikasi';
    window.setTimeout(() => {
      payStatus.classList.remove('success');
      payStatusText.textContent = 'Menunggu pembayaran';
      // Re-spin odometer ke kode unik acak — transaksi berikutnya.
      const odo = document.getElementById('odometer');
      if (odo) {
        odo.dataset.final = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        initOdometer();
      }
    }, 3200);
  }, 9600);
}

// ── Tilt halus jendela checkout mengikuti mouse ────────────
const heroVisual = document.querySelector<HTMLElement>('.hero-visual');
const windowEl = heroVisual?.querySelector<HTMLElement>('.window');
if (
  heroVisual &&
  windowEl &&
  !prefersReducedMotion &&
  window.matchMedia('(pointer: fine)').matches
) {
  heroVisual.addEventListener('mousemove', (e) => {
    const r = heroVisual.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    windowEl.style.setProperty('--ry', `${(x * 4).toFixed(2)}deg`);
    windowEl.style.setProperty('--rx', `${(y * -4).toFixed(2)}deg`);
  });
  heroVisual.addEventListener('mouseleave', () => {
    windowEl.style.setProperty('--rx', '0deg');
    windowEl.style.setProperty('--ry', '0deg');
  });
}
