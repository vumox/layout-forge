import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { cn } from "@/lib/utils"
import { nodeDecls, toStyle } from "@/layout/css"
import type { Area, Axis, GridEff, LayoutNode } from "@/layout/types"
import { ContainerBadge, Handles, SelectionFrame, type Edge } from "@/components/layout/handles"
import { NodeView } from "@/components/layout/node-view"
import { TrackChip } from "@/components/layout/track-chip"

type Cell = { c: number; r: number }
type Drag =
  | { kind: "create"; start: Cell; cur: Cell }
  | { kind: "move"; id: string; origin: Area; start: Cell; area: Area }
  | { kind: "resize"; id: string; edge: Edge; origin: Area; area: Area }

type Range = [number, number]

const HEAD = 26
const SIDE = 34
const ALL_EDGES: Edge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"]

export interface GridCanvasProps {
  node: LayoutNode
  eff: GridEff
  colsEditable: boolean
  rowsEditable: boolean
  selectedId: string | null
  overlay: boolean
  onSelect: (id: string | null) => void
  onFocus: (id: string) => void
  onArea: (id: string, area: Area) => void
  onCreate: (area: Area) => void
  onTrackSize: (axis: Axis, index: number, size: string) => void
  onTrackInsert: (axis: Axis, index: number) => void
  onTrackRemove: (axis: Axis, index: number) => void
}

function sameRanges(a: Range[], b: Range[]) {
  return a.length === b.length && a.every((r, i) => Math.abs(r[0] - b[i][0]) < 0.5 && Math.abs(r[1] - b[i][1]) < 0.5)
}

function rectArea(a: Cell, b: Cell): Area {
  return { c1: Math.min(a.c, b.c) + 1, c2: Math.max(a.c, b.c) + 2, r1: Math.min(a.r, b.r) + 1, r2: Math.max(a.r, b.r) + 2 }
}

export function GridCanvas(p: GridCanvasProps) {
  const { node, eff, overlay } = p
  const wrapRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [drag, setDragState] = useState<Drag | null>(null)
  const [ranges, setRanges] = useState<{ cols: Range[]; rows: Range[] }>({ cols: [], rows: [] })
  const [tick, setTick] = useState(0)
  const nCols = eff.columns.length
  const nRows = eff.rows.length

  const setDrag = (d: Drag | null) => {
    dragRef.current = d
    setDragState(d)
  }

  const measure = () => {
    const grid = gridRef.current
    const wrap = wrapRef.current
    if (!grid || !wrap) return null
    const base = wrap.getBoundingClientRect()
    const cols: Range[] = []
    const rows: Range[] = []
    grid.querySelectorAll<HTMLElement>("[data-cell]").forEach((el) => {
      const c = Number(el.dataset.col)
      const r = Number(el.dataset.row)
      const rect = el.getBoundingClientRect()
      if (r === 0) cols[c] = [rect.left - base.left, rect.right - base.left]
      if (c === 0) rows[r] = [rect.top - base.top, rect.bottom - base.top]
    })
    return { cols, rows, base }
  }

  useLayoutEffect(() => {
    const m = measure()
    if (!m) return
    setRanges((prev) => (sameRanges(prev.cols, m.cols) && sameRanges(prev.rows, m.rows) ? prev : { cols: m.cols, rows: m.rows }))
  })

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const ro = new ResizeObserver(() => setTick((t) => t + 1))
    ro.observe(grid)
    return () => ro.disconnect()
  }, [])

  const cellAt = (x: number, y: number): Cell => {
    const m = measure()
    if (!m || m.cols.length === 0) return { c: 0, r: 0 }
    const px = x - m.base.left
    const py = y - m.base.top
    const pick = (list: Range[], v: number) => {
      for (let i = 0; i < list.length; i++) {
        const next = list[i + 1]
        const boundary = next ? (list[i][1] + next[0]) / 2 : Infinity
        if (v < boundary) return i
      }
      return list.length - 1
    }
    return { c: pick(m.cols, px), r: pick(m.rows, py) }
  }

  const active = drag !== null
  useEffect(() => {
    if (!active) return
    const move = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const cell = cellAt(e.clientX, e.clientY)
      if (d.kind === "create") {
        if (cell.c !== d.cur.c || cell.r !== d.cur.r) setDrag({ ...d, cur: cell })
        return
      }
      if (d.kind === "move") {
        const w = d.origin.c2 - d.origin.c1
        const h = d.origin.r2 - d.origin.r1
        const c1 = Math.min(Math.max(1, d.origin.c1 + cell.c - d.start.c), Math.max(1, nCols - w + 1))
        const r1 = Math.min(Math.max(1, d.origin.r1 + cell.r - d.start.r), Math.max(1, nRows - h + 1))
        if (c1 !== d.area.c1 || r1 !== d.area.r1) setDrag({ ...d, area: { c1, c2: c1 + w, r1, r2: r1 + h } })
        return
      }
      const a = { ...d.origin }
      if (d.edge.includes("e")) a.c2 = Math.max(a.c1 + 1, cell.c + 2)
      if (d.edge.includes("w")) a.c1 = Math.min(a.c2 - 1, cell.c + 1)
      if (d.edge.includes("s")) a.r2 = Math.max(a.r1 + 1, cell.r + 2)
      if (d.edge.includes("n")) a.r1 = Math.min(a.r2 - 1, cell.r + 1)
      if (a.c1 !== d.area.c1 || a.c2 !== d.area.c2 || a.r1 !== d.area.r1 || a.r2 !== d.area.r2) setDrag({ ...d, area: a })
    }
    const up = () => {
      const d = dragRef.current
      setDrag(null)
      if (!d) return
      if (d.kind === "create") {
        if (d.start.c !== d.cur.c || d.start.r !== d.cur.r) p.onCreate(rectArea(d.start, d.cur))
        return
      }
      const o = d.origin
      const a = d.area
      if (o.c1 !== a.c1 || o.c2 !== a.c2 || o.r1 !== a.r1 || o.r2 !== a.r2) p.onArea(d.id, a)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
    }
  })

  const startCreate = (e: ReactPointerEvent, cell: Cell) => {
    if (e.button !== 0 || !overlay) return
    e.preventDefault()
    p.onSelect(null)
    setDrag({ kind: "create", start: cell, cur: cell })
  }

  const startMove = (e: ReactPointerEvent, child: LayoutNode) => {
    if (e.button !== 0) return
    e.stopPropagation()
    p.onSelect(child.id)
    if (!overlay) return
    e.preventDefault()
    setDrag({ kind: "move", id: child.id, origin: child.area, start: cellAt(e.clientX, e.clientY), area: child.area })
  }

  const startResize = (child: LayoutNode, edge: Edge) => {
    setDrag({ kind: "resize", id: child.id, edge, origin: child.area, area: child.area })
  }

  const rootStyle = toStyle(nodeDecls(node, null, { explicit: eff, skipSize: true }))
  const createArea = drag?.kind === "create" ? rectArea(drag.start, drag.cur) : null
  void tick

  return (
    <div ref={wrapRef} className="relative h-full">
      {overlay &&
        ranges.cols.map((r, i) =>
          r ? (
            <div key={`c${i}`} className="absolute p-px" style={{ top: -HEAD, left: r[0], width: r[1] - r[0], height: HEAD - 4 }}>
              <TrackChip
                axis="columns"
                index={i}
                size={eff.columns[i]}
                px={r[1] - r[0]}
                editable={p.colsEditable}
                canRemove={nCols > 1}
                onSize={(s) => p.onTrackSize("columns", i, s)}
                onInsert={(at) => p.onTrackInsert("columns", at)}
                onRemove={() => p.onTrackRemove("columns", i)}
              />
            </div>
          ) : null,
        )}
      {overlay &&
        ranges.rows.map((r, i) =>
          r ? (
            <div key={`r${i}`} className="absolute p-px" style={{ left: -SIDE, top: r[0], height: r[1] - r[0], width: SIDE - 6 }}>
              <TrackChip
                axis="rows"
                index={i}
                size={eff.rows[i]}
                px={r[1] - r[0]}
                editable={p.rowsEditable}
                canRemove={nRows > 1}
                onSize={(s) => p.onTrackSize("rows", i, s)}
                onInsert={(at) => p.onTrackInsert("rows", at)}
                onRemove={() => p.onTrackRemove("rows", i)}
              />
            </div>
          ) : null,
        )}
      <div
        ref={gridRef}
        className={cn("relative h-full", drag?.kind === "move" && "cursor-grabbing")}
        style={rootStyle}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) p.onSelect(null)
        }}
      >
        {overlay &&
          Array.from({ length: nRows }, (_, r) =>
            Array.from({ length: nCols }, (_, c) => (
              <button
                key={`${r}-${c}`}
                type="button"
                aria-label={`Create item at row ${r + 1}, column ${c + 1}`}
                data-cell=""
                data-col={c}
                data-row={r}
                onPointerDown={(e) => startCreate(e, { c, r })}
                onClick={(e) => {
                  if (e.detail === 0) p.onCreate({ c1: c + 1, c2: c + 2, r1: r + 1, r2: r + 2 })
                }}
                onDoubleClick={() => p.onCreate({ c1: c + 1, c2: c + 2, r1: r + 1, r2: r + 2 })}
                className="min-h-6 min-w-0 cursor-crosshair rounded-md border border-dashed border-foreground/15 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                style={{ gridColumn: c + 1, gridRow: r + 1, justifySelf: "stretch", alignSelf: "stretch" }}
              />
            )),
          )}
        {node.children.map((child) => {
          const dragging = drag && drag.kind !== "create" && drag.id === child.id
          const a = dragging ? drag.area : child.area
          const selected = p.selectedId === child.id
          const shown = dragging ? { ...child, area: a } : child
          return (
            <NodeView
              key={child.id}
              node={shown}
              parentLayout={node.layout}
              className={cn(
                "select-none",
                overlay && "cursor-grab",
                selected ? "z-[3]" : "z-[1]",
                dragging && "shadow-lg",
              )}
              onPointerDown={(e) => startMove(e, child)}
              onDoubleClick={(e) => {
                e.stopPropagation()
                if (child.layout) p.onFocus(child.id)
              }}
              overlay={
                <>
                  {child.layout && child.children.length > 0 && <ContainerBadge name={child.name} type={child.layout.type} />}
                  {selected && (
                    <SelectionFrame label={child.name} sub={dragging ? `${a.c1}/${a.c2} · ${a.r1}/${a.r2}` : undefined} />
                  )}
                  {selected && overlay && <Handles edges={ALL_EDGES} onStart={(_, edge) => startResize(child, edge)} />}
                </>
              }
            />
          )
        })}
        {createArea && (
          <div
            className="pointer-events-none z-[4] flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-primary/10 font-mono text-[11px] text-primary"
            style={{ gridColumn: `${createArea.c1} / ${createArea.c2}`, gridRow: `${createArea.r1} / ${createArea.r2}`, justifySelf: "stretch", alignSelf: "stretch" }}
          >
            {createArea.c2 - createArea.c1} × {createArea.r2 - createArea.r1}
          </div>
        )}
      </div>
    </div>
  )
}
