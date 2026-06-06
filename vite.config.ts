import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'


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
    ...(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
      ? [sentryVitePlugin({ org: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT })]
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
    sourcemap: false,
    esbuild: {
      drop: ['console', 'debugger'],
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'vendor-supabase'
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
