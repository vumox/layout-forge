import { createNode, flexLayout, gridLayout, nextColor, track } from "@/layout/defaults"
import { BREAKPOINTS, RESP_KEYS, bpForWidth, bpIndex } from "@/layout/responsive"
import type { Area, ContentKind, FlexLayout, GridLayout, Layout, LayoutNode, NodeOverride, RespKey } from "@/layout/types"

type Style = Record<string, string>
type Fields = Pick<LayoutNode, RespKey>

interface SourceRule {
  selectors: string[]
  style: Style
  bp: number
}

interface ElNode {
  name: string
  children: ElNode[]
  styleAt: (bp: number) => Style
  content?: ContentKind
}

export interface ImportResult {
  root: LayoutNode
  warnings: string[]
  count: number
}

const STRUCTURAL = new Set(["div", "section", "header", "footer", "main", "aside", "nav", "article", "form", "figure"])
const GRID_ALIGN = ["normal", "start", "end", "center", "stretch", "baseline"]
const GRID_CONTENT = ["normal", "start", "end", "center", "stretch", "space-between", "space-around", "space-evenly"]
const FLEX_JUSTIFY = ["normal", "flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly"]
const FLEX_ALIGN = ["normal", "flex-start", "flex-end", "center", "stretch", "baseline"]
const FLEX_CONTENT = ["normal", "flex-start", "flex-end", "center", "stretch", "space-between", "space-around", "space-evenly"]
const SELF = ["auto", "start", "end", "center", "stretch", "baseline", "flex-start", "flex-end"]

const pick = (v: string | undefined, allowed: string[], fallback: string) => {
  const x = (v ?? "").trim().replace(/^(safe|unsafe)\s+/, "")
  if (allowed.includes(x)) return x
  if (x === "start" && allowed.includes("flex-start")) return "flex-start"
  if (x === "end" && allowed.includes("flex-end")) return "flex-end"
  return allowed.includes(x) ? x : fallback
}

function styleToMap(style: CSSStyleDeclaration): Style {
  const out: Style = {}
  for (let i = 0; i < style.length; i++) {
    const p = style[i]
    out[p] = style.getPropertyValue(p).trim()
  }
  return out
}

function parseLen(v: string | undefined): number {
  if (!v) return 0
  const m = v.trim().match(/^(-?\d*\.?\d+)(px|rem|em)?$/)
  if (!m) return 0
  const n = parseFloat(m[1])
  return Math.round(m[2] === "rem" || m[2] === "em" ? n * 16 : n)
}

function splitTop(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ""
  for (const ch of s.trim()) {
    if (ch === "(" || ch === "[") depth++
    if (ch === ")" || ch === "]") depth--
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur)
      cur = ""
    } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}

function splitComma(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ""
  for (const ch of s) {
    if (ch === "(") depth++
    if (ch === ")") depth--
    if (ch === "," && depth === 0) {
      out.push(cur.trim())
      cur = ""
    } else cur += ch
  }
  out.push(cur.trim())
  return out
}

function expandTracks(v: string): string[] {
  const out: string[] = []
  for (const tok of splitTop(v)) {
    if (tok.startsWith("[")) continue
    const m = tok.match(/^repeat\((.*)\)$/s)
    if (m) {
      const [count, ...rest] = splitComma(m[1])
      const n = parseInt(count)
      const inner = expandTracks(rest.join(", "))
      if (Number.isFinite(n)) for (let i = 0; i < n; i++) out.push(...inner)
      continue
    }
    out.push(tok.replace(/\s*,\s*/g, ", "))
  }
  return out
}

function parseAutoRepeat(v: string) {
  const m = v.trim().match(/^repeat\(\s*(auto-fill|auto-fit)\s*,(.*)\)$/s)
  if (!m) return null
  const inner = m[2].trim()
  const mm = inner.match(/^minmax\((.*)\)$/s)
  if (mm) {
    const [min, max] = splitComma(mm[1])
    return { mode: m[1] as "auto-fill" | "auto-fit", min, max }
  }
  return { mode: m[1] as "auto-fill" | "auto-fit", min: inner, max: inner }
}

function parseAreas(v: string | undefined): string[][] | null {
  if (!v || v === "none") return null
  const rows = [...v.matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => (m[1] ?? m[2]).trim().split(/\s+/))
  return rows.length ? rows : null
}

function areaRects(rows: string[][]) {
  const map = new Map<string, Area>()
  rows.forEach((row, r) =>
    row.forEach((name, c) => {
      if (/^\.+$/.test(name)) return
      const a = map.get(name)
      if (!a) map.set(name, { c1: c + 1, c2: c + 2, r1: r + 1, r2: r + 2 })
      else map.set(name, { c1: Math.min(a.c1, c + 1), c2: Math.max(a.c2, c + 2), r1: Math.min(a.r1, r + 1), r2: Math.max(a.r2, r + 2) })
    }),
  )
  return map
}

function readRules(css: string, warnings: string[]): SourceRule[] {
  const sheet = new CSSStyleSheet()
  try {
    sheet.replaceSync(css)
  } catch {
    warnings.push("Could not fully parse the CSS")
  }
  const out: SourceRule[] = []
  let skippedMedia = false
  const visit = (rules: CSSRuleList, bp: number) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        out.push({ selectors: splitComma(rule.selectorText), style: styleToMap(rule.style), bp })
      } else if (rule instanceof CSSMediaRule) {
        const text = rule.conditionText || rule.media.mediaText
        const m = text.match(/min-width\s*:\s*(\d*\.?\d+)(px|em|rem)/)
        if (!m || /max-width/.test(text)) {
          skippedMedia = true
          continue
        }
        const px = parseFloat(m[1]) * (m[2] === "px" ? 1 : 16)
        visit(rule.cssRules, bpIndex(bpForWidth(px)))
      }
    }
  }
  visit(sheet.cssRules, 0)
  if (skippedMedia) warnings.push("@media without min-width (desktop-first) skipped — only mobile-first is supported")
  return out
}

function mergeStyles(rules: SourceRule[], match: (sel: string) => boolean, bp: number, inline?: Style): Style {
  const out: Style = {}
  for (const r of rules) {
    if (r.bp > bp) continue
    if (r.selectors.some((s) => match(s))) Object.assign(out, r.style)
  }
  return inline ? Object.assign(out, inline) : out
}

function detectContent(el: Element): ContentKind | undefined {
  if (el.querySelector("img, picture, svg, video")) return "image"
  const heading = el.querySelector("h1, h2, h3, h4, h5, h6")
  if (heading && el.querySelector("p, button")) return "card"
  if (heading) return "heading"
  if (el.querySelector("ul, ol, nav")) return "list"
  if (el.querySelector("button") || el.matches("button, a")) return "button"
  const text = el.textContent?.trim() ?? ""
  if (text.length > 140) return "long"
  if (el.querySelector("p")) return "text"
  return undefined
}

function fromHtml(html: string, rules: SourceRule[], warnings: string[]): ElNode | null {
  const doc = new DOMParser().parseFromString(html, "text/html")
  const isNode = (el: Element) => STRUCTURAL.has(el.tagName.toLowerCase()) || (el.classList.length > 0 && !["p", "h1", "h2", "h3", "h4", "h5", "h6", "img", "button", "a", "span", "li", "ul", "ol", "svg"].includes(el.tagName.toLowerCase()))
  const warnSkipped = (elements: Element[], parent: string) => {
    const skipped = elements.filter((el) => !isNode(el) && !["SCRIPT", "STYLE"].includes(el.tagName))
    if (skipped.length === 0) return
    const tags = Array.from(new Set(skipped.map((el) => `<${el.tagName.toLowerCase()}>`))).join(", ")
    warnings.push(`HTML import skipped ${skipped.length} unsupported direct child element${skipped.length === 1 ? "" : "s"} (${tags}) in ${parent}; they were not imported as separate layout nodes`)
  }
  const build = (el: Element): ElNode => {
    const kids = Array.from(el.children).filter(isNode)
    const inlineAttr = el.getAttribute("style")
    let inline: Style | undefined
    if (inlineAttr) {
      const tmp = document.createElement("div")
      tmp.setAttribute("style", inlineAttr)
      inline = styleToMap(tmp.style)
    }
    const safeMatch = (sel: string) => {
      try {
        return el.matches(sel)
      } catch {
        return false
      }
    }
    const styleAt = (bp: number) => mergeStyles(rules, safeMatch, bp, inline)
    if (kids.length > 0 || [0, ...rules.map((r) => r.bp)].some((bp) => /grid|flex/.test(styleAt(bp).display ?? ""))) {
      warnSkipped(Array.from(el.children), `<${el.tagName.toLowerCase()}>`)
    }
    return {
      name: el.classList[0] ?? el.id ?? el.tagName.toLowerCase(),
      children: kids.map(build),
      styleAt,
      content: kids.length === 0 ? detectContent(el) : undefined,
    }
  }
  const candidates = Array.from(doc.body.children).filter((el) => !["SCRIPT", "STYLE"].includes(el.tagName))
  if (candidates.length === 0) return null
  if (candidates.length === 1) return build(candidates[0])
  warnSkipped(candidates, "the HTML root")
  return {
    name: "root",
    children: candidates.filter(isNode).map(build),
    styleAt: () => ({ display: "flex", "flex-direction": "column" }),
  }
}

const nameFromSelector = (sel: string) => {
  const last = sel.trim().split(/[\s>+~]+/).pop() ?? sel
  const cls = last.match(/\.([\w-]+)/)
  if (cls) return cls[1]
  const id = last.match(/#([\w-]+)/)
  if (id) return id[1]
  return last.replace(/[^\w-]/g, "") || "item"
}

const isLayoutStyle = (s: Style) => /grid|flex/.test(s.display ?? "") || !!s["grid-template-columns"] || !!s["grid-template-areas"]

function fromCss(rules: SourceRule[], warnings: string[]): ElNode | null {
  const simple = rules.filter((r) => r.selectors.length === 1 && !/^(\*|html|body|:root)$/.test(r.selectors[0]) && !/::?[a-z]/.test(r.selectors[0]))
  const container = simple.find((r) => isLayoutStyle(r.style))
  if (!container) return null
  const rootSel = container.selectors[0]
  const bySelector = (sel: string) => (sel2: string) => sel2 === sel
  const allStyles = Array.from({ length: BREAKPOINTS.length }, (_, i) => mergeStyles(rules, bySelector(rootSel), i))
  const areaNames: string[] = []
  for (const s of allStyles) for (const row of parseAreas(s["grid-template-areas"]) ?? []) for (const n of row) if (!/^\.+$/.test(n) && !areaNames.includes(n)) areaNames.push(n)

  const used = new Set<string>([rootSel])
  const children: ElNode[] = []
  for (const name of areaNames) {
    const rule = simple.find((r) => !used.has(r.selectors[0]) && r.style["grid-row-start"] === name)
    if (rule) {
      used.add(rule.selectors[0])
      const sel = rule.selectors[0]
      children.push({ name: nameFromSelector(sel), children: [], styleAt: (bp) => mergeStyles(rules, bySelector(sel), bp) })
    } else {
      children.push({ name, children: [], styleAt: () => ({ "grid-row-start": name, "grid-column-start": name, "grid-row-end": name, "grid-column-end": name }) })
    }
  }
  const flexRoot = /flex/.test(allStyles[0].display ?? "")
  for (const r of simple) {
    const sel = r.selectors[0]
    if (used.has(sel)) continue
    const placed = ["grid-row-start", "grid-column-start", "grid-row-end", "grid-column-end"].some((p) => r.style[p] && r.style[p] !== "auto")
    if (!flexRoot && !placed && areaNames.length > 0) continue
    if (sel === rootSel) continue
    used.add(sel)
    children.push({ name: nameFromSelector(sel), children: [], styleAt: (bp) => mergeStyles(rules, bySelector(sel), bp) })
  }
  if (children.length === 0) warnings.push("No child elements found — add their rules or paste HTML")
  return {
    name: rootSel ? nameFromSelector(rootSel) : "layout",
    children,
    styleAt: (bp) => mergeStyles(rules, (s) => s === rootSel, bp),
  }
}

function lineValue(v: string | undefined, count: number) {
  if (!v || v === "auto") return { kind: "auto" as const }
  const span = v.match(/^span\s+(\d+)$/)
  if (span) return { kind: "span" as const, n: parseInt(span[1]) }
  const n = parseInt(v)
  if (Number.isFinite(n)) return { kind: "line" as const, n: n < 0 ? count + 2 + n : n }
  return { kind: "name" as const, name: v }
}

function placeAxis(start: string | undefined, end: string | undefined, count: number): { s: number | null; size: number } {
  const a = lineValue(start, count)
  const b = lineValue(end, count)
  if (a.kind === "line" && b.kind === "line") return { s: Math.min(a.n, b.n), size: Math.max(1, Math.abs(b.n - a.n)) }
  if (a.kind === "line" && b.kind === "span") return { s: a.n, size: b.n }
  if (a.kind === "line") return { s: a.n, size: 1 }
  if (b.kind === "line" && a.kind === "span") return { s: b.n - a.n, size: a.n }
  if (b.kind === "line") return { s: b.n - 1, size: 1 }
  if (a.kind === "span") return { s: null, size: a.n }
  if (b.kind === "span") return { s: null, size: b.n }
  return { s: null, size: 1 }
}

function gridFrom(s: Style, area: Area | null, warnings: string[]): { layout: GridLayout; areas: Map<string, Area> | null } {
  const layout = gridLayout([], [], 0)
  const colsRaw = s["grid-template-columns"] ?? "none"
  const rowsRaw = s["grid-template-rows"] ?? "none"
  const areaRows = parseAreas(s["grid-template-areas"])
  const auto = parseAutoRepeat(colsRaw)
  if (auto) layout.auto = auto
  if (colsRaw.startsWith("subgrid") && area) {
    layout.subgridColumns = true
    layout.columns = Array.from({ length: area.c2 - area.c1 }, () => track("1fr"))
  } else if (!auto) {
    const cols = colsRaw === "none" ? [] : expandTracks(colsRaw)
    if (/auto-fill|auto-fit/.test(colsRaw)) warnings.push("Mixed tracks with auto-fill are not supported — simplified")
    layout.columns = (cols.length ? cols : areaRows ? areaRows[0].map(() => "1fr") : ["1fr"]).filter((c) => !/auto-f/.test(c)).map(track)
  }
  if (rowsRaw.startsWith("subgrid") && area) {
    layout.subgridRows = true
    layout.rows = Array.from({ length: area.r2 - area.r1 }, () => track("1fr"))
  } else {
    const rows = rowsRaw === "none" ? [] : expandTracks(rowsRaw)
    layout.rows = (rows.length ? rows : areaRows ? areaRows.map(() => "auto") : []).map(track)
  }
  layout.columnGap = parseLen(s["column-gap"])
  layout.rowGap = parseLen(s["row-gap"])
  layout.justifyItems = pick(s["justify-items"], GRID_ALIGN, "normal")
  layout.alignItems = pick(s["align-items"], GRID_ALIGN, "normal")
  layout.justifyContent = pick(s["justify-content"], GRID_CONTENT, "normal")
  layout.alignContent = pick(s["align-content"], GRID_CONTENT, "normal")
  if (s["grid-auto-rows"] && s["grid-auto-rows"] !== "auto") layout.autoRows = s["grid-auto-rows"]
  return { layout, areas: areaRows ? areaRects(areaRows) : null }
}

function flexFrom(s: Style): FlexLayout {
  return flexLayout({
    direction: pick(s["flex-direction"], ["row", "row-reverse", "column", "column-reverse"], "row") as FlexLayout["direction"],
    wrap: pick(s["flex-wrap"], ["nowrap", "wrap", "wrap-reverse"], "nowrap") as FlexLayout["wrap"],
    justifyContent: pick(s["justify-content"], FLEX_JUSTIFY, "normal"),
    alignItems: pick(s["align-items"], FLEX_ALIGN, "normal"),
    alignContent: pick(s["align-content"], FLEX_CONTENT, "normal"),
    columnGap: parseLen(s["column-gap"]),
    rowGap: parseLen(s["row-gap"]),
  })
}

function placeChildren(layout: GridLayout, areas: Map<string, Area> | null, kidStyles: Style[]): Area[] {
  const cols = layout.columns.length
  const rows = layout.rows.length
  const result: (Area | null)[] = kidStyles.map((s) => {
    const name = s["grid-row-start"]
    if (areas && name && areas.has(name)) return areas.get(name) as Area
    const c = placeAxis(s["grid-column-start"], s["grid-column-end"], cols)
    const r = placeAxis(s["grid-row-start"], s["grid-row-end"], rows)
    if (c.s !== null && r.s !== null) return { c1: c.s, c2: c.s + c.size, r1: r.s, r2: r.s + r.size }
    return null
  })
  const taken = (a: Area) =>
    result.some((b) => b && a.c1 < b.c2 && b.c1 < a.c2 && a.r1 < b.r2 && b.r1 < a.r2)
  kidStyles.forEach((s, i) => {
    if (result[i]) return
    const c = placeAxis(s["grid-column-start"], s["grid-column-end"], cols)
    const r = placeAxis(s["grid-row-start"], s["grid-row-end"], rows)
    const w = Math.min(c.size, Math.max(1, cols))
    for (let row = 1; row < 200; row++) {
      for (let col = c.s ?? 1; col + w - 1 <= Math.max(cols, 1); col++) {
        const a = { c1: col, c2: col + w, r1: r.s ?? row, r2: (r.s ?? row) + r.size }
        if (!taken(a)) {
          result[i] = a
          return
        }
        if (c.s !== null) break
      }
    }
    result[i] = { c1: 1, c2: 2, r1: 1, r2: 2 }
  })
  return result as Area[]
}

function fieldsTree(el: ElNode, bp: number, area: Area, parent: Layout | null, out: Map<ElNode, Fields>, warnings: string[]) {
  const s = el.styleAt(bp)
  const display = s.display ?? ""
  let layout: Layout | null = null
  let areas: Map<string, Area> | null = null
  if (/grid/.test(display)) ({ layout, areas } = gridFrom(s, parent?.type === "grid" ? area : null, warnings))
  else if (/flex/.test(display)) layout = flexFrom(s)
  else if (el.children.length > 0) layout = flexLayout({ direction: "column", columnGap: 0, rowGap: 0 })
  const kidStyles = el.children.map((k) => k.styleAt(bp))
  let kidAreas: Area[] = el.children.map(() => ({ c1: 1, c2: 2, r1: 1, r2: 2 }))
  if (layout?.type === "grid" && layout.auto) {
    kidAreas = kidStyles.map((ks) => {
      const c = placeAxis(ks["grid-column-start"], ks["grid-column-end"], 1)
      const r = placeAxis(ks["grid-row-start"], ks["grid-row-end"], 1)
      return { c1: 1, c2: 1 + c.size, r1: 1, r2: 1 + r.size }
    })
  } else if (layout?.type === "grid") {
    kidAreas = placeChildren(layout, areas, kidStyles)
    const needRows = Math.max(layout.rows.length, ...kidAreas.map((a) => a.r2 - 1))
    const needCols = Math.max(layout.columns.length, ...kidAreas.map((a) => a.c2 - 1))
    if (!layout.subgridRows) while (layout.rows.length < needRows) layout.rows.push(track("auto"))
    if (!layout.subgridColumns) while (layout.columns.length < needCols) layout.columns.push(track("auto"))
  }
  const size = (v: string | undefined) => (v && v !== "auto" && v !== "initial" ? v : "")
  out.set(el, {
    layout,
    area,
    flex: {
      grow: parseFloat(s["flex-grow"] ?? "0") || 0,
      shrink: s["flex-shrink"] !== undefined ? parseFloat(s["flex-shrink"]) || 0 : 1,
      basis: s["flex-basis"] && s["flex-basis"] !== "initial" ? s["flex-basis"] : "auto",
    },
    width: size(s.width),
    height: size(s.height),
    minHeight: size(s["min-height"]),
    alignSelf: pick(s["align-self"], SELF, "auto"),
    justifySelf: pick(s["justify-self"], SELF, "auto"),
    padding: parseLen(s["padding-top"]),
    hidden: display === "none",
  })
  el.children.forEach((k, i) => fieldsTree(k, bp, kidAreas[i], layout, out, warnings))
}

const strip = (v: unknown) => JSON.stringify(v, (k, val) => (k === "id" ? undefined : val))

export function importLayout(cssInput: string, htmlInput: string): ImportResult {
  const warnings: string[] = []
  let css = cssInput
  let html = htmlInput
  if (/<[a-z][\s\S]*>/i.test(css) && !html.trim()) {
    html = css
    css = ""
  }
  if (html.trim()) {
    const doc = new DOMParser().parseFromString(html, "text/html")
    const embedded = Array.from(doc.querySelectorAll("style")).map((s) => s.textContent ?? "").join("\n")
    css = `${embedded}\n${css}`
  }
  const trimmed = css.trim()
  if (trimmed && !trimmed.includes("{")) css = `.layout { ${trimmed} }`
  const rules = readRules(css, warnings)
  const tree = html.trim() ? fromHtml(html, rules, warnings) : fromCss(rules, warnings)
  if (!tree) throw new Error("No container with display: grid or display: flex found")

  const bps = Array.from(new Set([0, ...rules.map((r) => r.bp)])).sort((a, b) => a - b)
  const perBp = bps.map((bp) => {
    const out = new Map<ElNode, Fields>()
    fieldsTree(tree, bp, { c1: 1, c2: 2, r1: 1, r2: 2 }, null, out, warnings)
    return out
  })

  let count = 0
  const build = (el: ElNode): LayoutNode => {
    count++
    const base = perBp[0].get(el) as Fields
    const node = createNode({
      ...base,
      name: el.name,
      color: nextColor(),
      content: el.content,
      radius: parseLen(el.styleAt(0)["border-top-left-radius"]),
      children: el.children.map(build),
    })
    for (let i = 1; i < bps.length; i++) {
      const cur = perBp[i].get(el) as Fields
      const prev = perBp[i - 1].get(el) as Fields
      const o: NodeOverride = {}
      for (const k of RESP_KEYS) if (strip(cur[k]) !== strip(prev[k])) (o as Record<string, unknown>)[k] = cur[k]
      if (Object.keys(o).length) {
        node.responsive ??= {}
        node.responsive[BREAKPOINTS[bps[i]].id as "sm" | "md" | "lg" | "xl"] = o
      }
    }
    return node
  }
  const root = build(tree)
  if (!root.layout) root.layout = flexLayout({ direction: "column" })
  root.radius = 0
  return { root, warnings: Array.from(new Set(warnings)), count: count - 1 }
}

export const IMPORT_EXAMPLE = `.page {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-areas:
    "header"
    "main"
    "sidebar"
    "footer";
  gap: 16px;
  min-height: 100vh;
  padding: 16px;
}

.header { grid-area: header; }
.main { grid-area: main; }
.sidebar { grid-area: sidebar; }
.footer { grid-area: footer; }

@media (min-width: 768px) {
  .page {
    grid-template-columns: 240px 1fr;
    grid-template-rows: auto 1fr auto;
    grid-template-areas:
      "header header"
      "sidebar main"
      "footer footer";
  }
}

@media (min-width: 1280px) {
  .page {
    grid-template-columns: 280px 1fr 280px;
    grid-template-areas:
      "header header header"
      "sidebar main ads"
      "footer footer footer";
  }
  .ads { grid-area: ads; }
}`
