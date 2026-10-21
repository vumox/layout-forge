import { test, expect } from "@playwright/test"

test("mockup stage provides accessible landmark and keyboard item selection", async ({ page }) => {
  await page.goto("./#tools/mockup")
  const stage = page.getByRole("region", { name: "Mockup stage" })
  await expect(stage).toBeVisible()

  const laptop = stage.getByRole("button", { name: "Laptop" })
  const phone = stage.getByRole("button", { name: "Phone" })
  await expect(laptop).toBeVisible()
  await expect(phone).toBeVisible()

  await laptop.focus()
  await expect(laptop).toBeFocused()
  await expect(laptop).toHaveAttribute("aria-pressed", "false")

  await page.keyboard.press("Enter")
  await expect(laptop).toHaveAttribute("aria-pressed", "true")

  const initialLeft = parseFloat(await laptop.evaluate((el) => (el as HTMLElement).style.left))
  await page.keyboard.press("ArrowRight")
  await expect
    .poll(async () => parseFloat(await laptop.evaluate((el) => (el as HTMLElement).style.left)))
    .toBe(initialLeft + 1)

  await page.keyboard.press("Shift+ArrowRight")
  await expect
    .poll(async () => parseFloat(await laptop.evaluate((el) => (el as HTMLElement).style.left)))
    .toBe(initialLeft + 11)

  await page.keyboard.press("Tab")
  await expect(phone).toBeFocused()

  await page.keyboard.press("Space")
  await expect(phone).toHaveAttribute("aria-pressed", "true")
  await expect(phone).toBeFocused()

  await page.keyboard.press("Escape")
  await expect(phone).toHaveAttribute("aria-pressed", "false")
})

test("mockup keyboard shortcuts are scoped to stage focus", async ({ page }) => {
  await page.goto("./#tools/mockup")
  const stage = page.getByRole("region", { name: "Mockup stage" })
  const laptop = stage.getByRole("button", { name: "Laptop" })
  await laptop.focus()
  await page.keyboard.press("Enter")
  await expect(laptop).toHaveAttribute("aria-pressed", "true")

  const snapBtn = page.getByRole("button", { name: "Snap (Ctrl — off)" })
  await snapBtn.focus()
  await expect(snapBtn).toBeFocused()

  const leftBefore = parseFloat(await laptop.evaluate((el) => (el as HTMLElement).style.left))
  await page.keyboard.press("ArrowRight")
  await expect
    .poll(async () => parseFloat(await laptop.evaluate((el) => (el as HTMLElement).style.left)))
    .toBe(leftBefore)
})
