# BITS Pay — UI/UX Design

## 1. Brand Identity

| Item | Value |
|------|-------|
| **Nama** | BITS Pay |
| **Tagline** | QRIS payment gateway untuk aplikasi kamu |
| **Logo** | Logo Banten IT Solutions |
| **Tone** | Indonesia banget — casual, helpful, ga kaku |

## 2. Color Palette

### Primary — Biru Laut
```css
--color-primary-50:  oklch(0.97 0.02 250)
--color-primary-100: oklch(0.93 0.04 250)
--color-primary-200: oklch(0.87 0.06 250)
--color-primary-400: oklch(0.68 0.12 250)
--color-primary-500: oklch(0.55 0.15 250)
--color-primary-600: oklch(0.45 0.13 250)
--color-primary-700: oklch(0.35 0.10 250)
--color-primary-900: oklch(0.20 0.06 250)
```

### Accent — Hijau Emerald
```css
--color-accent-500: oklch(0.62 0.16 165)
--color-accent-600: oklch(0.52 0.14 165)
```

### Neutral — Hangat
```css
--color-neutral-50:  oklch(0.99 0.005 80)
--color-neutral-100: oklch(0.97 0.005 80)
--color-neutral-200: oklch(0.93 0.005 80)
--color-neutral-400: oklch(0.80 0.01 80)
--color-neutral-600: oklch(0.55 0.01 80)
--color-neutral-900: oklch(0.20 0.01 80)
```

### Status
```css
--color-success: oklch(0.62 0.16 165)
--color-warning: oklch(0.75 0.15 80)
--color-error:   oklch(0.55 0.20 30)
--color-info:    oklch(0.60 0.10 250)
```

## 3. Typography

| Elemen | Font | Weight | Size |
|--------|------|--------|------|
| Heading 1 | Inter | Bold | 2.5rem |
| Heading 2 | Inter | Bold | 2rem |
| Heading 3 | Inter | Semibold | 1.5rem |
| Body | Inter | Regular | 1rem |
| Small | Inter | Regular | 0.875rem |
| Caption | Inter | Medium | 0.75rem |
| Monospace | JetBrains Mono | Regular | 0.875rem |

## 4. Landing Page Layout

1 page scroll:
```
┌─────────────────────────────────┐
│ NAVBAR: Logo | Fitur | Harga | Docs | Masuk | Daftar
├─────────────────────────────────┤
│ HERO: Tagline + CTA + ilustrasi  │
├─────────────────────────────────┤
│ CARA KERJA: 4 step + ilustrasi  │
├─────────────────────────────────┤
│ FITUR: 6 card grid               │
├─────────────────────────────────┤
│ HARGA: Free vs Premium table     │
├─────────────────────────────────┤
│ CTA: "Siap mulai?"               │
├─────────────────────────────────┤
│ FOOTER: Links + kredit           │
└─────────────────────────────────┘
```

## 5. Dashboard Layout

### Sidebar
```
☰ BITS Pay
═══════════
📊  Overview
📁  Workspaces
🤖  Apps
💳  Payments
📦  Subscription
👥  Team
───────────
⚙️  Settings
🆘  Bantuan
```

### Content Area
```
┌─── STAT CARDS (4) ─────────────────┐
│ Total | Today | Pending | Success  │
└────────────────────────────────────┘
┌─── TABLE ──────────────────────────┐
│ ID | Amount | Status | Date | Aksi │
│ ...                                │
│ Pagination                         │
└────────────────────────────────────┘
```

## 6. Component List

### Shared Components
- Button (primary, secondary, ghost, danger)
- Input (text, email, password, number, file)
- Select / Combobox
- Card (stat card, info card)
- Table (sortable, filterable, pagination)
- Badge (status: success, pending, failed, warning)
- Modal (confirm, detail, form)
- Toast (success, error, warning, info)
- Loading (skeleton, spinner)
- Empty state (illustration + message)
- Error state (message + retry button)
- Pagination
- Search input with debounce
- Date range picker

### Page-Specific Components
- PaymentReviewCard (proof image + OCR result + confirm/reject)
- InvoiceCard (QR image + amount + status + pay button)
- ApiKeyDisplay (prefix + copy + rotate)
- WorkspaceCard (name + slug + app count + member count)
- MemberList (avatar + name + role + actions)
- SubscriptionCard (tier + features + expiry + upgrade button)
- Chart (line chart for transactions, bar chart for revenue)

## 7. Dark Mode

CSS variables + Tailwind `dark:` prefix. Toggle di navbar.

```css
/* Light (default) */
--color-bg-page: var(--color-neutral-50);
--color-bg-card: white;
--color-text-body: var(--color-neutral-900);

/* Dark */
.dark {
  --color-bg-page: oklch(0.15 0.01 250);
  --color-bg-card: oklch(0.20 0.02 250);
  --color-text-body: oklch(0.90 0.01 80);
}
```

## 8. Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Single column, hamburger menu |
| Tablet | 640-1024px | 2 column, collapsed sidebar |
| Desktop | > 1024px | Full sidebar + content |
| Wide | > 1440px | Max width container |
