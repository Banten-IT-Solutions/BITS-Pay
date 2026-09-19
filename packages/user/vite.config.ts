import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/user/',
  plugins: [tailwindcss(), svelte()],
  build: { outDir: 'dist' },
});
