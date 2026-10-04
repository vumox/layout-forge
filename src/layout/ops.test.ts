import { describe, expect, it } from "vitest"
import { createNode, flexLayout, gridLayout } from "@/layout/defaults"
import { addChild, duplicateNode, insertTrack, moveChild, removeNode, removeTrack, reorderChild, setLayoutType, setTrackCount } from "@/layout/ops"

describe("layout operations", () => {
  it.each(["columns", "rows"] as const)("inserts %s without moving an item ending at the insertion line", (axis) => {
    const first = createNode()
    const spanning = createNode({ area: { c1: 1, c2: 3, r1: 1, r2: 3 } })
    const later = createNode({ area: { c1: 2, c2: 3, r1: 2, r2: 3 } })
    const layout = gridLayout(["10px", "20px"], ["30px", "40px"])
    const root = createNode({ layout, children: [first, spanning, later] })
    const original = structuredClone(root.children.map((n) => n.area))
    insertTrack(root, axis, 1)
    expect(layout[axis].map((t) => t.size)).toEqual(axis === "columns" ? ["10px", "20px", "20px"] : ["30px", "40px", "40px"])
    const start = axis === "columns" ? "c1" : "r1"
    const end = axis === "columns" ? "c2" : "r2"
    expect(first.area).toEqual(original[0])
    expect(spanning.area[end]).toBe(4)
    expect(later.area[start]).toBe(3)
    expect(later.area[end]).toBe(4)
    removeTrack(root, axis, 1)
    expect(root.children.map((n) => n.area)).toEqual(original)
  })

  it("keeps a nonempty track list and positive spans when removing an occupied track", () => {
    const layout = gridLayout(["1fr", "1fr"], ["1fr"])
    const child = createNode({ area: { c1: 2, c2: 3, r1: 1, r2: 2 } })
    const root = createNode({ layout, children: [child] })
    removeTrack(root, "columns", 1)
    expect(child.area.c2 - child.area.c1).toBe(1)
    setTrackCount(root, "columns", 0)
    expect(layout.columns).toHaveLength(1)
    setTrackCount(root, "rows", 3)
    expect(layout.rows.map((t) => t.size)).toEqual(["1fr", "1fr", "1fr"])
  })

  it("adds unnamed children to free cells with unique names and respects explicit placement", () => {
    const root = createNode({ id: "root", layout: gridLayout(["1fr", "1fr"], ["1fr"]) })
    expect(addChild(root, "root", { id: "a" })).toBe("a")
    expect(addChild(root, "root", { id: "b" })).toBe("b")
    expect(root.children.map((n) => n.name)).toEqual(["item-2", "item-3"])
    expect(root.children[1].area).toEqual({ c1: 2, c2: 3, r1: 1, r2: 2 })
    const area = { c1: 1, c2: 3, r1: 1, r2: 2 }
    addChild(root, "root", { area })
    expect(root.children[2].area).toEqual(area)
    expect(addChild(root, "a")).toBeNull()
    expect(addChild(root, "missing")).toBeNull()
  })

  it("duplicates a subtree with independent descendants and track identities", () => {
    const leaf = createNode({ id: "leaf", name: "leaf" })
    const source = createNode({ id: "source", name: "panel", layout: gridLayout(), children: [leaf] })
    const root = createNode({ id: "root", layout: flexLayout(), children: [source] })
    expect(duplicateNode(root, "source", "copy")).toBe("copy")
    const copy = root.children[1]
    expect(copy.name).toBe("panel-2")
    expect(copy.children[0].name).toBe("leaf-2")
    expect(copy.children[0].id).not.toBe(leaf.id)
    if (copy.layout?.type !== "grid" || source.layout?.type !== "grid") throw new Error("Expected grids")
    expect(copy.layout.columns[0].id).not.toBe(source.layout.columns[0].id)
    copy.layout.columns[0].size = "100px"
    copy.children[0].area.c1 = 9
    expect(source.layout.columns[0].size).toBe("1fr")
    expect(leaf.area.c1).toBe(1)
    expect(duplicateNode(root, "root")).toBeNull()
  })

  it("reorders siblings and ignores missing references and out-of-bounds moves", () => {
    const root = createNode({ children: ["a", "b", "c"].map((id) => createNode({ id })) })
    reorderChild(root, "c", "a", true)
    expect(root.children.map((n) => n.id)).toEqual(["c", "a", "b"])
    reorderChild(root, "c", "b", false)
    expect(root.children.map((n) => n.id)).toEqual(["a", "b", "c"])
    moveChild(root, "c", -1)
    reorderChild(root, "a", "missing", true)
    moveChild(root, "a", -1)
    expect(root.children.map((n) => n.id)).toEqual(["a", "c", "b"])
    removeNode(root, root.id)
    removeNode(root, "missing")
    removeNode(root, "c")
    expect(root.children.map((n) => n.id)).toEqual(["a", "b"])
  })

  it("places existing flex children into a grid and clears children when removing the layout", () => {
    const children = Array.from({ length: 4 }, () => createNode())
    const root = createNode({ layout: flexLayout(), children })
    setLayoutType(root, "grid")
    expect(children[3].area).toEqual({ c1: 1, c2: 2, r1: 2, r2: 3 })
    const layout = root.layout
    setLayoutType(root, "grid")
    expect(root.layout).toBe(layout)
    setLayoutType(root, null)
    expect(root.layout).toBeNull()
    expect(root.children).toEqual([])
  })
})
