import { defineConfig } from 'vite';
import type { Connect } from 'vite';

// appType 'mpa' (bukan SPA): landing statis + public/docs Swagger UI + public/guides.
// Vite SPA fallback me-lempar path statis seperti /docs/ ke index.html →
// di dev /docs/ tampil landing. 'mpa' tidak fallback, sehingga peta statis
// benar; tapi 'mpa' tanpa index redirect. Middleware di bawah mengarahkan
// path publik tanpa ekstensi ke file .html padanannya agar href="/docs/",
// "/privacy", "/terms" tampil halaman statis (bukan 404 / landing).
function redirectHtmlPages(): Connect.NextHandleFunction {
  return (req, _res, next) => {
    const url = decodeURIComponent((req.url ?? '').split('?')[0]);
    const map: Record<string, string> = {
      '/docs': '/docs/index.html',
      '/docs/': '/docs/index.html',
      '/privacy': '/privacy.html',
      '/terms': '/terms.html',
    };
    if (map[url]) req.url = map[url];
    next();
  };
}

export default defineConfig({
  appType: 'mpa',
  // Dev: SPA user/admin jalan terpisah (7003/7004). Di produksi keduanya
  // di-copy ke dist/{user,admin} dan di-serve worker yang sama.
  server: {
    proxy: {
      '/user': {
        target: 'http://localhost:7003',
        ws: true,
      },
      '/admin': {
        target: 'http://localhost:7004',
        ws: true,
      },
    },
  },
  preview: {
    proxy: {
      '/user': {
        target: 'http://localhost:7003',
        ws: true,
      },
      '/admin': {
        target: 'http://localhost:7004',
        ws: true,
      },
    },
  },
  plugins: [
    {
      name: 'redirect-html-pages',
      configureServer(server) {
        server.middlewares.use(redirectHtmlPages());
      },
      configurePreviewServer(server) {
        server.middlewares.use(redirectHtmlPages());
      },
    },
  ],
  build: {
    outDir: 'dist',
  },
});
