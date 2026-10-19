import { test, expect } from "@playwright/test"
import { build } from "vite"
import path from "node:path"
import type { ImportResult } from "../src/layout/import"

let importer: string

test.beforeAll(async () => {
  const bundle = await build({
    configFile: false,
    resolve: { alias: { "@": path.resolve("src") } },
    build: {
      write: false,
      minify: false,
      lib: { entry: path.resolve("src/layout/import.ts"), name: "LayoutImport", formats: ["iife"] },
    },
  })
  const output = Array.isArray(bundle) ? bundle[0] : bundle
  if (!("output" in output)) throw new Error("Expected importer bundle")
  const chunk = output.output.find((item) => item.type === "chunk")
  if (!chunk || chunk.type !== "chunk") throw new Error("Missing importer bundle")
  importer = chunk.code
})

async function importHtml(page: import("@playwright/test").Page, html: string) {
  await page.setContent("<!doctype html><html><body></body></html>")
  await page.addScriptTag({ content: importer })
  return page.evaluate((input) => {
    const api = (window as unknown as { LayoutImport: { importLayout: (css: string, html: string) => ImportResult } }).LayoutImport
    return api.importLayout("", input)
  }, html)
}

test("warns when flex HTML anchor children are not imported as layout nodes", async ({ page }) => {
  const result = await importHtml(page, '<div style="display:flex"><a href="#one">One</a><a href="#two">Two</a></div>')
  expect(result.count).toBe(0)
  expect(result.root.children).toHaveLength(0)
  expect(result.warnings).toEqual([
    "HTML import skipped 2 unsupported direct child elements (<a>) in <div>; they were not imported as separate layout nodes",
  ])
})

test("reports only omitted direct children while retaining structural children", async ({ page }) => {
  const result = await importHtml(page, '<main style="display:grid"><section><p>Retained text content</p></section><a>Skipped link</a><style>.note {color:red}</style><script>void 0</script></main>')
  expect(result.count).toBe(1)
  expect(result.root.children[0].content).toBe("text")
  expect(result.warnings).toEqual([
    "HTML import skipped 1 unsupported direct child element (<a>) in <main>; they were not imported as separate layout nodes",
  ])
})

test("does not warn for represented leaf content or normal structural layouts", async ({ page }) => {
  const result = await importHtml(page, '<div style="display:flex"><section><h2>Title</h2><p>Body</p></section><aside><p>Text</p></aside></div>')
  expect(result.count).toBe(2)
  expect(result.root.children.map((child) => child.content)).toEqual(["card", "text"])
  expect(result.warnings).toEqual([])
})

test("warns for omitted siblings in the synthetic HTML root", async ({ page }) => {
  const result = await importHtml(page, '<div><p>Retained</p></div><a>Skipped</a>')
  expect(result.count).toBe(1)
  expect(result.warnings).toEqual([
    "HTML import skipped 1 unsupported direct child element (<a>) in the HTML root; they were not imported as separate layout nodes",
  ])
})
