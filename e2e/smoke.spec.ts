import { test, expect } from "@playwright/test"

test("all tools open without runtime errors", async ({ page }) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("./#tools/mesh")
  await expect(page.getByRole("button", { name: "Random", exact: true })).toBeVisible()
  const labels = await page.locator("nav button").allTextContents()
  for (const label of labels.filter((label) => label.trim() && label.trim() !== "Collapse")) {
    await page.locator("nav").getByRole("button", { name: label.trim(), exact: true }).click()
    await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0)
    await expect(page.locator('[data-slot="tabs-content"]').first()).toBeVisible()
  }
  for (const name of ["Grid", "Flex", "Palette"]) {
    await page.getByRole("tab", { name, exact: true }).click()
    await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0)
  }
  expect(errors).toEqual([])
})

test("command palette supports keyboard, empty results and Escape", async ({ page }) => {
  await page.goto("./#tools/mesh")
  await page.keyboard.press("Control+k")
  const search = page.getByRole("combobox", { name: "Search tools" })
  await expect(search).toBeFocused()
  await expect(page.getByRole("option")).toHaveCount(36)
  await search.fill("glass")
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/#tools\/glass$/)
  await page.keyboard.press("Meta+k")
  await search.fill("no such tool")
  await expect(page.getByRole("status").filter({ hasText: "No tools found" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: "Search tools (Ctrl+K)", exact: true }).click()
  await search.fill("grid")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowUp")
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/#grid$/)
})

for (const route of ["tools/mesh", "tools/clip", "tools/glass", "grid", "flex", "palette"]) {
  test(`shared state round trip: ${route}`, async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await page.goto(`./#${route}`)
    await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0)
    if (route === "grid" || route === "flex") {
      await page.getByRole("button", { name: "Templates", exact: true }).click()
      await page.getByRole("menuitem", { name: route === "grid" ? "Cards on subgrid" : "Navbar", exact: true }).click()
      await page.getByRole("tab", { name: "Code", exact: true }).click()
    }
    await expect(page.locator("pre").first()).toBeVisible()
    if (route === "tools/mesh") await page.getByRole("button", { name: "Random", exact: true }).click()
    if (route === "tools/clip") await page.getByRole("button", { name: "Hexagon", exact: true }).click()
    if (route === "tools/glass") await page.getByRole("button", { name: "Colored", exact: true }).click()
    if (route === "palette") await page.getByRole("button", { name: "#2563eb", exact: true }).click()
    const before = await page.locator("pre").allTextContents()
    await page.getByRole("button", { name: "Copy link", exact: true }).click()
    const link = await page.evaluate(() => navigator.clipboard.readText())
    expect(link).toContain("?state=")
    const recipient = await context.browser()!.newContext()
    const other = await recipient.newPage()
    await other.goto(link)
    if (route === "grid" || route === "flex") await other.getByRole("tab", { name: "Code", exact: true }).click()
    await expect(other.locator("pre").first()).toBeVisible()
    await expect.poll(() => other.locator("pre").allTextContents()).toEqual(before)
    await recipient.close()
  })
}

test("bad shared state falls back to defaults", async ({ page }) => {
  await page.goto("./#tools/mesh?state=invalid")
  await expect(page.getByRole("button", { name: "Random", exact: true })).toBeVisible()
})

test("share captures immediate edits and restores links in the same tab", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("./#tools/mesh")
  await page.getByRole("button", { name: "Random", exact: true }).click()
  const original = await page.locator("pre").first().textContent()
  await page.getByRole("button", { name: "Copy link", exact: true }).click()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  await page.getByRole("button", { name: "Random", exact: true }).click()
  await expect(page.locator("pre").first()).not.toHaveText(original!)
  await page.evaluate((url) => { location.hash = new URL(url).hash }, link)
  await expect(page.locator("pre").first()).toHaveText(original!)
})

test("copy link has a manual fallback when clipboard is blocked", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("Blocked")) } }))
  await page.goto("./#tools/glass")
  await expect(page.locator("pre").first()).toBeVisible()
  await page.getByRole("button", { name: "Copy link", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "Share link" })).toHaveValue(/#tools\/glass\?state=/)
})

test("PWA caches unvisited tools and SEO pages for offline use", async ({ page, context }) => {
  await page.goto("./#tools/mesh")
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; if (!registration.active) throw new Error("No active service worker") })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole("button", { name: "Random", exact: true })).toBeVisible()
  await page.locator("nav").getByRole("button", { name: "Glassmorphism", exact: true }).click()
  await expect(page.locator("pre").first()).toContainText("backdrop-filter")
  await page.getByRole("tab", { name: "Grid", exact: true }).click()
  await page.getByRole("tab", { name: "Code", exact: true }).click()
  await expect(page.locator("pre").first()).toBeVisible()
  await page.goto("./tools/mesh-gradient/")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mesh Gradient Generator")
})

test("SEO pages, sitemap, robots and manifest are served under the deployment path", async ({ page, request }) => {
  for (const slug of ["mesh-gradient", "clip-path", "glassmorphism", "css-grid"]) {
    await page.goto(`./tools/${slug}/`)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://vumox.github.io/layout-forge/tools/${slug}/`)
    const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? "{}")
    expect(schema["@type"]).toBe("WebApplication")
    await page.getByRole("link", { name: /^Open / }).click()
    await expect(page.getByRole("button", { name: "Copy link", exact: true })).toBeVisible()
  }
  for (const path of ["sitemap.xml", "robots.txt", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"]) expect((await request.get(`./${path}`)).ok()).toBe(true)
})

test("mobile actions and palette are usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("./#tools/mesh")
  await page.getByRole("button", { name: "Search tools (Ctrl+K)", exact: true }).click()
  await page.getByRole("combobox", { name: "Search tools" }).fill("clip")
  await page.getByRole("option", { name: /clip-path/ }).click()
  await expect(page).toHaveURL(/#tools\/clip$/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
