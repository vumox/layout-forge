import { chromium } from "@playwright/test"
import { mkdir, rm } from "node:fs/promises"
import { spawnSync } from "node:child_process"

const base = process.env.DEMO_URL ?? "http://127.0.0.1:4173/layout-forge/"
const browser = await chromium.launch()
const demos = [
  { name: "mesh-gradient", route: "tools/mesh", picks: ["Sunset", "Ocean", "Candy"] },
  { name: "clip-path", route: "tools/clip", picks: ["Triangle", "Hexagon", "Star"] },
  { name: "glassmorphism", route: "tools/glass", picks: ["Frost", "Dark", "Colored"] },
  { name: "css-grid", route: "grid", picks: [] },
  { name: "palette", route: "palette", picks: ["#2563eb", "#10b981", "#ec4899"] },
  { name: "waves", route: "tools/wave", picks: [] },
]
await mkdir("docs/demos", { recursive: true })
try {
  for (const demo of demos) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
    await context.addInitScript(() => localStorage.setItem("lf-theme", "dark"))
    const page = await context.newPage()
    await page.goto(`${base}#${demo.route}`)
    await page.getByText("Loading…", { exact: true }).waitFor({ state: "hidden" })
    if (demo.route === "grid") await page.getByRole("tab", { name: "Code", exact: true }).click()
    await page.locator("pre").first().waitFor({ state: "visible" })
    await page.evaluate(() => document.fonts.ready)
    const directory = `.demo-frames/${demo.name}`
    await mkdir(directory, { recursive: true })
    for (let frame = 0; frame < 36; frame++) {
      if (frame % 9 === 0 && frame > 0) {
        const index = frame / 9 - 1
        if (demo.picks[index]) await page.getByRole("button", { name: demo.picks[index], exact: true }).click()
        else if (demo.route === "grid") await page.getByRole("button", { name: "Element", exact: true }).click()
        else {
          const slider = page.getByRole("slider").first()
          await slider.focus()
          for (let n = 0; n < 5; n++) await page.keyboard.press("ArrowRight")
        }
      }
      await page.screenshot({ path: `${directory}/${String(frame).padStart(3, "0")}.png` })
      await page.waitForTimeout(120)
    }
    const output = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "6", "-i", `${directory}/%03d.png`, "-filter_complex", "[0:v]scale=1000:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3", "-loop", "0", `docs/demos/${demo.name}.gif`], { encoding: "utf8" })
    if (output.status !== 0) throw new Error(output.stderr)
    await context.close()
    console.log(`Recorded docs/demos/${demo.name}.gif (6 seconds, 36 frames)`)
  }
} finally {
  await browser.close()
  await rm(".demo-frames", { recursive: true, force: true })
}
