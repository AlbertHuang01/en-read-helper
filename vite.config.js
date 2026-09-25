import { defineConfig } from 'vite'
import { crx, defineManifest } from '@crxjs/vite-plugin'
import baseManifest from './manifest.json' with { type: 'json' }

const manifest = defineManifest(({ command }) => {
  const isDev = command === 'serve'

  return {
    ...baseManifest,
    name: isDev ? `${baseManifest.name}-dev` : `${baseManifest.name}-prod`,
  }
})

export default defineConfig(({ command }) => ({
  plugins: [crx({ manifest })],
  build: {
    outDir: command === 'serve' ? 'dist' : 'prod-dist',
    emptyOutDir: true,
  },
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
}))
