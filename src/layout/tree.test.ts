import { describe, expect, it } from "vitest"
import { createNode, gridLayout } from "@/layout/defaults"
import { clampArea, countNodes, effAt, findNode, findParent, findPath, firstFreeCell, normalizeDraft, uniqueName } from "@/layout/tree"

describe("layout tree", () => {
  it("finds nested nodes and their ancestry without treating the root as its own parent", () => {
    const leaf = createNode({ id: "leaf", name: "item-2" })
    const branch = createNode({ id: "branch", children: [leaf] })
    const root = createNode({ id: "root", name: "item", children: [branch] })
    expect(findNode(root, "leaf")).toBe(leaf)
    expect(findPath(root, "leaf")).toEqual([root, branch, leaf])
    expect(findParent(root, "leaf")).toBe(branch)
    expect(findParent(root, "root")).toBeNull()
    expect(findNode(root, "missing")).toBeNull()
    expect(findPath(root, "missing")).toBeNull()
    expect(countNodes(root)).toBe(3)
    expect(uniqueName(root, "item")).toBe("item-3")
  })

  it.each([
    [{ c1: -1, c2: 99, r1: 8, r2: 0 }, 3, 2, { c1: 1, c2: 4, r1: 2, r2: 3 }],
    [{ c1: 4, c2: 1, r1: 4, r2: 1 }, 0, 0, { c1: 1, c2: 2, r1: 1, r2: 2 }],
  ])("clamps invalid areas while preserving at least one cell", (area, cols, rows, expected) => {
    expect(clampArea(area, cols, rows)).toEqual(expected)
  })

  it("inherits only the spanned subgrid tracks and their gap", () => {
    const layout = gridLayout(["10px", "20px", "30px"], ["40px"], 7)
    const sub = gridLayout(["1fr"], ["50px"], 3)
    sub.subgridColumns = true
    const child = createNode({ id: "sub", layout: sub, area: { c1: 2, c2: 4, r1: 1, r2: 2 } })
    const root = createNode({ layout, children: [child] })
    expect(effAt(root, "sub")).toEqual({ columns: ["20px", "30px"], rows: ["50px"], columnGap: 7, rowGap: 3 })
    expect(effAt(root, "missing")).toBeNull()
  })

  it("normalizes descendants against their own effective grid", () => {
    const leaf = createNode({ area: { c1: 4, c2: 8, r1: 2, r2: 7 } })
    const child = createNode({ layout: gridLayout(["1fr"], ["1fr"]), children: [leaf], area: { c1: 0, c2: 9, r1: 0, r2: 9 } })
    const root = createNode({ layout: gridLayout(["1fr", "1fr"], ["1fr"]), children: [child] })
    normalizeDraft(root)
    expect(child.area).toEqual({ c1: 1, c2: 3, r1: 1, r2: 2 })
    expect(leaf.area).toEqual({ c1: 1, c2: 2, r1: 1, r2: 2 })
  })

  it("skips every cell occupied by a spanning child in row-major order", () => {
    const root = createNode({ children: [createNode({ area: { c1: 1, c2: 3, r1: 1, r2: 2 } })] })
    const eff = { columns: ["1fr", "1fr"], rows: ["1fr", "1fr"], columnGap: 0, rowGap: 0 }
    expect(firstFreeCell(root, eff)).toEqual({ c1: 1, c2: 2, r1: 2, r2: 3 })
    root.children.push(createNode({ area: { c1: 1, c2: 3, r1: 2, r2: 3 } }))
    expect(firstFreeCell(root, eff)).toEqual({ c1: 1, c2: 2, r1: 1, r2: 2 })
  })
})
