import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ThemeProvider } from "@/lib/theme"
import "./index.css"
import App from "./App.tsx"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { registerSW } from "virtual:pwa-register"
import { toast } from "sonner"

const updateSW = registerSW({
  onNeedRefresh() {
    toast("An update is ready", { duration: Infinity, action: { label: "Reload", onClick: () => { void updateSW(true) } } })
  },
  onOfflineReady() { toast.success("Layout Forge is ready to use offline") },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider delay={300}>
        <App />
        <Toaster position="bottom-center" />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
)
