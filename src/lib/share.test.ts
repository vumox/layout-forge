import { afterEach, expect, test, vi } from "vitest"
import { createShareLink, rememberState, sharedState } from "./share"

afterEach(() => vi.unstubAllGlobals())

test("large highly compressible results are rejected before creating an unrestorable link", () => {
  vi.stubGlobal("location", { hash: "#tools/mesh", href: "https://example.com/#tools/mesh" })
  rememberState("lf-tool-mesh", { text: "a".repeat(100001) })
  expect(() => createShareLink()).toThrow("too large")
})

test("an active tool's current settings round trip through a share link", () => {
  vi.stubGlobal("location", { hash: "#tools/mesh", href: "https://example.com/#tools/mesh" })
  const state = { seed: 7, base: "#22d3ee", points: [{ x: 20, y: 80 }] }
  rememberState("lf-tool-mesh", state)
  const link = new URL(createShareLink())
  vi.stubGlobal("location", { hash: link.hash, href: link.href })
  expect(sharedState("lf-tool-mesh", state)).toEqual(state)
  expect(sharedState("lf-tool-glass", state)).toBeNull()
})
