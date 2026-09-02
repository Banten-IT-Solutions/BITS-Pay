import './style.css';

const API_URL = 'https://api.pay.bits.co.id/v1';

// Nav toggle
const toggle = document.querySelector<HTMLButtonElement>('#nav-toggle')!;
const menu = document.querySelector<HTMLElement>('#nav-menu')!;

toggle?.addEventListener('click', () => {
  const open = menu?.classList.toggle('open') ?? false;
  toggle.setAttribute('aria-expanded', String(open));
});

menu?.querySelectorAll('a').forEach((a) => {
  a.addEventListener('click', () => {
    menu.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
  });
});

// Modal
function openModal(id: string) {
  document.getElementById(id)!.style.display = 'flex';
}
function closeModal(id: string) {
  document.getElementById(id)!.style.display = 'none';
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach((el) => {
    (el as HTMLElement).style.display = 'none';
  });
}

function showError(id: string, msg: string) {
  const el = document.getElementById(id)!;
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError(id: string) {
  document.getElementById(id)!.style.display = 'none';
}

// Open modals from nav links
document.querySelectorAll('a[href="/login"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    closeAllModals();
    openModal('login-modal');
  });
});
document.querySelectorAll('a[href="/signup"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    closeAllModals();
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
    const json = await res.json();
    if (!res.ok || !json.success) {
      showError('login-error', json.error?.message || 'Login gagal');
      return;
    }
    localStorage.setItem('token', json.data.token);
    window.location.href = json.data.redirect || '/dashboard';
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
    const json = await res.json();
    if (!res.ok || !json.success) {
      showError('signup-error', json.error?.message || 'Daftar gagal');
      return;
    }
    localStorage.setItem('token', json.data.token);
    window.location.href = json.data.redirect || '/dashboard';
  } catch {
    showError('signup-error', 'Gagal terhubung ke server');
  }
}

// Expose for inline handlers
(window as any).openModal = openModal;
(window as any).closeModal = closeModal;
(window as any).handleLogin = handleLogin;
(window as any).handleSignup = handleSignup;

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllModals();
});
