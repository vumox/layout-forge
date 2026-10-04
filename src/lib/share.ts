import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string"
import { parseHash } from "./route"
import { flexLayout, gridLayout } from "@/layout/defaults"

const snapshots = new Map<string, unknown>()
const MAX_LENGTH = 24000

export function rememberState(key: string, value: unknown) {
  snapshots.set(key, value)
}

function activeKey() {
  const route = parseHash(location.hash)
  return route.tab === "tools" ? `lf-tool-${route.tool ?? "mesh"}` : `lf-${route.tab}`
}

function compatible(value: unknown, sample: unknown, depth = 0): boolean {
  if (depth > 30) return false
  if (sample === null) return value === null || typeof value === "string"
  if (Array.isArray(sample)) {
    return Array.isArray(value) && value.length <= 500 && (!sample.length || value.every((v) => compatible(v, sample[0], depth + 1)))
  }
  if (typeof sample === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false
    return Object.entries(sample).every(([k, v]) => Object.hasOwn(value, k) && compatible((value as Record<string, unknown>)[k], v, depth + 1))
  }
  return typeof value === typeof sample && (typeof value !== "number" || Number.isFinite(value))
}

function validLayoutNode(value: unknown, sample: unknown, depth = 0): boolean {
  if (depth > 20 || !value || typeof value !== "object") return false
  const node = value as Record<string, unknown>
  const { children: _children, layout: _layout, ...fields } = sample as Record<string, unknown>
  if (!compatible(node, fields) || !Array.isArray(node.children) || node.children.length > 200) return false
  if (node.layout !== null) {
    if (!node.layout || typeof node.layout !== "object") return false
    const layout = node.layout as Record<string, unknown>
    if (layout.type !== "grid" && layout.type !== "flex") return false
    if (!compatible(layout, layout.type === "grid" ? gridLayout() : flexLayout())) return false
  }
  return node.children.every((child) => validLayoutNode(child, sample, depth + 1))
}

export function sharedState<T>(key: string, initial: T): T | null {
  if (key !== activeKey()) return null
  try {
    const encoded = new URLSearchParams(location.hash.split("?")[1]).get("state")
    if (!encoded || encoded.length > MAX_LENGTH) return null
    const raw = decompressFromEncodedURIComponent(encoded)
    if (!raw || raw.length > 100000) return null
    const data = JSON.parse(raw)
    const valid = key === "lf-grid" || key === "lf-flex" ? validLayoutNode(data.state, initial) : compatible(data.state, initial)
    if (data.v !== 1 || !valid) return null
    return data.state as T
  } catch {
    return null
  }
}

export function createShareLink() {
  const state = snapshots.get(activeKey())
  if (!state) throw new Error("The tool is still loading. Please try again.")
  const raw = JSON.stringify({ v: 1, state })
  if (raw.length > 100000) throw new Error("This result is too large for a link. Export it as a file instead.")
  const encoded = compressToEncodedURIComponent(raw)
  if (encoded.length > MAX_LENGTH) throw new Error("This result is too large for a link. Export it as a file instead.")
  const url = new URL(location.href)
  url.search = ""
  url.hash = `${location.hash.split("?")[0]}?${new URLSearchParams({ state: encoded })}`
  return url.href
}
