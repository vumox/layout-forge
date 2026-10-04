import { Suspense, lazy, useEffect, type ComponentType } from "react"
import {
  ArrowUpRightIcon,
  AppWindowIcon,
  CloudMoonIcon,
  FlameIcon,
  SnowflakeIcon,
  TimerIcon,
  WandSparklesIcon,
  BlendIcon,
  BoxIcon,
  Gamepad2Icon,
  GemIcon,
  LaptopIcon,
  PuzzleIcon,
  ShareIcon,
  SunsetIcon,
  TerminalIcon,
  WindIcon,
  ScanLineIcon,
  CircleDashedIcon,
  ClapperboardIcon,
  DropletsIcon,
  GlassWaterIcon,
  Grid3x3Icon,
  ImageIcon,
  MountainIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  RulerIcon,
  ScissorsIcon,
  ShapesIcon,
  SlashIcon,
  SparkleIcon,
  SquareDashedIcon,
  SunIcon,
  WavesIcon,
} from "lucide-react"
import { parseHash, writeHash } from "@/lib/route"
import { TOOL_GROUPS } from "@/lib/tool-catalog"
import { usePersistent } from "@/lib/use-persistent"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const AnimationTool = lazy(() => import("@/components/tools/animation-tool").then((m) => ({ default: m.AnimationTool })))
const ArrowTool = lazy(() => import("@/components/tools/arrow-tool").then((m) => ({ default: m.ArrowTool })))
const AsciiTool = lazy(() => import("@/components/tools/ascii-tool").then((m) => ({ default: m.AsciiTool })))
const AuroraTool = lazy(() => import("@/components/tools/aurora-tool").then((m) => ({ default: m.AuroraTool })))
const BauhausTool = lazy(() => import("@/components/tools/bauhaus-tool").then((m) => ({ default: m.BauhausTool })))
const BlobTool = lazy(() => import("@/components/tools/blob-tool").then((m) => ({ default: m.BlobTool })))
const BurstTool = lazy(() => import("@/components/tools/burst-tool").then((m) => ({ default: m.BurstTool })))
const ClipPathTool = lazy(() => import("@/components/tools/clip-path-tool").then((m) => ({ default: m.ClipPathTool })))
const DitherTool = lazy(() => import("@/components/tools/dither-tool").then((m) => ({ default: m.DitherTool })))
const DividerTool = lazy(() => import("@/components/tools/divider-tool").then((m) => ({ default: m.DividerTool })))
const EffectsTool = lazy(() => import("@/components/tools/effects-tool").then((m) => ({ default: m.EffectsTool })))
const FaviconTool = lazy(() => import("@/components/tools/favicon-tool").then((m) => ({ default: m.FaviconTool })))
const FlowTool = lazy(() => import("@/components/tools/flow-tool").then((m) => ({ default: m.FlowTool })))
const GlassTool = lazy(() => import("@/components/tools/glass-tool").then((m) => ({ default: m.GlassTool })))
const ImageTool = lazy(() => import("@/components/tools/image-tool").then((m) => ({ default: m.ImageTool })))
const LavaTool = lazy(() => import("@/components/tools/lava-tool").then((m) => ({ default: m.LavaTool })))
const LineTool = lazy(() => import("@/components/tools/line-tool").then((m) => ({ default: m.LineTool })))
const LowPolyTool = lazy(() => import("@/components/tools/lowpoly-tool").then((m) => ({ default: m.LowPolyTool })))
const MaskTool = lazy(() => import("@/components/tools/mask-tool").then((m) => ({ default: m.MaskTool })))
const MeshTool = lazy(() => import("@/components/tools/mesh-tool").then((m) => ({ default: m.MeshTool })))
const MockupTool = lazy(() => import("@/components/tools/mockup-tool").then((m) => ({ default: m.MockupTool })))
const OgTool = lazy(() => import("@/components/tools/og-tool").then((m) => ({ default: m.OgTool })))
const ParticlesTool = lazy(() => import("@/components/tools/particles-tool").then((m) => ({ default: m.ParticlesTool })))
const PatternTool = lazy(() => import("@/components/tools/pattern-tool").then((m) => ({ default: m.PatternTool })))
const PixelTool = lazy(() => import("@/components/tools/pixel-tool").then((m) => ({ default: m.PixelTool })))
const ScatterTool = lazy(() => import("@/components/tools/scatter-tool").then((m) => ({ default: m.ScatterTool })))
const ScrollVideoTool = lazy(() => import("@/components/tools/scroll-video-tool").then((m) => ({ default: m.ScrollVideoTool })))
const ShadowTool = lazy(() => import("@/components/tools/shadow-tool").then((m) => ({ default: m.ShadowTool })))
const SynthTool = lazy(() => import("@/components/tools/synth-tool").then((m) => ({ default: m.SynthTool })))
const TopoTool = lazy(() => import("@/components/tools/topo-tool").then((m) => ({ default: m.TopoTool })))
const UnitsTool = lazy(() => import("@/components/tools/units-tool").then((m) => ({ default: m.UnitsTool })))
const WaveTool = lazy(() => import("@/components/tools/wave-tool").then((m) => ({ default: m.WaveTool })))

const ThreeTool = lazy(() => import("@/components/tools/three-tool").then((m) => ({ default: m.ThreeTool })))

interface Tool {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  view: ComponentType
}

const VIEWS: Record<string, Pick<Tool, "icon" | "view">> = {
  mesh: { icon: DropletsIcon, view: MeshTool },
  pattern: { icon: Grid3x3Icon, view: PatternTool },
  scatter: { icon: ShapesIcon, view: ScatterTool },
  topo: { icon: MountainIcon, view: TopoTool },
  burst: { icon: SunIcon, view: BurstTool },
  aurora: { icon: CloudMoonIcon, view: AuroraTool },
  lava: { icon: FlameIcon, view: LavaTool },
  image: { icon: ImageIcon, view: ImageTool },
  bauhaus: { icon: PuzzleIcon, view: BauhausTool },
  lowpoly: { icon: GemIcon, view: LowPolyTool },
  flow: { icon: WindIcon, view: FlowTool },
  dither: { icon: ScanLineIcon, view: DitherTool },
  ascii: { icon: TerminalIcon, view: AsciiTool },
  pixel: { icon: Gamepad2Icon, view: PixelTool },
  synth: { icon: SunsetIcon, view: SynthTool },
  divider: { icon: SlashIcon, view: DividerTool },
  wave: { icon: WavesIcon, view: WaveTool },
  blob: { icon: CircleDashedIcon, view: BlobTool },
  clip: { icon: ScissorsIcon, view: ClipPathTool },
  line: { icon: SparkleIcon, view: LineTool },
  arrow: { icon: ArrowUpRightIcon, view: ArrowTool },
  glass: { icon: GlassWaterIcon, view: GlassTool },
  mask: { icon: SquareDashedIcon, view: MaskTool },
  fx: { icon: WandSparklesIcon, view: EffectsTool },
  shadow: { icon: BlendIcon, view: ShadowTool },
  three: { icon: BoxIcon, view: ThreeTool },
  animation: { icon: TimerIcon, view: AnimationTool },
  particles: { icon: SnowflakeIcon, view: ParticlesTool },
  scroll: { icon: ClapperboardIcon, view: ScrollVideoTool },
  mockup: { icon: LaptopIcon, view: MockupTool },
  og: { icon: ShareIcon, view: OgTool },
  favicon: { icon: AppWindowIcon, view: FaviconTool },
  units: { icon: RulerIcon, view: UnitsTool },
}

const GROUPS = TOOL_GROUPS.map((group) => ({ ...group, tools: group.tools.map((tool) => ({ ...tool, ...VIEWS[tool.id] })) }))

const ALL = GROUPS.flatMap((g) => g.tools)

export function ToolsView() {
  const [s, set] = usePersistent("lf-tools", { tool: "mesh", collapsed: false }, (stored) => ({ ...stored, tool: parseHash(location.hash).tool ?? stored.tool }))
  const tool = ALL.find((t) => t.id === s.tool) ?? ALL[0]

  useEffect(() => {
    const apply = () => {
      const id = parseHash(location.hash).tool
      if (id && ALL.some((t) => t.id === id)) set({ tool: id })
    }
    apply()
    addEventListener("hashchange", apply)
    return () => removeEventListener("hashchange", apply)
  }, [set])

  useEffect(() => {
    writeHash("tools", tool.id)
  }, [tool.id])

  const View = tool.view
  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      <nav
        className={cn(
          "flex shrink-0 gap-1 overflow-x-auto border-b bg-background p-2 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:border-r md:border-b-0",
          s.collapsed ? "md:w-14" : "md:w-52",
        )}
      >
        <button
          onClick={() => set({ collapsed: !s.collapsed })}
          className="hidden h-8 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground md:flex"
          aria-label={s.collapsed ? "Expand panel" : "Collapse panel"}
        >
          {s.collapsed ? <PanelLeftOpenIcon className="size-4" /> : <PanelLeftCloseIcon className="size-4" />}
          {!s.collapsed && "Collapse"}
        </button>
        {GROUPS.map((g) => (
          <div key={g.title} className="flex shrink-0 gap-1 md:flex-col">
            {!s.collapsed && <p className="hidden px-2 pt-3 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase md:block">{g.title}</p>}
            {s.collapsed && <span className="mx-2 my-1.5 hidden h-px bg-border md:block" />}
            {g.tools.map((t) => {
              const btn = (
                <button
                  key={t.id}
                  onClick={() => set({ tool: t.id })}
                  className={cn(
                    "flex h-8 shrink-0 items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    t.id === tool.id && "bg-secondary font-medium text-foreground",
                    s.collapsed && "md:justify-center md:px-0",
                  )}
                >
                  <t.icon className="size-4 shrink-0" />
                  <span className={cn("truncate", s.collapsed && "md:hidden")}>{t.label}</span>
                </button>
              )
              return s.collapsed ? (
                <Tooltip key={t.id}>
                  <TooltipTrigger render={btn} />
                  <TooltipContent side="right">{t.label}</TooltipContent>
                </Tooltip>
              ) : (
                btn
              )
            })}
          </div>
        ))}
      </nav>
      <div className="min-h-0 min-w-0 flex-1">
        <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>}>
          <View key={tool.id} />
        </Suspense>
      </div>
    </div>
  )
}
