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
