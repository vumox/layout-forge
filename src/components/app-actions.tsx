import { useEffect, useRef, useState } from "react"
import { DownloadIcon, LinkIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"
import { TOOL_GROUPS } from "@/lib/tool-catalog"
import { IconButton } from "@/components/fields"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { createShareLink } from "@/lib/share"
import { navigateTo } from "@/lib/route"

const COMMANDS = [
  { id: "grid", label: "CSS Grid", group: "Layout", route: "#grid" },
  { id: "flex", label: "Flexbox", group: "Layout", route: "#flex" },
  { id: "palette", label: "Color palette", group: "Layout", route: "#palette" },
  ...TOOL_GROUPS.flatMap((g) => g.tools.map((t) => ({ id: t.id, label: t.label, group: g.title, route: `#tools/${t.id}` }))),
]

interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function AppActions() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [manualLink, setManualLink] = useState("")
  const [install, setInstall] = useState<InstallPrompt | null>(null)
  const [installHelp, setInstallHelp] = useState(false)
  const [standalone, setStandalone] = useState(() => matchMedia("(display-mode: standalone)").matches)
  const results = COMMANDS.filter((c) => `${c.label} ${c.id} ${c.group}`.toLowerCase().includes(query.toLowerCase().trim()))
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        event.stopPropagation()
        setOpen((v) => !v)
        setQuery("")
        setActive(0)
      }
    }
    const onInstall = (event: Event) => {
      event.preventDefault()
      setInstall(event as InstallPrompt)
    }
    const onInstalled = () => { setInstall(null); setStandalone(true) }
    addEventListener("keydown", onKey, true)
    addEventListener("beforeinstallprompt", onInstall)
    addEventListener("appinstalled", onInstalled)
    return () => {
      removeEventListener("keydown", onKey, true)
      removeEventListener("beforeinstallprompt", onInstall)
      removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  const choose = (route: string) => {
    navigateTo(route)
    setOpen(false)
  }

  const copy = async () => {
    try {
      const link = createShareLink()
      try {
        await navigator.clipboard.writeText(link)
        toast.success("Link copied — current settings included. Uploaded files are not included.")
      } catch {
        setManualLink(link)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create a link")
    }
  }

  return <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
    <IconButton label="Search tools (Ctrl+K)" onClick={() => { setOpen(true); setQuery(""); setActive(0) }}><SearchIcon /></IconButton>
    <Button variant="ghost" size="sm" onClick={copy} aria-label="Copy link"><LinkIcon /><span className="hidden lg:inline">Copy link</span></Button>
    {!standalone && <IconButton label="Install app" onClick={async () => {
      if (!install) { setInstallHelp(true); return }
      await install.prompt()
      await install.userChoice
      setInstall(null)
    }}><DownloadIcon /></IconButton>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg" onKeyDown={(event) => {
        if (["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
          event.preventDefault()
          event.stopPropagation()
          if (event.key === "Enter" && results[active]) choose(results[active].route)
          if (event.key === "ArrowDown") setActive((v) => Math.min(results.length - 1, v + 1))
          if (event.key === "ArrowUp") setActive((v) => Math.max(0, v - 1))
        }
      }}>
        <DialogTitle>Search tools</DialogTitle>
        <DialogDescription>Find any of {COMMANDS.length} tools. Use ↑ ↓ and Enter to open, Esc to close.</DialogDescription>
        <Input autoFocus placeholder="Search by tool or category…" role="combobox" aria-label="Search tools" aria-expanded={true} aria-controls="tool-results" aria-autocomplete="list" aria-activedescendant={results[active] ? `command-${results[active].id}` : undefined} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0) }} />
        <div id="tool-results" role="listbox" aria-label="Tools" ref={list} className="max-h-80 overflow-y-auto">
          {results.map((c, i) => <button type="button" key={c.id} id={`command-${c.id}`} role="option" aria-selected={i === active} data-index={i} onMouseMove={() => setActive(i)} onClick={() => choose(c.route)} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left ${i === active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            <span>{c.label}</span><span className="text-xs text-muted-foreground">{c.group}</span>
          </button>)}
          {!results.length && <p className="p-4 text-muted-foreground" role="status">No tools found.</p>}
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={!!manualLink} onOpenChange={(v) => !v && setManualLink("")}>
      <DialogContent><DialogTitle>Copy your link</DialogTitle><DialogDescription>Copy this link manually. It includes settings, but uploaded images and videos must be supplied separately.</DialogDescription><Input aria-label="Share link" readOnly value={manualLink} onFocus={(e) => e.target.select()} autoFocus /></DialogContent>
    </Dialog>
    <Dialog open={installHelp} onOpenChange={setInstallHelp}>
      <DialogContent><DialogTitle>Install Layout Forge</DialogTitle><DialogDescription>Use your browser’s menu and choose “Install app” or “Add to Home Screen”. On iPhone or iPad, open in Safari and use Share → Add to Home Screen. After the first complete online load, the tools are available offline. Remote images and videos still require a connection.</DialogDescription></DialogContent>
    </Dialog>
  </div>
}
