import { describe, expect, it } from "vitest"
import { generateCss, generateHtml, slug } from "@/layout/export"

import { createNode, flexLayout, gridLayout } from "@/layout/defaults"

const options = { areas: false, demo: false, content: false }

describe("layout export", () => {
  it("slugifies names into class names", () => {
    expect(slug("Main Header")).toBe("main-header")
    expect(slug("Привет мир")).toBe("privet-mir")
  })

  it("avoids reserved CSS keywords", () => {
    expect(slug("auto")).not.toBe("auto")
  })
})

describe("generated layout code", () => {
  it("uses matching unique classes in CSS and HTML for repeated names", () => {
    const root = createNode({ name: "Main", layout: flexLayout(), children: [createNode({ name: "Main" }), createNode({ name: "Main" })] })
    const html = generateHtml(root, options)
    const css = generateCss(root, options)
    expect(html).toBe('<div class="main">\n  <div class="main-2">Main</div>\n  <div class="main-3">Main</div>\n</div>\n')
    for (const name of ["main", "main-2", "main-3"]) expect(css).toContain(`.${name} {`)
  })

  it("escapes leaf text so a node name cannot become HTML markup", () => {
    const html = generateHtml(createNode({ name: "<script>&test</script>" }), options)
    expect(html).toContain("&lt;script&gt;&amp;test&lt;/script&gt;")
    expect(html).not.toContain("<script>")
  })

  it("exports grid tracks and child line placement without demo styling", () => {
    const root = createNode({ name: "layout", layout: gridLayout(["1fr", "1fr", "1fr"], ["80px"], 8), children: [createNode({ name: "card", area: { c1: 2, c2: 4, r1: 1, r2: 2 } })] })
    const css = generateCss(root, options)
    expect(css).toContain("grid-template-columns: repeat(3, 1fr);")
    expect(css).toContain("grid-template-rows: 80px;")
    expect(css).toContain("gap: 8px;")
    expect(css).toContain("grid-column: 2 / 4;")
    expect(css).toContain("grid-row: 1 / 2;")
    expect(css).not.toContain("background:")
    expect(css).not.toContain("border-radius:")
  })

  it("uses named areas only when children do not overlap", () => {
    const a = createNode({ name: "left" })
    const b = createNode({ name: "right", area: { c1: 2, c2: 3, r1: 1, r2: 2 } })
    const root = createNode({ layout: gridLayout(["1fr", "1fr"], ["1fr"]), children: [a, b] })
    const css = generateCss(root, { ...options, areas: true })
    expect(css).toContain('"left right"')
    expect(css).toContain("grid-area: left;")
    b.area = { ...a.area }
    const overlapping = generateCss(root, { ...options, areas: true })
    expect(overlapping).not.toContain("grid-template-areas:")
    expect(overlapping).not.toContain("grid-area:")
    expect(overlapping).toContain("grid-column: 1 / 2;")
  })

  it("falls back to grid lines when a responsive override introduces overlap", () => {
    const a = createNode({ name: "left" })
    const b = createNode({ name: "right", area: { c1: 2, c2: 3, r1: 1, r2: 2 }, responsive: { md: { area: { ...a.area } } } })
    const root = createNode({ layout: gridLayout(["1fr", "1fr"], ["1fr"]), children: [a, b] })
    const css = generateCss(root, { ...options, areas: true })
    expect(css).not.toContain("grid-template-areas:")
    expect(css).toContain("@media (min-width: 768px)")
    expect(css).toContain("grid-column: 1 / 2;")
  })

  it("resets removed dimensions and separates equal gaps in responsive rules", () => {
    const root = createNode({ name: "layout", width: "100px", layout: flexLayout({ columnGap: 12, rowGap: 12 }), responsive: { md: { width: "", layout: flexLayout({ columnGap: 0, rowGap: 6 }) } } })
    const css = generateCss(root, options)
    const media = css.slice(css.indexOf("@media"))
    expect(css).toContain("width: 100px;")
    expect(media).toContain("@media (min-width: 768px)")
    expect(media).toContain("width: auto;")
    expect(media).toContain("row-gap: 6px;")
    expect(media).toContain("column-gap: 0;")
    expect(media).not.toContain("display:")
  })

  it("does not emit media rules for an override that changes no CSS", () => {
    const root = createNode({ padding: 12, responsive: { sm: { padding: 12 } } })
    expect(generateCss(root, options)).not.toContain("@media")
  })

  it("does not mutate the source tree while normalizing exported placement", () => {
    const root = createNode({ layout: gridLayout(["1fr"], ["1fr"]), children: [createNode({ area: { c1: 9, c2: 12, r1: 1, r2: 2 } })] })
    const before = structuredClone(root)
    expect(generateCss(root, options)).toContain("grid-column: 1 / 2;")
    generateHtml(root, options)
    expect(root).toEqual(before)
  })
})
