import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { parse } from 'yaml'

const backendRoot = fileURLToPath(new URL('../../backend/', import.meta.url))

function resolveValue(value, variables) {
  let resolved = String(value)
  for (let depth = 0; depth < 10; depth++) {
    if (!resolved.includes('${')) return resolved
    const next = resolved.replace(/\$\{([^{}]+)\}/g, (_, expression) => {
      const separator = expression.indexOf(':')
      const name = separator < 0 ? expression : expression.slice(0, separator)
      const fallback = separator < 0 ? undefined : expression.slice(separator + 1)
      const replacement = variables[name] ?? fallback
      if (replacement === undefined) {
        throw new Error(`本地 API 代理缺少后端配置变量：${name}`)
      }
      return replacement
    })
    if (next === resolved) break
    resolved = next
  }
  throw new Error('无法解析后端 internal.signature.value 配置')
}

function readSignature(mode) {
  const variables = { ...loadEnv(mode, backendRoot, ''), ...process.env }
  let value = variables['internal.signature.value'] ?? variables.INTERNAL_SIGNATURE_VALUE
  if (value === undefined) {
    for (const relativePath of [
      'config/application-dev.yml',
      'config/application.yml',
      'src/main/resources/application-dev.yml',
    ]) {
      const path = fileURLToPath(new URL(relativePath, new URL('../../backend/', import.meta.url)))
      if (!existsSync(path)) continue
      let configuration
      try {
        configuration = parse(readFileSync(path, 'utf8'))
      } catch {
        throw new Error(`无法解析后端配置文件：${relativePath}`)
      }
      value = configuration?.internal?.signature?.value
      if (value !== undefined) break
    }
  }
  if (value === undefined || !resolveValue(value, variables).trim()) {
    throw new Error('本地 API 代理缺少后端 internal.signature.value 配置')
  }
  return resolveValue(value, variables)
}

// This module runs in Node only. The signature must never enter the browser bundle.
export function createDevApiProxy(mode) {
  const signature = readSignature(mode)
  return {
    '/api': {
      target: 'http://localhost:9860',
      changeOrigin: true,
      configure(proxy) {
        proxy.on('proxyReq', (request) => {
          request.setHeader('X-Internal-Signature', signature)
          request.setHeader('X-Internal-Timestamp', new Date().toISOString())
        })
      },
    },
  }
}
