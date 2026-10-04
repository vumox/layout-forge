export const TABS = ["grid", "flex", "palette", "tools"] as const

export interface Route {
  tab: string | null
  tool: string | null
}

export function parseHash(hash: string): Route {
  const [a, b] = hash.split("?")[0].replace(/^#\/?/, "").split("/")
  if (!a) return { tab: null, tool: null }
  if (a === "tools") return { tab: "tools", tool: b || null }
  if ((TABS as readonly string[]).includes(a)) return { tab: a, tool: null }
  return { tab: "tools", tool: a }
}

export function writeHash(tab: string, tool?: string) {
  const next = tab === "tools" && tool ? `#tools/${tool}` : `#${tab}`
  if (location.hash.split("?")[0] !== next) history.replaceState(null, "", next)
}

export function navigateTo(hash: string) {
  location.hash = hash
}
