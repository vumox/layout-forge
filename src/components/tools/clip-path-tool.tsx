import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { FlipHorizontal2Icon, FlipVertical2Icon, ImageUpIcon, KeyboardIcon, Redo2Icon, RotateCwIcon, Undo2Icon } from "lucide-react"
import { usePersistent } from "@/lib/use-persistent"
import { cn } from "@/lib/utils"
import { ColorInput } from "@/components/color-input"
import { Field, IconButton, NumberInput, Section, SliderField } from "@/components/fields"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PresetGrid, ToolLayout } from "@/components/tools/tool-layout"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type Shape = "polygon" | "circle" | "ellipse" | "inset"
type P = [number, number]

interface State {
  shape: Shape
  points: P[]
  circle: { r: number; cx: number; cy: number }
  ellipse: { rx: number; ry: number; cx: number; cy: number }
  inset: { t: number; r: number; b: number; l: number; round: number }
  ghost: boolean
  snap: number
  from: string
  to: string
}

const regular = (n: number, rot = -90): P[] =>
  Array.from({ length: n }, (_, i) => {
    const a = ((rot + (360 / n) * i) * Math.PI) / 180
    return [Math.round((50 + 50 * Math.cos(a)) * 10) / 10, Math.round((50 + 50 * Math.sin(a)) * 10) / 10]
  })

const star = (n: number, inner: number): P[] =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = ((-90 + (180 / n) * i) * Math.PI) / 180
    const r = i % 2 === 0 ? 50 : 50 * inner
    return [Math.round((50 + r * Math.cos(a)) * 10) / 10, Math.round((50 + r * Math.sin(a)) * 10) / 10]
  })

const POLY: { id: string; name: string; points: P[] }[] = [
  { id: "triangle", name: "Triangle", points: [[50, 0], [100, 100], [0, 100]] },
  { id: "trapezoid", name: "Trapezoid", points: [[20, 0], [80, 0], [100, 100], [0, 100]] },
  { id: "parallelogram", name: "Parallelogram", points: [[25, 0], [100, 0], [75, 100], [0, 100]] },
  { id: "rhombus", name: "Rhombus", points: [[50, 0], [100, 50], [50, 100], [0, 50]] },
  { id: "pentagon", name: "Pentagon", points: regular(5) },
  { id: "hexagon", name: "Hexagon", points: regular(6, 0) },
  { id: "octagon", name: "Octagon", points: regular(8, -67.5) },
  { id: "star", name: "Star", points: star(5, 0.42) },
  { id: "burst", name: "Flash", points: star(12, 0.78) },
  { id: "cross", name: "Cross", points: [[35, 0], [65, 0], [65, 35], [100, 35], [100, 65], [65, 65], [65, 100], [35, 100], [35, 65], [0, 65], [0, 35], [35, 35]] },
  { id: "close", name: "Close", points: [[20, 0], [50, 30], [80, 0], [100, 20], [70, 50], [100, 80], [80, 100], [50, 70], [20, 100], [0, 80], [30, 50], [0, 20]] },
  { id: "arrow", name: "Arrow", points: [[0, 30], [60, 30], [60, 10], [100, 50], [60, 90], [60, 70], [0, 70]] },
  { id: "chevron", name: "Chevron", points: [[0, 0], [75, 0], [100, 50], [75, 100], [0, 100], [25, 50]] },
  { id: "message", name: "Message", points: [[0, 0], [100, 0], [100, 75], [75, 75], [75, 100], [50, 75], [0, 75]] },
  { id: "bevel", name: "Bevel", points: [[20, 0], [80, 0], [100, 20], [100, 80], [80, 100], [20, 100], [0, 80], [0, 20]] },
  { id: "slant", name: "Section", points: [[0, 0], [100, 0], [100, 85], [0, 100]] },
]

const DEFAULTS: State = {
  shape: "polygon",
  points: POLY[7].points,
  circle: { r: 45, cx: 50, cy: 50 },
  ellipse: { rx: 45, ry: 30, cx: 50, cy: 50 },
  inset: { t: 10, r: 10, b: 10, l: 10, round: 16 },
  ghost: true,
  snap: 1,
  from: "#6d4aff",
  to: "#ec4899",
}

const n = (v: number) => `${Math.round(v * 10) / 10}%`

function clipValue(s: State): string {
  switch (s.shape) {
    case "polygon":
      return `polygon(${s.points.map(([x, y]) => `${n(x)} ${n(y)}`).join(", ")})`
    case "circle":
      return `circle(${n(s.circle.r)} at ${n(s.circle.cx)} ${n(s.circle.cy)})`
    case "ellipse":
      return `ellipse(${n(s.ellipse.rx)} ${n(s.ellipse.ry)} at ${n(s.ellipse.cx)} ${n(s.ellipse.cy)})`
    case "inset": {
      const i = s.inset
      return `inset(${n(i.t)} ${n(i.r)} ${n(i.b)} ${n(i.l)}${i.round ? ` round ${i.round}px` : ""})`
    }
  }
}

function distToSegment(p: P, a: P, b: P) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}


type Handle = { key: string; x: number; y: number; kind: "point" | "center" | "size" | "edge" }

type Drag =
  | { kind: "points"; idx: number[]; whole: boolean; start: P; origin: P[]; moved: boolean }
  | { kind: "handle"; key: string; start: P; origin: State; moved: boolean }
  | { kind: "marquee"; start: P; cur: P; base: number[] }

const SNAP_DIST = 1.5
const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v))
const r1 = (v: number) => Math.round(v * 10) / 10

function lockAxis(dx: number, dy: number): [number, number] {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ax > ay * 2) return [dx, 0]
  if (ay > ax * 2) return [0, dy]
  const d = (ax + ay) / 2
  return [Math.sign(dx) * d, Math.sign(dy) * d]
}

function nearest(anchors: number[], targets: number[]) {
  let best: { shift: number; at: number } | null = null
  for (const a of anchors) {
    for (const t of targets) {
      const d = t - a
      if (Math.abs(d) <= SNAP_DIST && (!best || Math.abs(d) < Math.abs(best.shift))) best = { shift: d, at: t }
    }
  }
  return best
}

function bbox(pts: P[]) {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x1 = Math.min(...xs)
  const x2 = Math.max(...xs)
  const y1 = Math.min(...ys)
  const y2 = Math.max(...ys)
  return { x1, x2, y1, y2, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 }
}

const SHORTCUTS: [string, string][] = [
  ["Ctrl+Z", "undo"],
  ["Ctrl+Shift+Z / Ctrl+Y", "redo"],
  ["Shift + drag", "axis or 45°, circle, symmetry"],
  ["Ctrl + drag", "no snapping to guides"],
  ["Click / Ctrl+click", "select a point / add to selection"],
  ["Frame on empty space", "select multiple points"],
  ["Shape body", "drag the whole shape"],
  ["Ctrl+A · Esc", "select all · deselect"],
  ["PageDown / PageUp", "next / previous point"],
  ["Arrows · Shift+arrows", "nudge by step · ×10"],
  ["Delete", "delete selected points"],
  ["Double click", "new point on the edge"],
  ["Alt+click / RMB", "delete point"],
  ["H · V", "flip horizontally · vertically"],
  ["R · Shift+R", "rotate 90° clockwise / counterclockwise"],
]

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || !!t.closest("[role=dialog],[role=listbox],[role=menu]"))
}

export function ClipPathTool() {
  const [s, set, replace] = usePersistent<State>("lf-tool-clip", DEFAULTS)
  const [image, setImage] = useState<string | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [drag, setDragState] = useState<Drag | null>(null)
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({})
  const [counts, setCounts] = useState({ u: 0, r: 0 })
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const sRef = useRef(s)
  const past = useRef<State[]>([])
  const future = useRef<State[]>([])
  const lastKey = useRef<{ key: string; time: number } | null>(null)
  const clip = clipValue(s)
  const step = s.snap || 1

  useLayoutEffect(() => {
    sRef.current = s
  })

  const setDrag = (d: Drag | null) => {
    dragRef.current = d
    setDragState(d)
  }

  const snapshot = (key?: string) => {
    const now = Date.now()
    if (key && lastKey.current?.key === key && now - lastKey.current.time < 800) {
      lastKey.current.time = now
      return
    }
    lastKey.current = key ? { key, time: now } : null
    past.current = [...past.current.slice(-99), sRef.current]
    future.current = []
    setCounts({ u: past.current.length, r: future.current.length })
  }

  const commit = (patch: Partial<State>, key?: string) => {
    snapshot(key)
    set(patch)
  }

  const undo = () => {
    const prev = past.current.pop()
    if (!prev) return
    future.current.push(sRef.current)
    lastKey.current = null
    replace(prev)
    setSelected((sel) => sel.filter((i) => i < prev.points.length))
    setCounts({ u: past.current.length, r: future.current.length })
  }

  const redo = () => {
    const next = future.current.pop()
    if (!next) return
    past.current.push(sRef.current)
    lastKey.current = null
    replace(next)
    setSelected((sel) => sel.filter((i) => i < next.points.length))
    setCounts({ u: past.current.length, r: future.current.length })
  }

  const raw = (e: { clientX: number; clientY: number }): P => {
    const r = boxRef.current?.getBoundingClientRect()
    if (!r) return [0, 0]
    return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100]
  }

  const q = (v: number) => r1(Math.round(v / step) * step)

  const handles: Handle[] = (() => {
    switch (s.shape) {
      case "polygon":
        return s.points.map(([x, y], i) => ({ key: `p${i}`, x, y, kind: "point" as const }))
      case "circle":
        return [
          { key: "c", x: s.circle.cx, y: s.circle.cy, kind: "center" as const },
          { key: "r", x: s.circle.cx + s.circle.r, y: s.circle.cy, kind: "size" as const },
        ]
      case "ellipse":
        return [
          { key: "c", x: s.ellipse.cx, y: s.ellipse.cy, kind: "center" as const },
          { key: "rx", x: s.ellipse.cx + s.ellipse.rx, y: s.ellipse.cy, kind: "size" as const },
          { key: "ry", x: s.ellipse.cx, y: s.ellipse.cy + s.ellipse.ry, kind: "size" as const },
        ]
      case "inset":
        return [
          { key: "t", x: 50, y: s.inset.t, kind: "edge" as const },
          { key: "r", x: 100 - s.inset.r, y: 50, kind: "edge" as const },
          { key: "b", x: 50, y: 100 - s.inset.b, kind: "edge" as const },
          { key: "l", x: s.inset.l, y: 50, kind: "edge" as const },
        ]
    }
  })()

  const movePoints = (d: Extract<Drag, { kind: "points" }>, dx0: number, dy0: number, free: boolean) => {
    const moving = new Set(d.idx)
    const movingPts = d.idx.map((i) => d.origin[i])
    const box = bbox(movingPts)
    let dx = clamp(dx0, -box.x1, 100 - box.x2)
    let dy = clamp(dy0, -box.y1, 100 - box.y2)
    const anchor = movingPts[0]
    dx = q(anchor[0] + dx) - anchor[0]
    dy = q(anchor[1] + dy) - anchor[1]
    const g: { x?: number; y?: number } = {}
    if (!free) {
      const others = d.origin.filter((_, i) => !moving.has(i))
      const anchorsX = d.whole ? [box.x1 + dx, box.cx + dx, box.x2 + dx] : movingPts.map((p) => p[0] + dx)
      const anchorsY = d.whole ? [box.y1 + dy, box.cy + dy, box.y2 + dy] : movingPts.map((p) => p[1] + dy)
      const sx = nearest(anchorsX, [0, 50, 100, ...others.map((p) => p[0])])
      const sy = nearest(anchorsY, [0, 50, 100, ...others.map((p) => p[1])])
      if (sx) {
        dx += sx.shift
        g.x = sx.at
      }
      if (sy) {
        dy += sy.shift
        g.y = sy.at
      }
    }
    setGuides(g)
    set({ points: d.origin.map((p, i) => (moving.has(i) ? [r1(clamp(p[0] + dx)), r1(clamp(p[1] + dy))] : p)) })
  }

  const moveHandle = (d: Extract<Drag, { kind: "handle" }>, cur: P, dx: number, dy: number, shift: boolean, free: boolean) => {
    const o = d.origin
    const snapCenter = (cx: number, cy: number) => {
      let x = q(clamp(cx))
      let y = q(clamp(cy))
      const g: { x?: number; y?: number } = {}
      if (!free) {
        if (Math.abs(x - 50) <= SNAP_DIST) x = g.x = 50
        if (Math.abs(y - 50) <= SNAP_DIST) y = g.y = 50
      }
      setGuides(g)
      return [x, y]
    }
    if (o.shape === "circle") {
      if (d.key === "c") {
        const [cx, cy] = snapCenter(o.circle.cx + dx, o.circle.cy + dy)
        set({ circle: { ...o.circle, cx, cy } })
      } else set({ circle: { ...o.circle, r: Math.max(1, q(Math.hypot(cur[0] - o.circle.cx, cur[1] - o.circle.cy))) } })
    } else if (o.shape === "ellipse") {
      const e = o.ellipse
      if (d.key === "c") {
        const [cx, cy] = snapCenter(e.cx + dx, e.cy + dy)
        set({ ellipse: { ...e, cx, cy } })
      } else if (d.key === "rx") {
        const rx = Math.max(1, q(Math.abs(cur[0] - e.cx)))
        set({ ellipse: { ...e, rx, ry: shift ? rx : e.ry } })
      } else {
        const ry = Math.max(1, q(Math.abs(cur[1] - e.cy)))
        set({ ellipse: { ...e, ry, rx: shift ? ry : e.rx } })
      }
    } else if (o.shape === "inset") {
      const i = o.inset
      const v = (x: number) => q(clamp(x, 0, 49))
      if (d.key === "move") {
        const mx = clamp(dx, -i.l, i.r)
        const my = clamp(dy, -i.t, i.b)
        set({ inset: { ...i, l: q(i.l + mx), r: q(i.r - mx), t: q(i.t + my), b: q(i.b - my) } })
      } else if (d.key === "t") {
        const t = shift ? v(cur[1]) : q(clamp(cur[1], 0, 99 - i.b))
        set({ inset: { ...i, t, b: shift ? t : i.b } })
      } else if (d.key === "b") {
        const b = shift ? v(100 - cur[1]) : q(clamp(100 - cur[1], 0, 99 - i.t))
        set({ inset: { ...i, b, t: shift ? b : i.t } })
      } else if (d.key === "l") {
        const l = shift ? v(cur[0]) : q(clamp(cur[0], 0, 99 - i.r))
        set({ inset: { ...i, l, r: shift ? l : i.r } })
      } else if (d.key === "r") {
        const r = shift ? v(100 - cur[0]) : q(clamp(100 - cur[0], 0, 99 - i.l))
        set({ inset: { ...i, r, l: shift ? r : i.l } })
      }
    }
  }

  const active = drag !== null
  useEffect(() => {
    if (!active) return
    const move = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const cur = raw(e)
      if (d.kind === "marquee") {
        const next = { ...d, cur }
        const x1 = Math.min(d.start[0], cur[0])
        const x2 = Math.max(d.start[0], cur[0])
        const y1 = Math.min(d.start[1], cur[1])
        const y2 = Math.max(d.start[1], cur[1])
        const inside = sRef.current.points.flatMap(([x, y], i) => (x >= x1 && x <= x2 && y >= y1 && y <= y2 ? [i] : []))
        setSelected([...new Set([...d.base, ...inside])])
        setDrag(next)
        return
      }
      let dx = cur[0] - d.start[0]
      let dy = cur[1] - d.start[1]
      const lockable = d.kind === "points" || d.key === "c" || d.key === "move"
      if (e.shiftKey && lockable) [dx, dy] = lockAxis(dx, dy)
      if (!d.moved) {
        if (Math.hypot(dx, dy) < 0.4) return
        snapshot()
        d.moved = true
      }
      const free = e.ctrlKey || e.metaKey
      if (d.kind === "points") movePoints(d, dx, dy, free)
      else moveHandle(d, cur, dx, dy, e.shiftKey, free)
    }
    const up = () => {
      setDrag(null)
      setGuides({})
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
  })

  const startHandle = (e: ReactPointerEvent, h: Handle, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (h.kind === "point") {
      if (e.altKey || e.button === 2) {
        if (s.points.length > 3) {
          commit({ points: s.points.filter((_, j) => j !== index) })
          setSelected([])
        }
        return
      }
      if (e.button !== 0) return
      const additive = e.ctrlKey || e.metaKey
      let idx: number[]
      if (additive) idx = selected.includes(index) ? selected.filter((i) => i !== index) : [...selected, index]
      else idx = selected.includes(index) ? selected : [index]
      setSelected(idx)
      if (!idx.includes(index)) return
      const ordered = [index, ...idx.filter((i) => i !== index)]
      setDrag({ kind: "points", idx: ordered, whole: false, start: raw(e), origin: s.points, moved: false })
      return
    }
    if (e.button !== 0) return
    setDrag({ kind: "handle", key: h.key, start: raw(e), origin: s, moved: false })
  }

  const startBody = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    if (s.shape === "polygon") {
      const all = s.points.map((_, i) => i)
      setSelected(all)
      setDrag({ kind: "points", idx: all, whole: true, start: raw(e), origin: s.points, moved: false })
    } else {
      setDrag({ kind: "handle", key: s.shape === "inset" ? "move" : "c", start: raw(e), origin: s, moved: false })
    }
  }

  const startEmpty = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    const additive = e.ctrlKey || e.metaKey || e.shiftKey
    if (!additive) setSelected([])
    if (s.shape === "polygon") setDrag({ kind: "marquee", start: raw(e), cur: raw(e), base: additive ? selected : [] })
  }

  const addPoint = (e: React.MouseEvent) => {
    if (s.shape !== "polygon") return
    const [x, y] = raw(e)
    const p: P = [q(clamp(x)), q(clamp(y))]
    let best = 0
    let bd = Infinity
    s.points.forEach((a, i) => {
      const d = distToSegment(p, a, s.points[(i + 1) % s.points.length])
      if (d < bd) {
        bd = d
        best = i
      }
    })
    const pts = [...s.points]
    pts.splice(best + 1, 0, p)
    commit({ points: pts })
    setSelected([best + 1])
  }

  const targetIdx = () => (selected.length > 0 ? selected : s.points.map((_, i) => i))

  const transform = (fn: (p: P, c: { cx: number; cy: number }) => P) => {
    if (s.shape !== "polygon") return
    const idx = targetIdx()
    const box = bbox(idx.map((i) => s.points[i]))
    const set1 = new Set(idx)
    commit({ points: s.points.map((p, i) => (set1.has(i) ? (fn(p, box).map((v) => r1(clamp(v))) as P) : p)) })
  }

  const flipH = () => {
    if (s.shape === "inset") commit({ inset: { ...s.inset, l: s.inset.r, r: s.inset.l } })
    else transform(([x, y], c) => [2 * c.cx - x, y])
  }
  const flipV = () => {
    if (s.shape === "inset") commit({ inset: { ...s.inset, t: s.inset.b, b: s.inset.t } })
    else transform(([x, y], c) => [x, 2 * c.cy - y])
  }
  const rotate = (ccw = false) => {
    if (s.shape === "ellipse") return commit({ ellipse: { ...s.ellipse, rx: s.ellipse.ry, ry: s.ellipse.rx } })
    if (s.shape === "inset") {
      const i = s.inset
      return commit({ inset: ccw ? { ...i, t: i.r, r: i.b, b: i.l, l: i.t } : { ...i, t: i.l, r: i.t, b: i.r, l: i.b } })
    }
    transform(([x, y], c) => (ccw ? [c.cx + (y - c.cy), c.cy - (x - c.cx)] : [c.cx - (y - c.cy), c.cy + (x - c.cx)]))
  }

  const nudge = (dx: number, dy: number) => {
    if (s.shape === "polygon") {
      const idx = targetIdx()
      const box = bbox(idx.map((i) => s.points[i]))
      const mx = clamp(dx, -box.x1, 100 - box.x2)
      const my = clamp(dy, -box.y1, 100 - box.y2)
      const set1 = new Set(idx)
      commit({ points: s.points.map((p, i) => (set1.has(i) ? [r1(p[0] + mx), r1(p[1] + my)] : p)) }, "nudge")
    } else if (s.shape === "circle") commit({ circle: { ...s.circle, cx: r1(clamp(s.circle.cx + dx)), cy: r1(clamp(s.circle.cy + dy)) } }, "nudge")
    else if (s.shape === "ellipse") commit({ ellipse: { ...s.ellipse, cx: r1(clamp(s.ellipse.cx + dx)), cy: r1(clamp(s.ellipse.cy + dy)) } }, "nudge")
    else {
      const i = s.inset
      const mx = clamp(dx, -i.l, i.r)
      const my = clamp(dy, -i.t, i.b)
      commit({ inset: { ...i, l: r1(i.l + mx), r: r1(i.r - mx), t: r1(i.t + my), b: r1(i.b - my) } }, "nudge")
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || !boxRef.current?.contains(e.target as Node)) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && key === "z") {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && key === "y") {
        e.preventDefault()
        redo()
        return
      }
      if (mod && key === "a" && s.shape === "polygon") {
        e.preventDefault()
        setSelected(s.points.map((_, i) => i))
        return
      }
      if (mod) return
      if (e.key === "Escape") return setSelected([])
      if ((e.key === "Delete" || e.key === "Backspace") && s.shape === "polygon" && selected.length > 0) {
        e.preventDefault()
        const keep = s.points.filter((_, i) => !selected.includes(i))
        if (keep.length >= 3) {
          commit({ points: keep })
          setSelected([])
        }
        return
      }
      if ((e.key === "PageDown" || e.key === "PageUp") && s.shape === "polygon") {
        e.preventDefault()
        const n = s.points.length
        const previous = e.key === "PageUp"
        const cur = selected.length === 1 ? selected[0] : previous ? 0 : -1
        setSelected([(cur + (previous ? -1 : 1) + n) % n])
        return
      }
      if (e.key.startsWith("Arrow")) {
        e.preventDefault()
        const d = step * (e.shiftKey ? 10 : 1)
        const dir = e.key.slice(5)
        nudge(dir === "Left" ? -d : dir === "Right" ? d : 0, dir === "Up" ? -d : dir === "Down" ? d : 0)
        return
      }
      if (key === "h") return flipH()
      if (key === "v") return flipV()
      if (key === "r") return rotate(e.shiftKey)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const bg = image ? `center / cover no-repeat url(${image})` : `linear-gradient(135deg, ${s.from}, ${s.to})`
  const svgPoints = s.points.map(([x, y]) => `${(x / 100).toFixed(4)},${(y / 100).toFixed(4)}`).join(" ")
  const single = s.shape === "polygon" && selected.length === 1 ? s.points[selected[0]] : null

  const outputs = [
    { id: "css", label: "CSS", lang: "css", file: "clip-path.css", code: `.shape {\n  -webkit-clip-path: ${clip};\n  clip-path: ${clip};\n}\n` },
    {
      id: "tw",
      label: "Tailwind",
      lang: "jsx",
      file: "Shape.jsx",
      code: `<div className="[clip-path:${clip.replace(/,\s*/g, ",").replace(/\s+/g, "_")}]" />\n`,
    },
    ...(s.shape === "polygon"
      ? [
          {
            id: "svg",
            label: "SVG clipPath",
            lang: "html",
            file: "clip.svg",
            code: `<svg width="0" height="0" aria-hidden="true">\n  <clipPath id="shape" clipPathUnits="objectBoundingBox">\n    <polygon points="${svgPoints}" />\n  </clipPath>\n</svg>\n\n<style>\n  .shape {\n    clip-path: url(#shape);\n  }\n</style>\n`,
          },
        ]
      : []),
  ]

  const controls = (
    <>
      <Section title="Shape">
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          className="w-full"
          value={[s.shape]}
          onValueChange={(v) => {
            if (!v[0]) return
            commit({ shape: v[0] as Shape })
            setSelected([])
          }}
        >
          {(["polygon", "circle", "ellipse", "inset"] as Shape[]).map((sh) => (
            <ToggleGroupItem key={sh} value={sh} className="flex-1 font-mono text-[11px]">
              {sh}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {s.shape === "polygon" && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Points: {s.points.length}
            {selected.length > 0 && ` · selected: ${selected.length}`}
          </p>
        )}
        {single && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="X, %">
              <NumberInput value={single[0]} min={0} max={100} step={0.5} onChange={(x) => commit({ points: s.points.map((p, i) => (i === selected[0] ? [x, p[1]] : p)) }, "xy")} />
            </Field>
            <Field label="Y, %">
              <NumberInput value={single[1]} min={0} max={100} step={0.5} onChange={(y) => commit({ points: s.points.map((p, i) => (i === selected[0] ? [p[0], y] : p)) }, "xy")} />
            </Field>
          </div>
        )}
        {s.shape === "inset" && (
          <SliderField label="round" value={s.inset.round} min={0} max={120} onChange={(round) => commit({ inset: { ...s.inset, round } }, "round")} />
        )}
      </Section>
      <Section title="Templates">
        <PresetGrid
          items={POLY}
          cols={4}
          active={s.shape === "polygon" ? POLY.find((p) => JSON.stringify(p.points) === JSON.stringify(s.points))?.id : undefined}
          onPick={(p) => {
            commit({ shape: "polygon", points: p.points })
            setSelected([])
          }}
          render={(p) => (
            <div
              className="size-4/5 bg-gradient-to-br from-violet-500 to-pink-500"
              style={{ clipPath: `polygon(${p.points.map(([x, y]) => `${x}% ${y}%`).join(", ")})` }}
            />
          )}
        />
      </Section>
      <Section title="Editor">
        <SliderField label="Snap step" value={s.snap} min={0.5} max={10} step={0.5} unit="%" onChange={(snap) => set({ snap })} />
        <div className="flex items-center justify-between">
          <Label htmlFor="ghost" className="text-xs">
            Show cropped area
          </Label>
          <Switch id="ghost" size="sm" checked={s.ghost} onCheckedChange={(ghost) => set({ ghost })} />
        </div>
      </Section>
      <Section title="Preview fill">
        <div className="grid grid-cols-2 gap-2">
          <Field label="From">
            <ColorInput value={s.from} compact onChange={(from) => set({ from })} />
          </Field>
          <Field label="Before">
            <ColorInput value={s.to} compact onChange={(to) => set({ to })} />
          </Field>
        </div>
        <label className="flex h-8 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted/50">
          <ImageUpIcon className="size-4" />
          {image ? "Replace image" : "Upload image"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              if (image) URL.revokeObjectURL(image)
              setImage(URL.createObjectURL(f))
            }}
          />
        </label>
      </Section>
    </>
  )

  const marquee = drag?.kind === "marquee" ? drag : null
  const canTransform = s.shape === "polygon" || s.shape === "inset"

  return (
    <ToolLayout controls={controls} outputs={outputs}>
      <div className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border bg-background/95 p-0.5 shadow-sm backdrop-blur">
        <IconButton label="Undo (Ctrl+Z)" onClick={undo} disabled={counts.u === 0}>
          <Undo2Icon />
        </IconButton>
        <IconButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={counts.r === 0}>
          <Redo2Icon />
        </IconButton>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <IconButton label="Flip horizontally (H)" onClick={flipH} disabled={!canTransform}>
          <FlipHorizontal2Icon />
        </IconButton>
        <IconButton label="Flip vertically (V)" onClick={flipV} disabled={!canTransform}>
          <FlipVertical2Icon />
        </IconButton>
        <IconButton label="Rotate 90° (R)" onClick={() => rotate()} disabled={s.shape === "circle"}>
          <RotateCwIcon />
        </IconButton>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <Popover>
          <PopoverTrigger className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Hotkeys">
            <KeyboardIcon className="size-4" />
          </PopoverTrigger>
          <PopoverContent side="bottom" className="w-96">
            <p className="text-xs font-medium">Hotkeys</p>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              {SHORTCUTS.map(([k, v]) => (
                <div key={k} className="contents">
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap">{k}</kbd>
                  <span className="text-muted-foreground">{v}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex h-full min-h-[460px] touch-none items-center justify-center p-10 pt-16" onPointerDown={startEmpty}>
        <div
          ref={boxRef}
          tabIndex={0}
          role="group"
          aria-label="Clip-path canvas"
          onPointerDownCapture={(e) => e.currentTarget.focus()}
          onDoubleClick={addPoint}
          onContextMenu={(e) => e.preventDefault()}
          className={cn("relative aspect-square w-[min(100%,480px)] touch-none select-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", s.shape === "polygon" && "cursor-crosshair")}
        >
          {s.ghost && <div className="pointer-events-none absolute inset-0 rounded-sm opacity-15" style={{ background: bg }} />}
          <div
            onPointerDown={startBody}
            className={cn("absolute inset-0 cursor-move", !drag && "transition-[clip-path] duration-150")}
            style={{ background: bg, clipPath: clip }}
          />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible">
            <rect x="0" y="0" width="100" height="100" fill="none" stroke="var(--foreground)" strokeOpacity="0.15" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            {s.shape === "polygon" && (
              <polygon points={s.points.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--foreground)" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
            )}
            {guides.x !== undefined && <line x1={guides.x} x2={guides.x} y1="-4" y2="104" stroke="#ec4899" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
            {guides.y !== undefined && <line y1={guides.y} y2={guides.y} x1="-4" x2="104" stroke="#ec4899" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
            {marquee && (
              <rect
                x={Math.min(marquee.start[0], marquee.cur[0])}
                y={Math.min(marquee.start[1], marquee.cur[1])}
                width={Math.abs(marquee.cur[0] - marquee.start[0])}
                height={Math.abs(marquee.cur[1] - marquee.start[1])}
                fill="var(--primary)"
                fillOpacity="0.08"
                stroke="var(--primary)"
                strokeWidth="1"
                strokeDasharray="3 2"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
          {handles.map((h, i) => {
            const isSel = h.kind === "point" && selected.includes(i)
            return (
              <span
                key={h.key}
                onPointerDown={(e) => startHandle(e, h, i)}
                onDoubleClick={(e) => e.stopPropagation()}
                title={`${n(h.x)} ${n(h.y)}`}
                className={cn(
                  "absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 shadow ring-1 transition-[width,height,background-color] active:cursor-grabbing",
                  isSel ? "size-4 border-background bg-primary ring-primary" : "size-3.5 border-foreground/70 bg-background ring-transparent hover:size-4",
                  h.kind === "center" && "bg-foreground",
                  h.kind === "size" && "rounded-sm",
                )}
                style={{ left: `${h.x}%`, top: `${h.y}%` }}
              />
            )
          })}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
        Shift — axis · Ctrl — no guides · arrows — nudge · H/V/R
      </div>
    </ToolLayout>
  )
}
