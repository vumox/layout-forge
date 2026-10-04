import { chromium } from "@playwright/test"
import { mkdir } from "node:fs/promises"

const browser = await chromium.launch()
const page = await browser.newPage()
await mkdir("public/icons", { recursive: true })
for (const [name, size, maskable] of [["icon-192", 192, false], ["icon-512", 512, false], ["maskable-512", 512, true]]) {
  const inset = maskable ? 115 : 80
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>body{margin:0}</style><svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" rx="${maskable ? 0 : 100}" fill="#18181b"/><g transform="translate(${inset} ${inset}) scale(${(512 - 2 * inset) / 352})"><rect width="162" height="162" rx="20" fill="#fafafa"/><rect x="190" width="162" height="162" rx="20" fill="#a78bfa"/><rect y="190" width="352" height="162" rx="20" fill="#ddd6fe"/></g></svg>`)
  await page.screenshot({ path: `public/icons/${name}.png` })
}
await browser.close()
console.log("Generated three PWA icons in public/icons/")
