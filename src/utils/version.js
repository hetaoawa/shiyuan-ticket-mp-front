function normalizeValue(value) {
  if (typeof value !== 'string') return 'unknown'
  return value.trim() || 'unknown'
}

function normalizeCommit(commit) {
  const normalized = normalizeValue(commit)
  return normalized === 'unknown' ? normalized : normalized.slice(0, 7)
}

const injectedVersion = typeof __APP_VERSION__ === 'undefined' ? undefined : __APP_VERSION__
const injectedCommit = typeof __GIT_COMMIT__ === 'undefined' ? undefined : __GIT_COMMIT__

export const frontendVersionInfo = Object.freeze({
  version: normalizeValue(injectedVersion),
  commit: normalizeCommit(injectedCommit),
})

export function formatVersionLabel(version, commit) {
  return `v${normalizeValue(version)} (${normalizeCommit(commit)})`
}

export const frontendVersionLabel = formatVersionLabel(
  frontendVersionInfo.version,
  frontendVersionInfo.commit,
)
