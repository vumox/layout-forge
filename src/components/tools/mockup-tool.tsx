import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import {
  AlignEndHorizontalIcon,
  AlignEndVerticalIcon,
  AlignHorizontalJustifyCenterIcon,
  AlignStartHorizontalIcon,
  AlignStartVerticalIcon,
  AlignVerticalJustifyCenterIcon,
  ArrowDownToLineIcon,
  ArrowUpToLineIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleIcon,
  ClipboardPasteIcon,
  CopyIcon,
  CopyPlusIcon,
  EyeIcon,
  EyeOffIcon,
  FlipHorizontal2Icon,
  Grid3x3Icon,
  ImageDownIcon,
  ImageIcon,
  ImageUpIcon,
  LaptopIcon,
  Loader2Icon,
  LockIcon,
  LockOpenIcon,
  MagnetIcon,
  MonitorIcon,
  Redo2Icon,
  SmartphoneIcon,
  SquareIcon,
  TabletIcon,
  Trash2Icon,
  TvIcon,
  TypeIcon,
  Undo2Icon,
  WatchIcon,
} from "lucide-react"
import { toBlob, toPng } from "html-to-image"
import { toast } from "sonner"
import { downloadUrl } from "@/lib/clipboard"
import { MESH_PRESETS, presetPoints } from "@/lib/mesh"
import {
  FRAMES,
  HAS_FRAME,
  HAS_SCREEN,
  HAS_TILT,
  type Item,
  KIND_LABEL,
  type Kind,
  MK_CSS,
  NAT,
  RATIOS,
  TEMPLATES,
  type V,
  deviceTree,
  exportScene,
  heightOf,
  mkItem,
  uid,
} from "@/lib/mockup"
import { sampleImage } from "@/lib/sample-image"
import { usePersistent } from "@/lib/use-persistent"
import { cn } from "@/lib/utils"
import { ColorInput } from "@/components/color-input"
import { Field, IconButton, NumberInput, Section, SelectField, SliderField } from "@/components/fields"
import { ToolLayout } from "@/components/tools/tool-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type Bg = "mesh" | "gradient" | "solid" | "transparent" | "image"

interface Scene {
  items: Item[]
  ratio: string
  bg: Bg
  c1: string
  c2: string
  angle: number
  mesh: string
  bgImage: string | null
  bgBlur: number
  snap: boolean
  grid: boolean
  float: boolean
}

const DEFAULT: Scene = {
  items: TEMPLATES[0].build(1600, 1000),
  ratio: "16:10",
  bg: "mesh",
  c1: "#6366f1",
  c2: "#ec4899",
  angle: 135,
  mesh: "candy",
  bgImage: null,
  bgBlur: 0,
  snap: true,
  grid: false,
  float: false,
}

type Drag =
  | { kind: "move"; id: string; px: number; py: number; ox: number; oy: number; moved: boolean }
  | { kind: "resize"; id: string; cx: number; cy: number; d0: number; w0: number; moved: boolean }
  | { kind: "rotate"; id: string; cx: number; cy: number; a0: number; r0: number; moved: boolean }

const ASSET_KEY = "lf-tool-mockup-assets"

function useAssets() {
  const [assets, setAssets] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(ASSET_KEY) ?? "{}") as Record<string, string>
    } catch {
      return {}
    }
  })
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = JSON.stringify(assets)
        if (raw.length < 4_500_000) localStorage.setItem(ASSET_KEY, raw)
      } catch {
        return
      }
    }, 500)
    return () => clearTimeout(t)
  }, [assets])
  const add = (id: string, url: string) => setAssets((a) => ({ ...a, [id]: url }))
  return [assets, add] as const
}

async function readImage(file: File): Promise<{ url: string; w: number; h: number }> {
  const bitmap = await createImageBitmap(file)
  const k = Math.min(1, 1400 / bitmap.width)
  const w = Math.round(bitmap.width * k)
  const h = Math.round(bitmap.height * k)
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  c.getContext("2d")?.drawImage(bitmap, 0, 0, w, h)
  const out = { url: c.toDataURL("image/jpeg", 0.88), w: bitmap.width, h: bitmap.height }
  bitmap.close()
  return out
}

function aabb(i: Item) {
  const r = (i.rot * Math.PI) / 180
  const w = i.w
  const h = heightOf(i)
  return { bw: Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r)), bh: Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r)) }
}

function snapAxis(vals: number[], targets: number[], thr: number) {
  let best: { d: number; at: number } | null = null
  for (const v of vals) {
    for (const t of targets) {
      const d = t - v
      if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: t }
    }
  }
  return best
}

const norm = (a: number) => {
  let v = a % 360
  if (v > 180) v -= 360
  if (v <= -180) v += 360
  return Math.round(v * 10) / 10
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || !!t.closest("[role=dialog],[role=listbox],[role=menu]"))
}

function renderV(n: V | string, key?: number): ReactNode {
  if (typeof n === "string") return n
  const props: Record<string, unknown> = { key, className: n.c, style: n.s as CSSProperties | undefined, ...n.a }
  if (n.t === "img") return createElement("img", { ...props, draggable: false })
  return createElement(n.t, props, ...(n.k ?? []).map((c, i) => renderV(c, i)))
}

function bgCss(s: Scene) {
  if (s.bg === "gradient") return `linear-gradient(${s.angle}deg, ${s.c1}, ${s.c2})`
  if (s.bg === "solid") return s.c1
  if (s.bg === "transparent") return "transparent"
  if (s.bg === "image") return "#111 center / cover url(background.jpg)"
  const p = MESH_PRESETS.find((m) => m.id === s.mesh) ?? MESH_PRESETS[0]
  const pts = presetPoints(p.colors, 5)
  return `${pts.map((pt) => `radial-gradient(circle at ${pt.x}% ${pt.y}%, ${pt.color} 0%, transparent ${pt.size}%)`).join(", ")}, ${p.base}`
}

const ADD: { kind: Kind; icon: typeof LaptopIcon }[] = [
  { kind: "browser", icon: MonitorIcon },
  { kind: "laptop", icon: LaptopIcon },
  { kind: "phone", icon: SmartphoneIcon },
  { kind: "tablet", icon: TabletIcon },
  { kind: "monitor", icon: TvIcon },
  { kind: "watch", icon: WatchIcon },
  { kind: "image", icon: ImageIcon },
  { kind: "text", icon: TypeIcon },
  { kind: "shape", icon: SquareIcon },
]

function LayerButton({ title, onClick, children, active }: { title: string; onClick: () => void; children: ReactNode; active?: boolean }) {
  return (
    <button title={title} onClick={onClick} className={cn("flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-3.5", active && "text-primary")}>
      {children}
    </button>
  )
}

function ImageUpload({ label, onFile }: { label: string; onFile: (f: File) => void }) {
  return (
    <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted/50">
      <ImageUpIcon className="size-4" />
      {label}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ""
        }}
      />
    </label>
  )
}

export function MockupTool() {
  const [s, set] = usePersistent<Scene>("lf-tool-mockup2", DEFAULT)
  const [assets, addAsset] = useAssets()
  const [selId, setSelId] = useState<string | null>(null)
  const [fit, setFit] = useState(0.5)
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({})
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [{ canUndo, canRedo }, setHistoryState] = useState({ canUndo: false, canRedo: false })
  const stageRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const sRef = useRef(s)
  const dragRef = useRef<Drag | null>(null)
  const hist = useRef<{ past: Item[][]; future: Item[][] }>({ past: [], future: [] })
  const lastKey = useRef<{ k: string; t: number } | null>(null)
  const demo = useMemo(() => sampleImage(), [])
  const [W, H] = RATIOS[s.ratio] ?? RATIOS["16:10"]
  const items = s.items
  const sel = items.find((i) => i.id === selId) ?? null
  const urlOf = (i: Item) => (i.src && assets[i.src]) || demo
  const bgImageUrl = s.bgImage ? assets[s.bgImage] : null

  useLayoutEffect(() => {
    sRef.current = s
  })

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setFit(Math.max(0.1, Math.min((el.clientWidth - 40) / W, (el.clientHeight - 90) / H))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [W, H])

  const record = useCallback((key?: string) => {
    const now = Date.now()
    if (key && lastKey.current?.k === key && now - lastKey.current.t < 700) {
      lastKey.current.t = now
      return
    }
    lastKey.current = key ? { k: key, t: now } : null
    hist.current.past = [...hist.current.past.slice(-79), sRef.current.items]
    hist.current.future = []
    setHistoryState({ canUndo: hist.current.past.length > 0, canRedo: hist.current.future.length > 0 })
  }, [])

  const commit = (next: Item[], key?: string) => {
    record(key)
    set({ items: next })
  }

  const patch = (id: string, p: Partial<Item>) => commit(sRef.current.items.map((i) => (i.id === id ? { ...i, ...p } : i)), `${id}:${Object.keys(p).join(",")}`)
  const patchRaw = (id: string, p: Partial<Item>) => set({ items: sRef.current.items.map((i) => (i.id === id ? { ...i, ...p } : i)) })

  const undo = () => {
    const prev = hist.current.past.pop()
    if (!prev) return
    hist.current.future.push(sRef.current.items)
    lastKey.current = null
    set({ items: prev })
    setHistoryState({ canUndo: hist.current.past.length > 0, canRedo: hist.current.future.length > 0 })
  }

  const redo = () => {
    const next = hist.current.future.pop()
    if (!next) return
    hist.current.past.push(sRef.current.items)
    lastKey.current = null
    set({ items: next })
    setHistoryState({ canUndo: hist.current.past.length > 0, canRedo: hist.current.future.length > 0 })
  }

  const add = (kind: Kind, over: Partial<Item> = {}) => {
    const n = sRef.current.items.filter((i) => i.kind === kind).length + 1
    const j = ((n - 1) % 5) * 28
    const item = mkItem(kind, { x: W / 2 + j, y: H / 2 + j, name: `${KIND_LABEL[kind]} ${n}`, ...over })
    commit([...sRef.current.items, item])
    setSelId(item.id)
    return item
  }

  const duplicate = (id: string) => {
    const src = sRef.current.items.find((i) => i.id === id)
    if (!src) return
    const copy = { ...src, id: uid(), name: `${src.name} copy`, x: src.x + 36, y: src.y + 36, locked: false }
    const idx = sRef.current.items.findIndex((i) => i.id === id)
    const next = [...sRef.current.items]
    next.splice(idx + 1, 0, copy)
    commit(next)
    setSelId(copy.id)
  }

  const remove = (id: string) => {
    commit(sRef.current.items.filter((i) => i.id !== id))
    setSelId(null)
  }

  const move = (id: string, to: "front" | "back" | "up" | "down") => {
    const list = [...sRef.current.items]
    const i = list.findIndex((x) => x.id === id)
    if (i < 0) return
    const [it] = list.splice(i, 1)
    const target = to === "front" ? list.length : to === "back" ? 0 : to === "up" ? Math.min(list.length, i + 1) : Math.max(0, i - 1)
    list.splice(target, 0, it)
    commit(list)
  }

  const align = (id: string, how: "l" | "c" | "r" | "t" | "m" | "b") => {
    const it = sRef.current.items.find((i) => i.id === id)
    if (!it) return
    const { bw, bh } = aabb(it)
    const p: Partial<Item> = {}
    if (how === "l") p.x = bw / 2
    if (how === "c") p.x = W / 2
    if (how === "r") p.x = W - bw / 2
    if (how === "t") p.y = bh / 2
    if (how === "m") p.y = H / 2
    if (how === "b") p.y = H - bh / 2
    patch(id, p)
  }

  const handleFile = async (file: File | null | undefined, targetId?: string | null) => {
    if (!file || !file.type.startsWith("image/")) return
    try {
      const { url, w, h } = await readImage(file)
      const id = uid()
      addAsset(id, url)
      const target = targetId ? sRef.current.items.find((i) => i.id === targetId) : null
      if (target && HAS_SCREEN.includes(target.kind)) {
        patch(target.id, { src: id })
        return
      }
      const current = selId ? sRef.current.items.find((i) => i.id === selId) : null
      if (current && HAS_SCREEN.includes(current.kind) && targetId === undefined) {
        patch(current.id, { src: id })
        return
      }
      add(h / w > 1.2 ? "phone" : "browser", { src: id })
    } catch {
      toast.error("Could not read the image")
    }
  }

  const applyTemplate = (build: (w: number, h: number) => Item[]) => {
    commit(build(W, H))
    setSelId(null)
  }

  const toStage = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = stageRef.current?.getBoundingClientRect()
    if (!r) return [0, 0]
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]
  }

  const startMove = (e: ReactPointerEvent, i: Item) => {
    if (e.button !== 0) return
    e.stopPropagation()
    setSelId(i.id)
    const [px, py] = toStage(e)
    dragRef.current = { kind: "move", id: i.id, px, py, ox: i.x, oy: i.y, moved: false }
    setDragging(true)
  }

  const startResize = (e: ReactPointerEvent, i: Item) => {
    e.stopPropagation()
    e.preventDefault()
    const [px, py] = toStage(e)
    dragRef.current = { kind: "resize", id: i.id, cx: i.x, cy: i.y, d0: Math.max(1, Math.hypot(px - i.x, py - i.y)), w0: i.w, moved: false }
    setDragging(true)
  }

  const startRotate = (e: ReactPointerEvent, i: Item) => {
    e.stopPropagation()
    e.preventDefault()
    const [px, py] = toStage(e)
    dragRef.current = { kind: "rotate", id: i.id, cx: i.x, cy: i.y, a0: (Math.atan2(py - i.y, px - i.x) * 180) / Math.PI, r0: i.rot, moved: false }
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return
    const moveH = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const [x, y] = toStage(e)
      const cur = sRef.current
      const it = cur.items.find((i) => i.id === d.id)
      if (!it) return
      if (d.kind === "move") {
        if (!d.moved) {
          if (Math.hypot(x - d.px, y - d.py) < 3) return
          record()
          d.moved = true
        }
        let nx = d.ox + (x - d.px)
        let ny = d.oy + (y - d.py)
        const g: { x?: number; y?: number } = {}
        if (cur.snap && !e.ctrlKey && !e.metaKey) {
          const { bw, bh } = aabb(it)
          const thr = 9 / Math.max(0.1, fit)
          const others = cur.items.filter((o) => o.id !== d.id && !o.hidden)
          const tx = [0, W / 2, W, ...others.flatMap((o) => [o.x, o.x - aabb(o).bw / 2, o.x + aabb(o).bw / 2])]
          const ty = [0, H / 2, H, ...others.flatMap((o) => [o.y, o.y - aabb(o).bh / 2, o.y + aabb(o).bh / 2])]
          const sx = snapAxis([nx - bw / 2, nx, nx + bw / 2], tx, thr)
          const sy = snapAxis([ny - bh / 2, ny, ny + bh / 2], ty, thr)
          if (sx) {
            nx += sx.d
            g.x = sx.at
          }
          if (sy) {
            ny += sy.d
            g.y = sy.at
          }
        }
        setGuides(g)
        patchRaw(d.id, { x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 })
      } else if (d.kind === "resize") {
        if (!d.moved) {
          record()
          d.moved = true
        }
        const dist = Math.hypot(x - d.cx, y - d.cy)
        patchRaw(d.id, { w: Math.round(Math.min(6000, Math.max(30, (d.w0 * dist) / d.d0))) })
      } else {
        if (!d.moved) {
          record()
          d.moved = true
        }
        const a = (Math.atan2(y - d.cy, x - d.cx) * 180) / Math.PI
        let r = d.r0 + (a - d.a0)
        if (e.shiftKey) r = Math.round(r / 15) * 15
        patchRaw(d.id, { rot: norm(r) })
      }
    }
    const up = () => {
      dragRef.current = null
      setDragging(false)
      setGuides({})
    }
    window.addEventListener("pointermove", moveH)
    window.addEventListener("pointerup", up)
    return () => {
      window.removeEventListener("pointermove", moveH)
      window.removeEventListener("pointerup", up)
    }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return
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
      if (!sel) return
      if (mod && key === "d") {
        e.preventDefault()
        duplicate(sel.id)
        return
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        remove(sel.id)
        return
      }
      if (e.key === "Escape") return setSelId(null)
      if (e.key === "]") return move(sel.id, e.shiftKey ? "front" : "up")
      if (e.key === "[") return move(sel.id, e.shiftKey ? "back" : "down")
      if (e.key.startsWith("Arrow") && !sel.locked) {
        e.preventDefault()
        const d = e.shiftKey ? 10 : 1
        const dir = e.key.slice(5)
        patch(sel.id, { x: sel.x + (dir === "Left" ? -d : dir === "Right" ? d : 0), y: sel.y + (dir === "Up" ? -d : dir === "Down" ? d : 0) })
      }
    }
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e as unknown as KeyboardEvent)) return
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"))
      if (file) {
        e.preventDefault()
        handleFile(file)
      }
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("paste", onPaste)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("paste", onPaste)
    }
  })

  const capture = async () => {
    if (!stageRef.current) throw new Error("no scene")
    return { el: stageRef.current, opts: { pixelRatio: 2, width: W, height: H, cacheBust: true, style: { transform: "none" }, filter: (n: Node) => !(n as HTMLElement).dataset?.ui } }
  }

  const exportPng = async () => {
    setBusy(true)
    try {
      const { el, opts } = await capture()
      downloadUrl("mockup.png", await toPng(el, opts))
    } catch (e) {
      toast.error("Could not render PNG", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  const copyPng = async () => {
    setBusy(true)
    try {
      const { el, opts } = await capture()
      const blob = await toBlob(el, opts)
      if (!blob) throw new Error("empty result")
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
      toast.success("PNG copied to clipboard")
    } catch (e) {
      toast.error("Could not copy", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  const scene = useMemo(() => exportScene(items, W, H, bgCss(s), s.float), [items, W, H, s])
  const outputs = [
    { id: "html", label: "HTML", lang: "html", file: "mockup.html", code: scene.html },
    { id: "css", label: "CSS", lang: "css", file: "mockup.css", code: scene.css },
    { id: "js", label: "JS (scale)", lang: "js", file: "mockup.js", code: scene.js },
  ]

  const background: CSSProperties =
    s.bg === "gradient"
      ? { background: `linear-gradient(${s.angle}deg, ${s.c1}, ${s.c2})` }
      : s.bg === "solid"
        ? { background: s.c1 }
        : s.bg === "mesh"
          ? { background: bgCss(s) }
          : {}

  const pos = (i: Item) => {
    const h = heightOf(i)
    return { left: i.x - i.w / 2, top: i.y - h / 2, width: i.w, height: h }
  }

  const hs = 12 / fit
  const lw = 2 / fit

  const itemNode = (i: Item, index: number) => {
    const [nw, nh] = NAT[i.kind]
    const isSel = i.id === selId
    const p = pos(i)
    const tilt = `perspective(1800px) rotateX(${i.rx}deg) rotateY(${i.ry}deg)${i.flip ? " scaleX(-1)" : ""}`
    const corner = (cx: 0 | 1, cy: 0 | 1) => (
      <div
        key={`${cx}${cy}`}
        data-ui="1"
        onPointerDown={(e) => startResize(e, i)}
        style={{ position: "absolute", left: cx ? "100%" : 0, top: cy ? "100%" : 0, width: hs, height: hs, marginLeft: -hs / 2, marginTop: -hs / 2, background: "var(--background)", border: `${lw}px solid var(--primary)`, borderRadius: lw, cursor: cx ^ cy ? "nesw-resize" : "nwse-resize", zIndex: 5 }}
      />
    )
    return (
      <div
        key={i.id}
        data-item={i.id}
        onPointerDown={(e) => startMove(e, i)}
        style={{ position: "absolute", ...p, transform: `rotate(${i.rot}deg)`, opacity: i.opacity, display: i.hidden ? "none" : undefined, pointerEvents: i.locked ? "none" : "auto", cursor: dragging ? "grabbing" : "grab" }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: i.rx || i.ry || i.flip ? tilt : undefined,
            filter: i.shadow > 0 ? `drop-shadow(0 ${Math.round(40 * i.shadow + 10)}px ${Math.round(60 * i.shadow + 10)}px rgb(0 0 0 / ${i.shadow}))` : undefined,
            animation: s.float && !busy && !dragging ? `mk-float 6s ease-in-out ${-index * 1.3}s infinite` : undefined,
          }}
        >
          <div style={{ width: nw, height: nh, transform: `scale(${i.w / nw})`, transformOrigin: "0 0" }}>{renderV(deviceTree(i, urlOf(i)))}</div>
        </div>
        {isSel && (
          <>
            <div data-ui="1" className="pointer-events-none absolute inset-0" style={{ outline: `${lw}px solid var(--primary)`, zIndex: 4 }} />
            {corner(0, 0)}
            {corner(1, 0)}
            {corner(0, 1)}
            {corner(1, 1)}
            <div data-ui="1" className="pointer-events-none absolute left-1/2" style={{ top: -34 / fit, width: lw, height: 34 / fit, background: "var(--primary)", marginLeft: -lw / 2 }} />
            <div
              data-ui="1"
              onPointerDown={(e) => startRotate(e, i)}
              style={{ position: "absolute", left: "50%", top: -34 / fit, width: hs * 1.2, height: hs * 1.2, marginLeft: -hs * 0.6, marginTop: -hs * 0.6, borderRadius: "50%", background: "var(--primary)", border: `${lw}px solid var(--background)`, cursor: "crosshair", zIndex: 5 }}
            />
            <div data-ui="1" className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 font-mono whitespace-nowrap text-primary-foreground" style={{ top: `calc(100% + ${10 / fit}px)`, fontSize: 11 / fit }}>
              {Math.round(i.w)} × {Math.round(heightOf(i))} · {i.rot}°
            </div>
          </>
        )}
      </div>
    )
  }

  const controls = (
    <>
      <Section title="Add to scene">
        <div className="grid grid-cols-3 gap-1.5">
          {ADD.map(({ kind, icon: Icon }) => (
            <button key={kind} onClick={() => add(kind)} className="flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50 hover:text-foreground">
              <Icon className="size-4" />
              {KIND_LABEL[kind]}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">Drop an image on a device or on empty space. Ctrl+V — paste a screenshot.</p>
      </Section>

      <Section title="Composition templates">
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => applyTemplate(t.build)} className="rounded-md border px-2 py-1 text-xs hover:bg-muted">
              {t.name}
            </button>
          ))}
        </div>
      </Section>

      <Section title={`Layers · ${items.length}`}>
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {[...items].reverse().map((i) => (
            <div key={i.id} className={cn("flex items-center gap-0.5 rounded-md border pr-1 pl-2", i.id === selId && "border-primary bg-primary/5")}>
              <button onClick={() => setSelId(i.id)} className="min-w-0 flex-1 truncate py-1.5 text-left text-xs">
                {i.name}
              </button>
              <LayerButton title="Higher" onClick={() => move(i.id, "up")}>
                <ChevronUpIcon />
              </LayerButton>
              <LayerButton title="Lower" onClick={() => move(i.id, "down")}>
                <ChevronDownIcon />
              </LayerButton>
              <LayerButton title={i.locked ? "Unlock" : "Lock"} onClick={() => patch(i.id, { locked: !i.locked })} active={i.locked}>
                {i.locked ? <LockIcon /> : <LockOpenIcon />}
              </LayerButton>
              <LayerButton title={i.hidden ? "Show" : "Hide"} onClick={() => patch(i.id, { hidden: !i.hidden })} active={i.hidden}>
                {i.hidden ? <EyeOffIcon /> : <EyeIcon />}
              </LayerButton>
            </div>
          ))}
          {items.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">Scene is empty</p>}
        </div>
      </Section>

      {sel && (
        <>
          <Section
            title={`Element · ${KIND_LABEL[sel.kind]}`}
            action={
              <div className="flex">
                <IconButton label="Duplicate (Ctrl+D)" onClick={() => duplicate(sel.id)}>
                  <CopyPlusIcon />
                </IconButton>
                <IconButton label="Delete (Del)" onClick={() => remove(sel.id)} className="text-destructive">
                  <Trash2Icon />
                </IconButton>
              </div>
            }
          >
            <Input value={sel.name} onChange={(e) => patch(sel.id, { name: e.target.value })} className="h-8 text-sm" aria-label="Layer name" />
            <div className="grid grid-cols-4 gap-1.5">
              <Button variant="outline" size="xs" onClick={() => move(sel.id, "front")} title="Bring to front">
                <ArrowUpToLineIcon />
              </Button>
              <Button variant="outline" size="xs" onClick={() => move(sel.id, "back")} title="Send to back">
                <ArrowDownToLineIcon />
              </Button>
              <Button variant={sel.flip ? "secondary" : "outline"} size="xs" onClick={() => patch(sel.id, { flip: !sel.flip })} title="Flip horizontally">
                <FlipHorizontal2Icon />
              </Button>
              <Button variant={sel.locked ? "secondary" : "outline"} size="xs" onClick={() => patch(sel.id, { locked: !sel.locked })} title="Lock">
                {sel.locked ? <LockIcon /> : <LockOpenIcon />}
              </Button>
            </div>
          </Section>

          <Section title="Position and size">
            <div className="grid grid-cols-2 gap-2">
              <Field label="X (center)">
                <NumberInput value={Math.round(sel.x)} onChange={(x) => patch(sel.id, { x })} />
              </Field>
              <Field label="Y (center)">
                <NumberInput value={Math.round(sel.y)} onChange={(y) => patch(sel.id, { y })} />
              </Field>
              <Field label="Width">
                <NumberInput value={Math.round(sel.w)} min={30} max={6000} onChange={(w) => patch(sel.id, { w })} />
              </Field>
              <Field label="Rotation, °">
                <NumberInput value={sel.rot} min={-180} max={180} onChange={(rot) => patch(sel.id, { rot })} />
              </Field>
            </div>
            <SliderField label="Rotation" value={sel.rot} min={-180} max={180} unit="°" onChange={(rot) => patch(sel.id, { rot })} />
            <div className="grid grid-cols-6 gap-1">
              {(
                [
                  ["l", "Left edge", AlignStartVerticalIcon],
                  ["c", "Center (horiz.)", AlignHorizontalJustifyCenterIcon],
                  ["r", "Right edge", AlignEndVerticalIcon],
                  ["t", "Top edge", AlignStartHorizontalIcon],
                  ["m", "Center (vert.)", AlignVerticalJustifyCenterIcon],
                  ["b", "Bottom edge", AlignEndHorizontalIcon],
                ] as const
              ).map(([k, t, Icon]) => (
                <Button key={k} variant="outline" size="xs" title={t} onClick={() => align(sel.id, k)}>
                  <Icon />
                </Button>
              ))}
            </div>
          </Section>

          <Section title="View">
            {HAS_TILT.includes(sel.kind) && (
              <>
                <SliderField label="Tilt X (3D)" value={sel.rx} min={-60} max={60} unit="°" onChange={(rx) => patch(sel.id, { rx })} />
                <SliderField label="Rotate Y (3D)" value={sel.ry} min={-70} max={70} unit="°" onChange={(ry) => patch(sel.id, { ry })} />
              </>
            )}
            <SliderField label="Transparency" value={sel.opacity} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(opacity) => patch(sel.id, { opacity })} />
            {sel.kind !== "shape" && sel.kind !== "text" && <SliderField label="Shadow" value={sel.shadow} min={0} max={0.8} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(shadow) => patch(sel.id, { shadow })} />}
            {HAS_SCREEN.includes(sel.kind) && (
              <div className="flex items-center justify-between">
                <Label htmlFor="mk-gl" className="text-xs">
                  Screen glare
                </Label>
                <Switch id="mk-gl" size="sm" checked={sel.glare} onCheckedChange={(glare) => patch(sel.id, { glare })} />
              </div>
            )}
            {HAS_FRAME.includes(sel.kind) && (
              <Field label="Body color">
                <div className="flex flex-wrap gap-1.5">
                  {FRAMES.map((f) => (
                    <button key={f.id} title={f.name} onClick={() => patch(sel.id, { frame: f.color })} className="size-6 rounded-full ring-1 ring-foreground/15" style={{ background: f.color, boxShadow: sel.frame === f.color ? "0 0 0 2px var(--foreground)" : undefined }} />
                  ))}
                </div>
              </Field>
            )}
            {sel.kind === "image" && <SliderField label="Rounding" value={sel.radius} min={0} max={120} onChange={(radius) => patch(sel.id, { radius })} />}
          </Section>

          {HAS_SCREEN.includes(sel.kind) && (
            <Section title="Screen">
              <ImageUpload label={sel.src ? "Replace screen" : "Upload screenshot"} onFile={(f) => handleFile(f, sel.id)} />
              {sel.src && (
                <Button variant="outline" size="xs" onClick={() => patch(sel.id, { src: null })}>
                  Restore demo image
                </Button>
              )}
              {sel.kind === "browser" && (
                <>
                  <Field label="Address bar">
                    <Input value={sel.url} onChange={(e) => patch(sel.id, { url: e.target.value })} className="h-8" />
                  </Field>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="mk-dk" className="text-xs">
                      Dark window
                    </Label>
                    <Switch id="mk-dk" size="sm" checked={sel.dark} onCheckedChange={(dark) => patch(sel.id, { dark })} />
                  </div>
                </>
              )}
            </Section>
          )}

          {sel.kind === "text" && (
            <Section title="Text">
              <Input value={sel.text} onChange={(e) => patch(sel.id, { text: e.target.value })} className="h-8" />
              <SliderField label="Font size" value={sel.fs} min={16} max={160} onChange={(fs) => patch(sel.id, { fs })} />
              <SelectField label="Saturation" value={String(sel.weight)} options={["400", "500", "600", "700", "800", "900"]} onChange={(w) => patch(sel.id, { weight: Number(w) })} />
              <Field label="Color">
                <ColorInput value={sel.color} compact onChange={(color) => patch(sel.id, { color })} />
              </Field>
            </Section>
          )}

          {sel.kind === "shape" && (
            <Section title="Shape">
              <ToggleGroup variant="outline" size="sm" spacing={0} className="w-full" value={[sel.shape]} onValueChange={(v) => v[0] && patch(sel.id, { shape: v[0] as Item["shape"] })}>
                <ToggleGroupItem value="rect" className="flex-1 text-xs">
                  <SquareIcon />
                  Rect.
                </ToggleGroupItem>
                <ToggleGroupItem value="circle" className="flex-1 text-xs">
                  <CircleIcon />
                  Circle
                </ToggleGroupItem>
              </ToggleGroup>
              <div className="grid grid-cols-2 gap-2">
                <ColorInput value={sel.color} compact onChange={(color) => patch(sel.id, { color })} />
                <ColorInput value={sel.color2} compact onChange={(color2) => patch(sel.id, { color2 })} />
              </div>
              {sel.shape === "rect" && <SliderField label="Rounding" value={sel.radius} min={0} max={200} onChange={(radius) => patch(sel.id, { radius })} />}
              <SliderField label="Blur" value={sel.blur} min={0} max={120} onChange={(blur) => patch(sel.id, { blur })} />
            </Section>
          )}
        </>
      )}

      <Section title="Scene">
        <SelectField label="Format" value={s.ratio} options={Object.keys(RATIOS)} onChange={(ratio) => set({ ratio })} />
        <ToggleGroup variant="outline" size="sm" spacing={0} className="grid w-full grid-cols-5" value={[s.bg]} onValueChange={(v) => v[0] && set({ bg: v[0] as Bg })}>
          {(
            [
              ["mesh", "Mesh"],
              ["gradient", "Grad."],
              ["solid", "Color"],
              ["image", "Photo"],
              ["transparent", "None"],
            ] as [Bg, string][]
          ).map(([v, l]) => (
            <ToggleGroupItem key={v} value={v} className="px-0 text-[11px]">
              {l}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {s.bg === "mesh" && (
          <div className="flex flex-wrap gap-1">
            {MESH_PRESETS.map((p) => (
              <button key={p.id} onClick={() => set({ mesh: p.id })} title={p.name} className="size-6 rounded-full" style={{ background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})`, boxShadow: s.mesh === p.id ? "0 0 0 2px var(--foreground)" : undefined }} />
            ))}
          </div>
        )}
        {(s.bg === "gradient" || s.bg === "solid") && (
          <div className="grid grid-cols-2 gap-2">
            <ColorInput value={s.c1} compact onChange={(c1) => set({ c1 })} />
            {s.bg === "gradient" && <ColorInput value={s.c2} compact onChange={(c2) => set({ c2 })} />}
          </div>
        )}
        {s.bg === "gradient" && <SliderField label="Angle" value={s.angle} min={0} max={360} unit="°" onChange={(angle) => set({ angle })} />}
        {s.bg === "image" && (
          <>
            <ImageUpload label={s.bgImage ? "Replace background" : "Upload background"} onFile={async (f) => {
              const { url } = await readImage(f)
              const id = uid()
              addAsset(id, url)
              set({ bgImage: id })
            }} />
            <SliderField label="Background blur" value={s.bgBlur} min={0} max={40} onChange={(bgBlur) => set({ bgBlur })} />
          </>
        )}
        <div className="flex items-center justify-between">
          <Label htmlFor="mk-fl" className="text-xs">
            Floating (animation)
          </Label>
          <Switch id="mk-fl" size="sm" checked={s.float} onCheckedChange={(float) => set({ float })} />
        </div>
      </Section>
    </>
  )

  return (
    <ToolLayout
      controls={controls}
      outputs={outputs}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" onClick={exportPng} disabled={busy}>
            {busy ? <Loader2Icon className="animate-spin" /> : <ImageDownIcon />}
            PNG {W * 2}×{H * 2}
          </Button>
          <Button size="sm" variant="outline" onClick={copyPng} disabled={busy}>
            <CopyIcon />
            Copy
          </Button>
        </div>
      }
    >
      <style>{`${MK_CSS}\n@keyframes mk-float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -14px; } }`}</style>
      <div className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border bg-background/95 p-0.5 shadow-sm backdrop-blur">
        <IconButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Undo2Icon />
        </IconButton>
        <IconButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
          <Redo2Icon />
        </IconButton>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <IconButton label="Duplicate (Ctrl+D)" onClick={() => sel && duplicate(sel.id)} disabled={!sel}>
          <CopyPlusIcon />
        </IconButton>
        <IconButton label="Delete (Del)" onClick={() => sel && remove(sel.id)} disabled={!sel}>
          <Trash2Icon />
        </IconButton>
        <span className="mx-0.5 h-5 w-px bg-border" />
        <IconButton label="Snap (Ctrl — off)" active={s.snap} onClick={() => set({ snap: !s.snap })}>
          <MagnetIcon />
        </IconButton>
        <IconButton label="Rule of thirds" active={s.grid} onClick={() => set({ grid: !s.grid })}>
          <Grid3x3Icon />
        </IconButton>
        <IconButton label="Paste screenshot (Ctrl+V)" onClick={() => toast("Press Ctrl+V")}>
          <ClipboardPasteIcon />
        </IconButton>
      </div>

      <div ref={boxRef} className="absolute inset-0 flex items-center justify-center overflow-hidden pt-12">
        <div style={{ width: W * fit, height: H * fit }}>
          <div
            ref={stageRef}
            onPointerDown={() => setSelId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const target = (e.target as HTMLElement).closest("[data-item]")?.getAttribute("data-item") ?? null
              handleFile(e.dataTransfer.files[0], target)
            }}
            className={cn("relative overflow-hidden", s.bg === "transparent" && "bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:24px_24px]")}
            style={{ width: W, height: H, transform: `scale(${fit})`, transformOrigin: "0 0", ...background }}
          >
            {s.bg === "image" && <div className="absolute" style={{ inset: -s.bgBlur * 2, background: bgImageUrl ? `center / cover no-repeat url(${bgImageUrl})` : "#1f2937", filter: s.bgBlur ? `blur(${s.bgBlur}px)` : undefined }} />}
            {items.map((i, idx) => itemNode(i, idx))}
            {s.grid && (
              <svg data-ui="1" viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 size-full">
                {[1, 2].map((k) => (
                  <g key={k} stroke="white" strokeOpacity="0.45" strokeWidth={lw} strokeDasharray={`${6 / fit} ${6 / fit}`}>
                    <line x1={(W / 3) * k} x2={(W / 3) * k} y1="0" y2={H} />
                    <line y1={(H / 3) * k} y2={(H / 3) * k} x1="0" x2={W} />
                  </g>
                ))}
              </svg>
            )}
            {(guides.x !== undefined || guides.y !== undefined) && (
              <svg data-ui="1" viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 size-full">
                {guides.x !== undefined && <line x1={guides.x} x2={guides.x} y1="0" y2={H} stroke="#ec4899" strokeWidth={lw} />}
                {guides.y !== undefined && <line y1={guides.y} y2={guides.y} x1="0" x2={W} stroke="#ec4899" strokeWidth={lw} />}
              </svg>
            )}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 max-w-[92%] -translate-x-1/2 rounded-md bg-background/90 px-2 py-1 text-center text-[11px] text-muted-foreground shadow-sm">
        Corner — size · circle — rotate (Shift — 15°) · arrows — nudge · ] [ — layers
      </div>
    </ToolLayout>
  )
}
