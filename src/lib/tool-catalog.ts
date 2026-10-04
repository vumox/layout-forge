export const TOOL_GROUPS: { title: string; tools: { id: string; label: string }[] }[] = [
  {
    title: "Backgrounds",
    tools: [
      { id: "mesh", label: "Mesh gradient" },
      { id: "pattern", label: "Patterns" },
      { id: "scatter", label: "Shape backgrounds" },
      { id: "topo", label: "Contours" },
      { id: "burst", label: "Rays and spirals" },
      { id: "aurora", label: "Aurora" },
      { id: "lava", label: "Lava lamp" },
      { id: "image", label: "Photo as background" },
    ],
  },
  {
    title: "Generative",
    tools: [
      { id: "bauhaus", label: "Bauhaus grids" },
      { id: "lowpoly", label: "Low-poly / Voronoi" },
      { id: "flow", label: "Flow field" },
      { id: "dither", label: "Dither and halftone" },
      { id: "ascii", label: "ASCII art" },
      { id: "pixel", label: "Pixel-art" },
      { id: "synth", label: "Synthwave" },
    ],
  },
  {
    title: "Shapes and decor",
    tools: [
      { id: "divider", label: "Dividers" },
      { id: "wave", label: "Waves" },
      { id: "blob", label: "Blob" },
      { id: "clip", label: "clip-path" },
      { id: "line", label: "Lines and squiggles" },
      { id: "arrow", label: "Arrows" },
    ],
  },
  {
    title: "Effects",
    tools: [
      { id: "glass", label: "Glassmorphism" },
      { id: "mask", label: "CSS mask" },
      { id: "fx", label: "CSS effects" },
      { id: "shadow", label: "Shadows" },
    ],
  },
  {
    title: "3D and motion",
    tools: [
      { id: "three", label: "3D scenes" },
      { id: "animation", label: "CSS animations" },
      { id: "particles", label: "Particles" },
      { id: "scroll", label: "Scroll video" },
    ],
  },
  {
    title: "Media and assets",
    tools: [
      { id: "mockup", label: "Mockups" },
      { id: "og", label: "OG images" },
      { id: "favicon", label: "Favicon" },
    ],
  },
  {
    title: "Typography",
    tools: [{ id: "units", label: "Font units" }],
  },
]
