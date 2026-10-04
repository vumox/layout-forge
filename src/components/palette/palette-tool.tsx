import { useEffect, useLayoutEffect, useMemo, useState } from "react"
import { rememberState, sharedState } from "@/lib/share"
import { ImageUpIcon, MoonIcon, PlusIcon, ShuffleIcon, SunIcon, Trash2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { type Extracted, extractColors, pickBase } from "@/lib/extract"
import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme"
import { type ColorFormat, randomHex } from "@/lib/color"
import { ColorInput } from "@/components/color-input"
import { EXPORT_KINDS, type ExportKind, HARMONIES, type Harmony, buildScales, exportPalette, harmonySeeds } from "@/lib/palette"
import { CodeBlock } from "@/components/code-block"
import { Field, IconButton, Section, SelectField, SliderField } from "@/components/fields"
import { SwatchRow } from "@/components/palette/swatch-row"
import { ThemePreview } from "@/components/palette/theme-preview"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface PaletteState {
  base: string
  harmony: Harmony
  hueShift: number
  chroma: number
  anchor: boolean
  neutralTint: number
  semantic: boolean
  custom: { id: string; name: string; hex: string }[]
  kind: ExportKind
  format: ColorFormat
  prefix: string
}

const DEFAULTS: PaletteState = {
  base: "#6d4aff",
  harmony: "complementary",
  hueShift: 0,
  chroma: 1,
  anchor: true,
  neutralTint: 0.012,
  semantic: true,
  custom: [],
  kind: "css",
  format: "oklch",
  prefix: "",
}

const QUICK = ["#6d4aff", "#2563eb", "#0ea5e9", "#10b981", "#84cc16", "#f59e0b", "#f97316", "#ef4444", "#ec4899", "#0f172a"]
const KEY = "lf-palette"

function load(): PaletteState {
  const shared = sharedState(KEY, DEFAULTS)
  if (shared) return shared
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<PaletteState>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}


function ImageSource({ onBase, onAddAll }: { onBase: (hex: string) => void; onAddAll: (colors: string[]) => void }) {
  const [preview, setPreview] = useState<string | null>(null)
  const [colors, setColors] = useState<Extracted[]>([])
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)

  const handle = async (file: Blob | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) return
    setBusy(true)
    try {
      const list = await extractColors(file)
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old)
        return URL.createObjectURL(file)
      })
      setColors(list)
      const base = pickBase(list)
      if (base) onBase(base.hex)
    } catch {
      toast.error("Could not read the image")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"))
      if (item) handle(item.getAsFile())
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  })

  return (
    <Section
      title="From image"
      action={
        preview ? (
          <IconButton
            label="Remove"
            onClick={() => {
              URL.revokeObjectURL(preview)
              setPreview(null)
              setColors([])
            }}
          >
            <XIcon />
          </IconButton>
        ) : undefined
      }
    >
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          handle(e.dataTransfer.files[0])
        }}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-dashed text-center text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50",
          preview ? "h-28" : "h-24",
          over && "border-primary bg-primary/5",
        )}
      >
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => handle(e.target.files?.[0])} />
        {preview ? (
          <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <ImageUpIcon className="size-5" />
            <span>{busy ? "Analyzing…" : "Drop, choose or Ctrl+V"}</span>
          </>
        )}
      </label>
      {colors.length > 0 && (
        <>
          <div className="flex h-7 overflow-hidden rounded-md ring-1 ring-foreground/10">
            {colors.map((c) => (
              <button
                key={c.hex}
                onClick={() => onBase(c.hex)}
                title={`${c.hex} · ${(c.weight * 100).toFixed(1)}% — make base`}
                className="h-full transition-[flex-grow] hover:brightness-110"
                style={{ background: c.hex, flexGrow: Math.max(c.weight, 0.04) }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {colors.map((c) => (
              <button
                key={c.hex}
                onClick={() => onBase(c.hex)}
                className="flex items-center gap-1 rounded-full border py-0.5 pr-1.5 pl-0.5 font-mono text-[10px] hover:bg-muted"
              >
                <span className="size-3.5 rounded-full" style={{ background: c.hex }} />
                {Math.round(c.weight * 100)}%
              </button>
            ))}
          </div>
          <Button variant="outline" size="xs" onClick={() => onAddAll(colors.filter((c) => c.oklch.c > 0.04).map((c) => c.hex))}>
            <PlusIcon />
            Add chromatic as custom colors
          </Button>
        </>
      )}
    </Section>
  )
}

export function PaletteTool() {
  const [s, setS] = useState<PaletteState>(load)
  useLayoutEffect(() => rememberState(KEY, s), [s])
  useEffect(() => {
    const onHash = () => {
      const shared = sharedState(KEY, DEFAULTS)
      if (shared) setS(shared)
    }
    addEventListener("hashchange", onHash)
    return () => removeEventListener("hashchange", onHash)
  }, [])
  const { resolvedTheme } = useTheme()
  const [mode, setMode] = useState<"light" | "dark">(resolvedTheme)
  const set = (patch: Partial<PaletteState>) => setS((prev) => ({ ...prev, ...patch }))

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(s))
      } catch {
        return
      }
    }, 300)
    return () => clearTimeout(t)
  }, [s])

  const seeds = useMemo(
    () => [...harmonySeeds(s.base, s.harmony).map((x) => ({ id: x.name, ...x })), ...s.custom],
    [s.base, s.harmony, s.custom],
  )
  const scales = useMemo(
    () =>
      buildScales({
        base: s.base,
        harmony: s.harmony,
        hueShift: s.hueShift,
        chroma: s.chroma,
        anchor: s.anchor,
        neutralTint: s.neutralTint,
        semantic: s.semantic,
        seeds,
      }),
    [s.base, s.harmony, s.hueShift, s.chroma, s.anchor, s.neutralTint, s.semantic, seeds],
  )
  const kindInfo = EXPORT_KINDS.find((k) => k.value === s.kind) ?? EXPORT_KINDS[0]
  const code = useMemo(() => exportPalette(scales, s.kind, { format: s.format, prefix: s.prefix }), [scales, s.kind, s.format, s.prefix])

  const updateCustom = (id: string, patch: Partial<{ name: string; hex: string }>) =>
    set({ custom: s.custom.map((c) => (c.id === id ? { ...c, ...patch } : c)) })

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <aside className="shrink-0 overflow-y-auto border-b bg-background lg:w-80 lg:border-r lg:border-b-0">
        <Section
          title="Base color"
          action={
            <IconButton label="Random color" onClick={() => set({ base: randomHex() })}>
              <ShuffleIcon />
            </IconButton>
          }
        >
          <ColorInput value={s.base} onChange={(base) => set({ base })} />
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((c) => (
              <button
                key={c}
                onClick={() => set({ base: c })}
                className={cn("size-5 rounded-full ring-offset-2 ring-offset-background transition hover:scale-110", s.base === c && "ring-2 ring-foreground/60")}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Section>
        <ImageSource
          onBase={(base) => set({ base })}
          onAddAll={(hexes) =>
            setS((prev) => ({
              ...prev,
              custom: [
                ...prev.custom,
                ...hexes.filter((h) => h !== prev.base).slice(0, 5).map((hex, i) => ({ id: Math.random().toString(36).slice(2, 8), name: `image-${prev.custom.length + i + 1}`, hex })),
              ],
            }))
          }
        />
        <Section title="Harmony">
          <SelectField
            label="Scheme"
            value={s.harmony}
            options={HARMONIES.map((h) => ({ value: h.value, label: h.label }))}
            onChange={(v) => set({ harmony: v as Harmony })}
          />
          <div className="flex flex-wrap gap-1.5">
            {seeds.map((x) => (
              <span key={x.id} className="flex items-center gap-1.5 rounded-full border py-0.5 pr-2 pl-0.5 font-mono text-[11px]">
                <span className="size-4 rounded-full" style={{ background: x.hex }} />
                {x.name}
              </span>
            ))}
          </div>
        </Section>
        <Section title="Scale generation">
          <SliderField label="Saturation" value={s.chroma} min={0.3} max={1.5} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(chroma) => set({ chroma })} />
          <SliderField label="Hue shift" value={s.hueShift} min={-40} max={40} unit="°" onChange={(hueShift) => set({ hueShift })} />
          <SliderField
            label="Neutral hue"
            value={s.neutralTint}
            min={0}
            max={0.05}
            step={0.002}
            format={(v) => `C ${v.toFixed(3)}`}
            onChange={(neutralTint) => set({ neutralTint })}
          />
          <div className="flex items-center justify-between">
            <Label htmlFor="anchor" className="text-xs">
              Keep the source color in the scale
            </Label>
            <Switch id="anchor" size="sm" checked={s.anchor} onCheckedChange={(anchor) => set({ anchor })} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="semantic" className="text-xs">
              Semantic colors
            </Label>
            <Switch id="semantic" size="sm" checked={s.semantic} onCheckedChange={(semantic) => set({ semantic })} />
          </div>
        </Section>
        <Section
          title="Custom colors"
          action={
            <Button
              variant="ghost"
              size="xs"
              onClick={() => set({ custom: [...s.custom, { id: Math.random().toString(36).slice(2, 8), name: `brand-${s.custom.length + 1}`, hex: randomHex() }] })}
            >
              <PlusIcon />
              Add
            </Button>
          }
        >
          {s.custom.length === 0 && <p className="text-xs text-muted-foreground">Add colors — each gets its own scale.</p>}
          {s.custom.map((c) => (
            <div key={c.id} className="flex flex-col gap-1.5 rounded-lg border p-2">
              <div className="flex items-center gap-1.5">
                <Input
                  value={c.name}
                  onChange={(e) => updateCustom(c.id, { name: e.target.value })}
                  className="h-7 font-mono text-xs"
                  aria-label="Token name"
                />
                <IconButton label="Delete" onClick={() => set({ custom: s.custom.filter((x) => x.id !== c.id) })}>
                  <Trash2Icon />
                </IconButton>
              </div>
              <ColorInput value={c.hex} onChange={(hex) => updateCustom(c.id, { hex })} />
            </div>
          ))}
        </Section>
      </aside>

      <main className="canvas-bg min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 p-4 md:p-8">
          <div className="flex flex-col gap-5 rounded-xl border bg-background p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Scales</h2>
                <p className="text-xs text-muted-foreground">Click a color to copy in format {s.format}. The dot is the source color.</p>
              </div>
            </div>
            {scales.map((sc) => (
              <SwatchRow key={sc.id} scale={sc} format={s.format} compact={sc.id !== "primary" && scales.length > 6} />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Theme preview</h2>
              </div>
              <ToggleGroup variant="outline" size="sm" spacing={0} value={[mode]} onValueChange={(v) => v[0] && setMode(v[0] as "light" | "dark")}>
                <ToggleGroupItem value="light" aria-label="Light">
                  <SunIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="dark" aria-label="Dark">
                  <MoonIcon />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <ThemePreview scales={scales} mode={mode} />
          </div>
        </div>
      </main>

      <aside className="flex min-h-[480px] shrink-0 flex-col border-t bg-background lg:min-h-0 lg:w-[420px] lg:border-t-0 lg:border-l">
        <div className="flex flex-col gap-3 border-b p-4">
          <div className="grid grid-cols-3 gap-1">
            {EXPORT_KINDS.map((k) => (
              <Button key={k.value} variant={s.kind === k.value ? "secondary" : "ghost"} size="sm" onClick={() => set({ kind: k.value })} className={cn(s.kind === k.value && "ring-1 ring-border")}>
                {k.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SelectField label="Value format" value={s.format} options={["hex", "oklch", "hsl", "rgb"]} onChange={(v) => set({ format: v as ColorFormat })} />
            <Field label="Token prefix">
              <Input value={s.prefix} placeholder="ds" onChange={(e) => set({ prefix: e.target.value })} className="h-7 font-mono text-xs" />
            </Field>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <CodeBlock code={code} lang={kindInfo.lang} filename={kindInfo.file} className="flex-1" />
        </div>
      </aside>
    </div>
  )
}
