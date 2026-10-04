import type { Plugin } from "vite"

const origin = "https://vumox.github.io/layout-forge/"
const pages = [
  {
    slug: "mesh-gradient", route: "tools/mesh", name: "Mesh Gradient Generator",
    description: "Create free mesh gradients with draggable color points, animation and noise. Copy CSS or download a PNG with Layout Forge’s open source mesh gradient generator.",
    text: "Build a soft multicolor background for a landing page, presentation or social image. Move color points, adjust their size and softness, choose a preset, and add animation or grain. The preview updates while you work.",
    steps: ["Choose a preset or set your own colors.", "Drag the color points and adjust softness, motion and noise.", "Copy the CSS or HTML, download a 1920×1080 PNG, or share your settings with Copy link."],
    example: ".mesh { background: radial-gradient(70% 70% at 25% 30%, #22d3ee, transparent), radial-gradient(60% 60% at 75% 70%, #a78bfa, transparent), #0b1026; }",
  },
  {
    slug: "clip-path", route: "tools/clip", name: "CSS Clip-path Generator",
    description: "Make CSS clip-path shapes visually: polygons, circles, ellipses and insets. Drag points and copy CSS, Tailwind or SVG with this free open source editor.",
    text: "Create custom cutouts for cards, hero sections and images. Start from a polygon preset or choose circle, ellipse or inset. Move points, add vertices, rotate or flip the shape, then copy the result into your project.",
    steps: ["Choose a shape or polygon template.", "Drag handles to edit the shape; use keyboard shortcuts for precise adjustments.", "Copy CSS, a Tailwind class or an SVG clipPath. Copy link lets a colleague continue from your settings."],
    example: ".shape { clip-path: polygon(50% 0%, 100% 100%, 0% 100%); }",
  },
  {
    slug: "glassmorphism", route: "tools/glass", name: "Glassmorphism CSS Generator",
    description: "Design frosted glass cards with live blur, transparency, border and shadow controls. Copy ready-to-use CSS from Layout Forge’s free glassmorphism generator.",
    text: "Preview a frosted glass panel over a colorful background. Balance transparency, backdrop blur, border and shadow to suit a navigation bar, card or overlay. Check text readability against the intended background before using the effect.",
    steps: ["Choose a background and glass preset.", "Adjust blur, tint, opacity, radius, border and shadow.", "Copy the generated CSS or share the exact settings. Uploaded backgrounds must be supplied separately."],
    example: ".glass { background: rgb(255 255 255 / 15%); backdrop-filter: blur(16px); border: 1px solid rgb(255 255 255 / 25%); border-radius: 24px; }",
  },
  {
    slug: "css-grid", route: "grid", name: "CSS Grid Generator",
    description: "Build CSS Grid layouts visually with rows, columns, gaps, nested containers and responsive overrides. Export HTML, CSS or JSX with this free open source grid editor.",
    text: "Arrange a page layout without guessing track sizes. Edit columns and rows, position items, create nested containers and configure responsive overrides. Inspect the generated code as you build, then move the result into your project.",
    steps: ["Set the column and row tracks and spacing.", "Place and resize items, add nested containers and adjust breakpoints.", "Export HTML, CSS or JSX and use Copy link to share an editable layout."],
    example: ".grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }",
  },
]

const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")

export function seoPages(): Plugin {
  return {
    name: "layout-forge-seo",
    generateBundle() {
      for (const page of pages) {
        const url = `${origin}tools/${page.slug}/`
        const schema = { "@context": "https://schema.org", "@type": "WebApplication", name: page.name, description: page.description, url, applicationCategory: "DesignApplication", operatingSystem: "Any", browserRequirements: "Requires a modern web browser", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, license: "https://opensource.org/license/mit" }
        const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${page.name} — Layout Forge</title><meta name="description" content="${escape(page.description)}"><link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:title" content="${page.name} — Layout Forge"><meta property="og:description" content="${escape(page.description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${origin}social-preview.png"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="../../favicon.svg"><script type="application/ld+json">${JSON.stringify(schema)}</script>
<style>:root{color-scheme:light dark;font-family:system-ui,sans-serif;background:light-dark(#fafafa,#18181b);color:light-dark(#18181b,#fafafa)}body{max-width:850px;margin:auto;padding:32px 24px;line-height:1.7}nav,footer{display:flex;flex-wrap:wrap;gap:20px}a{color:light-dark(#6030c4,#c4b5fd)}h1{font-size:clamp(2.2rem,6vw,3.8rem);line-height:1.1;letter-spacing:-.04em;margin:48px 0 24px}h2{margin-top:40px}p{max-width:70ch}.cta{display:inline-block;padding:12px 24px;border-radius:10px;background:#6d4aff;color:white;text-decoration:none;font-weight:600;margin:16px 0}img{width:100%;height:auto;border-radius:14px;border:1px solid #8884}pre{padding:20px;border-radius:12px;background:#8881;white-space:pre-wrap;overflow-wrap:anywhere}footer{margin-top:48px;border-top:1px solid #8884;padding-top:24px}</style></head>
<body><nav><a href="../../">Layout Forge</a><a href="https://github.com/vumox/layout-forge">Source on GitHub</a></nav><main><h1>${page.name}</h1><p>${page.description}</p><a class="cta" href="../../#${page.route}">Open ${page.name}</a><p>${page.text}</p><img src="../../social-preview.png" width="1200" height="630" alt="Layout Forge visual design tools" loading="lazy"><h2>How to use it</h2><ol>${page.steps.map((step) => `<li>${step}</li>`).join("")}</ol><h2>CSS example</h2><pre><code>${escape(page.example)}</code></pre><h2>Free, open source and local</h2><p>No account is required. Your settings stay in your browser. Install the app to work offline after the initial download; remote media needs an internet connection. Shared links contain settings in the URL, so anyone with the link can open them.</p><h2>More visual tools</h2><ul>${pages.filter((p) => p.slug !== page.slug).map((p) => `<li><a href="../${p.slug}/">${p.name}</a></li>`).join("")}</ul></main><footer><a href="../../">All 36 tools</a><a href="https://github.com/vumox/layout-forge/discussions">Community</a></footer></body></html>`
        this.emitFile({ type: "asset", fileName: `tools/${page.slug}/index.html`, source: html })
      }
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[origin, ...pages.map((p) => `${origin}tools/${p.slug}/`)].map((url) => `<url><loc>${url}</loc></url>`).join("")}</urlset>` })
      this.emitFile({ type: "asset", fileName: "robots.txt", source: `User-agent: *\nAllow: /\nSitemap: ${origin}sitemap.xml\n` })
    },
  }
}
