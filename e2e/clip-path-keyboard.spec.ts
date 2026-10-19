import { test, expect } from "@playwright/test"
import { build } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"

let component: string

test.beforeAll(async () => {
  const bundle = await build({
    configFile: false,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: { alias: { "@": path.resolve("src") } },
    plugins: [react()],
    build: { write: false, minify: false, lib: { entry: path.resolve("e2e/fixtures/clip-path.tsx"), name: "ClipTest", formats: ["iife"] } },
  })
  const output = Array.isArray(bundle) ? bundle[0] : bundle
  if (!("output" in output)) throw new Error("Expected component bundle")
  const chunk = output.output.find((item) => item.type === "chunk")
  if (!chunk || chunk.type !== "chunk") throw new Error("Missing component bundle")
  component = chunk.code
})

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => { throw error })
  await page.route("https://clip.test/", (route) => route.fulfill({ body: '<!doctype html><div id="root"></div>', contentType: "text/html" }))
  await page.goto("https://clip.test/")
  await page.addScriptTag({ content: component })
  await expect(page.getByRole("button").first()).toBeVisible()
})

test("Tab and Shift+Tab retain native traversal outside the canvas", async ({ page }) => {
  const first = page.getByRole("button").first()
  await first.focus()
  await page.keyboard.press("Tab")
  await expect(first).not.toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(first).toBeFocused()
})

test("shortcuts outside the canvas do not edit its points", async ({ page }) => {
  await page.getByRole("button", { name: "circle", exact: true }).click()
  const handles = page.locator('span[title]')
  const original = await handles.first().getAttribute("style")
  await page.getByRole("button", { name: "Hotkeys", exact: true }).focus()
  await page.keyboard.press("ArrowRight")
  await expect(handles.first()).toHaveAttribute("style", original!)
})

test("canvas editing retains point selection and nudging without trapping Tab", async ({ page }) => {
  const canvas = page.getByRole("group", { name: "Clip-path canvas" })
  await canvas.focus()
  const point = canvas.locator("span[title]").first()
  const original = await point.getAttribute("style")
  await page.keyboard.press("PageDown")
  await page.keyboard.press("ArrowRight")
  await expect(point).not.toHaveAttribute("style", original!)
  await page.keyboard.press("Tab")
  await expect(canvas).not.toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(canvas).toBeFocused()
})
