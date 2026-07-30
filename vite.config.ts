import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

const hasSentryUpload = Boolean(
  process.env.SENTRY_AUTH_TOKEN
  && process.env.SENTRY_ORG
  && process.env.SENTRY_PROJECT
)

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    ...(hasSentryUpload
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          sourcemaps: {
            filesToDeleteAfterUpload: ['./dist/**/*.map'],
          },
        })]
      : []),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    // Hidden maps make production errors actionable without exposing source
    // URLs to browsers. They are generated only when the Sentry upload is
    // configured, then deleted after upload by the plugin above.
    sourcemap: hasSentryUpload ? 'hidden' : false,
    // Charting/PDF/Excel libraries are intentionally large but lazy-loaded
    // (dynamic import or route-level code splitting), so they never land in
    // the initial bundle. Raise the warning limit to avoid noise for those
    // known on-demand chunks.
    chunkSizeWarningLimit: 1000,
    esbuild: {
      drop: ['console', 'debugger'],
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'vendor-supabase'
            // Recharts also depends on clsx. Pin the app-shell styling helpers
            // before assigning Recharts, otherwise Rollup can absorb them into
            // vendor-charts and force the login screen to preload every chart.
            if (
              id.includes('/clsx/')
              || id.includes('/tailwind-merge/')
              || id.includes('/class-variance-authority/')
            ) return 'vendor-ui'
            if (id.includes('recharts')) return 'vendor-charts'
            if (id.includes('@radix-ui')) return 'vendor-ui'
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router/')
            ) return 'vendor-react'
          }
        },
      },
    },
  },
})
