import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

const packageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
)
const projectRoot = dirname(fileURLToPath(import.meta.url))
const gitSafeProjectRoot = projectRoot.replaceAll('\\', '/')

function resolveGitCommit() {
  const environmentCommit = [
    process.env.VITE_GIT_COMMIT,
    process.env.GITHUB_SHA,
    process.env.CI_COMMIT_SHA,
    process.env.BUILD_SOURCEVERSION,
    process.env.GIT_COMMIT,
  ].find(value => typeof value === 'string' && value.trim())

  if (environmentCommit) return environmentCommit.trim().slice(0, 7)

  try {
    return execFileSync(
      'git',
      ['-c', `safe.directory=${gitSafeProjectRoot}`, 'rev-parse', '--short=7', 'HEAD'],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim() || 'unknown'
  } catch {
    return 'unknown'
  }
}

const appVersion = packageJson.version || 'unknown'
const gitCommit = resolveGitCommit()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __GIT_COMMIT__: JSON.stringify(gitCommit),
  },
  plugins: [
    vue(),
    vueDevTools(),
    AutoImport({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'css', locale: 'zh-cn' })],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:9860',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/element-plus') || id.includes('node_modules/@element-plus')) return 'element-plus'
          if (id.includes('node_modules/vue/') || id.includes('node_modules/vue-router') || id.includes('node_modules/pinia') || id.includes('node_modules/axios')) return 'vendor'
        },
      },
    },
  },
})
