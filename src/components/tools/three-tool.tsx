import { useEffect, useRef, useState } from "react"
import * as THREE from "@/lib/three-runtime"
import { CameraIcon } from "lucide-react"
import { DEFAULT_THREE, SCENE_PRESETS, type SceneId, type ThreeConfig, exportHtml, exportModule, exportReact, sceneSource } from "@/lib/three-scenes"
import { usePersistent } from "@/lib/use-persistent"
import { cn } from "@/lib/utils"
import { ColorInput } from "@/components/color-input"
import { Field, Section, SliderField } from "@/components/fields"
import { ToolLayout } from "@/components/tools/tool-layout"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface Runtime {
  update: (c: ThreeConfig) => void
  snapshot: () => string
  dispose: () => void
}

type NumKey = "amplitude" | "frequency" | "detail" | "count" | "rotation"

const CONTROLS: Record<SceneId, { key: NumKey; label: string; min: number; max: number; step: number }[]> = {
  blob: [
    { key: "amplitude", label: "Deformation", min: 0, max: 1, step: 0.01 },
    { key: "frequency", label: "Noise frequency", min: 0.2, max: 4, step: 0.05 },
    { key: "detail", label: "Detail", min: 4, max: 96, step: 1 },
    { key: "rotation", label: "Rotation", min: 0, max: 3, step: 0.05 },
  ],
  waves: [
    { key: "amplitude", label: "Wave height", min: 0, max: 2, step: 0.01 },
    { key: "frequency", label: "Frequency", min: 0.2, max: 4, step: 0.05 },
    { key: "detail", label: "Grid density", min: 16, max: 128, step: 1 },
    { key: "rotation", label: "Rotation", min: 0, max: 3, step: 0.05 },
  ],
  galaxy: [
    { key: "count", label: "Particles", min: 2000, max: 150000, step: 1000 },
    { key: "amplitude", label: "Twist", min: 0, max: 1.5, step: 0.01 },
    { key: "frequency", label: "Arms (×2)", min: 1, max: 5, step: 0.5 },
    { key: "detail", label: "Particle size", min: 1, max: 60, step: 1 },
    { key: "rotation", label: "Rotation", min: 0, max: 3, step: 0.05 },
  ],
  knot: [
    { key: "detail", label: "Detail", min: 8, max: 64, step: 1 },
    { key: "amplitude", label: "Pulsation", min: 0, max: 1, step: 0.01 },
    { key: "rotation", label: "Rotation", min: 0, max: 3, step: 0.05 },
  ],
  gradient: [
    { key: "amplitude", label: "Distortion", min: 0, max: 3, step: 0.01 },
    { key: "frequency", label: "Scale", min: 0.3, max: 5, step: 0.05 },
  ],
  glass: [
    { key: "amplitude", label: "Frostiness", min: 0, max: 1, step: 0.01 },
    { key: "frequency", label: "Refraction (IOR)", min: 1, max: 2.3, step: 0.01 },
    { key: "count", label: "Shapes", min: 1, max: 7, step: 1 },
    { key: "detail", label: "Detail", min: 8, max: 64, step: 1 },
    { key: "rotation", label: "Rotation", min: 0, max: 3, step: 0.05 },
  ],
  globe: [
    { key: "count", label: "Grid points", min: 4000, max: 40000, step: 1000 },
    { key: "amplitude", label: "Arc routes", min: 0, max: 40, step: 1 },
    { key: "frequency", label: "Continent scale", min: 0.6, max: 3, step: 0.05 },
    { key: "detail", label: "Dot size", min: 1, max: 10, step: 1 },
    { key: "rotation", label: "Rotation", min: 0, max: 4, step: 0.05 },
  ],
  terrain: [
    { key: "amplitude", label: "Mountain height", min: 0, max: 2, step: 0.01 },
    { key: "frequency", label: "Relief scale", min: 0.3, max: 3, step: 0.05 },
    { key: "detail", label: "Grid density", min: 20, max: 120, step: 1 },
  ],
  shapes: [
    { key: "count", label: "Shapes", min: 5, max: 400, step: 5 },
    { key: "amplitude", label: "Floating", min: 0, max: 1.5, step: 0.01 },
    { key: "frequency", label: "Spread", min: 0.3, max: 3, step: 0.05 },
    { key: "rotation", label: "Rotation", min: 0, max: 3, step: 0.05 },
  ],
  tunnel: [
    { key: "count", label: "Rings", min: 8, max: 60, step: 1 },
    { key: "detail", label: "Ring sides", min: 3, max: 64, step: 1 },
    { key: "frequency", label: "Flight speed", min: 0, max: 3, step: 0.05 },
    { key: "amplitude", label: "Twist", min: 0, max: 3, step: 0.05 },
    { key: "rotation", label: "Ring rotation", min: 0, max: 3, step: 0.05 },
  ],
}

const SHAPES: { value: ThreeConfig["shape"]; label: string }[] = [
  { value: "sphere", label: "Sphere" },
  { value: "torus", label: "Torus" },
  { value: "knot", label: "Node" },
  { value: "cube", label: "Cube" },
  { value: "capsule", label: "Capsule" },
  { value: "icosa", label: "Icosahedron" },
]

export function ThreeTool() {
  const [s, set] = usePersistent<ThreeConfig>("lf-tool-three", DEFAULT_THREE)
  const [hero, setHero] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runtime = useRef<Runtime | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let rt: Runtime | null = null
    try {
      const factory = new Function("THREE", "canvas", "config", sceneSource(s.scene)) as (t: typeof THREE, c: HTMLCanvasElement, cfg: ThreeConfig) => Runtime
      rt = factory(THREE, canvas, s)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "WebGL unavailable")
    }
    runtime.current = rt
    return () => {
      rt?.dispose()
      runtime.current = null
    }
  }, [s.scene])

  useEffect(() => {
    runtime.current?.update(s)
  }, [s])

  const snapshot = () => {
    const url = runtime.current?.snapshot()
    if (!url) return
    const a = document.createElement("a")
    a.href = url
    a.download = `3d-${s.scene}.png`
    a.click()
  }

  const outputs = [
    { id: "html", label: "HTML", lang: "html", file: "scene.html", code: exportHtml(s) },
    { id: "js", label: "JS module", lang: "js", file: "scene.js", code: exportModule(s) },
    { id: "react", label: "React", lang: "jsx", file: "Scene3D.jsx", code: exportReact() },
  ]

  const controls = (
    <>
      <Section title="Scene">
        <div className="grid grid-cols-2 gap-1.5">
          {SCENE_PRESETS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={s.scene === p.id ? "secondary" : "outline"}
              className={cn("justify-start", s.scene === p.id && "ring-1 ring-primary/40")}
              onClick={() => set({ ...p.config, scene: p.id })}
            >
              {p.name}
            </Button>
          ))}
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          three.js r{THREE.REVISION}. Move the mouse over the preview.
        </p>
      </Section>
      <Section title="Shape and motion">
        {CONTROLS[s.scene].map((c) => (
          <SliderField
            key={c.key}
            label={c.label}
            value={s[c.key]}
            min={c.min}
            max={c.max}
            step={c.step}
            format={(v) => (c.step >= 1 ? String(v) : v.toFixed(2))}
            onChange={(v) => set({ [c.key]: v } as Partial<ThreeConfig>)}
          />
        ))}
        <SliderField label="Speed" value={s.speed} min={0} max={3} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(speed) => set({ speed })} />
        {s.scene !== "gradient" && (
          <>
            <SliderField label="Parallax" value={s.parallax} min={0} max={2} step={0.05} format={(v) => v.toFixed(2)} onChange={(parallax) => set({ parallax })} />
            <SliderField label="Camera" value={s.zoom} min={2} max={12} step={0.1} format={(v) => v.toFixed(1)} onChange={(zoom) => set({ zoom })} />
          </>
        )}
        {s.scene === "waves" && (
          <ToggleGroup variant="outline" size="sm" spacing={0} className="w-full" value={[s.style]} onValueChange={(v) => v[0] && set({ style: v[0] as ThreeConfig["style"] })}>
            <ToggleGroupItem value="points" className="flex-1 text-xs">
              Points
            </ToggleGroupItem>
            <ToggleGroupItem value="wire" className="flex-1 text-xs">
              Grid
            </ToggleGroupItem>
            <ToggleGroupItem value="solid" className="flex-1 text-xs">
              Surface
            </ToggleGroupItem>
          </ToggleGroup>
        )}
        {(s.scene === "glass" || s.scene === "shapes") && (
          <ToggleGroup variant="outline" size="sm" spacing={0} className="grid w-full grid-cols-3" value={[s.shape]} onValueChange={(v) => v[0] && set({ shape: v[0] as ThreeConfig["shape"] })}>
            {SHAPES.map((sh) => (
              <ToggleGroupItem key={sh.value} value={sh.value} className="text-xs">
                {sh.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        {(s.scene === "blob" || s.scene === "knot" || s.scene === "terrain") && (
          <div className="flex items-center justify-between">
            <Label htmlFor="wire" className="text-xs">
              {s.scene === "terrain" ? "Sun on the horizon" : "Wireframe"}
            </Label>
            <Switch id="wire" size="sm" checked={s.wireframe} onCheckedChange={(wireframe) => set({ wireframe })} />
          </div>
        )}
      </Section>
      <Section title="Colors">
        <Field label={s.scene === "knot" ? "Light 1" : s.scene === "glass" ? "Blob 1" : s.scene === "globe" ? "Land" : "Color 1"}>
          <ColorInput value={s.c1} compact onChange={(c1) => set({ c1 })} />
        </Field>
        <Field label={s.scene === "knot" ? "Light 2" : s.scene === "glass" ? "Blob 2" : s.scene === "globe" ? "Ocean and atmosphere" : "Color 2"}>
          <ColorInput value={s.c2} compact onChange={(c2) => set({ c2 })} />
        </Field>
        <Field label={s.scene === "knot" ? "Light 3" : s.scene === "glass" ? "Blob 3" : s.scene === "globe" ? "Arcs" : s.scene === "terrain" ? "Peaks and sun" : "Color 3"}>
          <ColorInput value={s.c3} compact onChange={(c3) => set({ c3 })} />
        </Field>
        {s.scene !== "gradient" && (
          <>
            <Field label="Background">
              <ColorInput value={s.background} compact onChange={(background) => set({ background })} />
            </Field>
            <div className="flex items-center justify-between">
              <Label htmlFor="transparent" className="text-xs">
                Transparent background
              </Label>
              <Switch id="transparent" size="sm" checked={s.transparent} onCheckedChange={(transparent) => set({ transparent })} />
            </div>
          </>
        )}
      </Section>
      <Section title="Preview">
        <div className="flex items-center justify-between">
          <Label htmlFor="hero" className="text-xs">
            Hero text over the scene
          </Label>
          <Switch id="hero" size="sm" checked={hero} onCheckedChange={setHero} />
        </div>
      </Section>
    </>
  )

  return (
    <ToolLayout
      controls={controls}
      outputs={outputs}
      footer={
        <Button variant="outline" size="sm" onClick={snapshot}>
          <CameraIcon />
          PNG snapshot
        </Button>
      }
    >
      <div className="absolute inset-0">
        <canvas key={s.scene} ref={canvasRef} className="block size-full" />
        {hero && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center text-white">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs backdrop-blur">New release</span>
            <h2 className="max-w-xl text-3xl leading-tight font-semibold drop-shadow-lg md:text-5xl">Interfaces people remember</h2>
            <p className="max-w-md text-sm text-white/75">3D background on three.js — export as a single file.</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-destructive">
            Could not start WebGL: {error}
          </div>
        )}
      </div>
    </ToolLayout>
  )
}
