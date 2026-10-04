import { describe, expect, it } from "vitest"
import * as THREE from "@/lib/three-runtime"
import { SCENE_PRESETS, sceneSource } from "@/lib/three-scenes"

describe("three runtime", () => {
  it.each(SCENE_PRESETS)("provides every Three.js member used by $id", ({ id }) => {
    const members = new Set([...sceneSource(id).matchAll(/\bTHREE\.([A-Za-z0-9_]+)/g)].map((match) => match[1]))
    expect(members.has("WebGLRenderer")).toBe(true)
    for (const member of members) {
      expect(THREE, `${id} needs THREE.${member}`).toHaveProperty(member)
    }
  })

  it("provides the displayed Three.js revision", () => {
    expect(THREE.REVISION).toMatch(/^\d+$/)
  })
})
