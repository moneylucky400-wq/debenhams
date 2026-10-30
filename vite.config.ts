import path from 'path'
import { readFileSync, writeFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { inspectAttr } from 'kimi-plugin-inspect-react'

type SeoRequest = { url?: string }
type SeoResponse = {
  statusCode: number
  setHeader: (name: string, value: string) => void
  end: (body: string) => void
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = (env.SITE_URL || 'https://debenhamscare.company').replace(/\/+$/, '')
  const robots = `User-agent: *\nAllow: /\n\nUser-agent: Googlebot\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: ChatGPT-User\nAllow: /\n\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}/</loc>\n    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n</urlset>\n`
  const llms = readFileSync(path.resolve('public/llms.txt'), 'utf8').replaceAll('https://debenhamscare.company', siteUrl)

  const seoMiddleware = (req: SeoRequest, res: SeoResponse, next: () => void) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname
    if (!['/robots.txt', '/sitemap.xml', '/llms.txt'].includes(pathname)) return next()
    const contentType = pathname === '/sitemap.xml' ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8'
    const content = pathname === '/robots.txt' ? robots : pathname === '/sitemap.xml' ? sitemap : llms
    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    res.end(content)
  }

  const domainSeo = {
    name: 'domain-aware-seo',
    transformIndexHtml(html: string) {
      const googleMeta = env.GOOGLE_SITE_VERIFICATION
        ? `<meta name="google-site-verification" content="${env.GOOGLE_SITE_VERIFICATION.replace(/["<>]/g, '')}" />`
        : ''
      return html.replaceAll('%SITE_URL%', siteUrl).replace('<!-- %GOOGLE_SITE_VERIFICATION% -->', googleMeta)
    },
    configureServer(server: { middlewares: { use: (middleware: typeof seoMiddleware) => void } }) {
      server.middlewares.use(seoMiddleware)
    },
    configurePreviewServer(server: { middlewares: { use: (middleware: typeof seoMiddleware) => void } }) {
      server.middlewares.use(seoMiddleware)
    },
    closeBundle() {
      writeFileSync(path.resolve('dist/robots.txt'), robots)
      writeFileSync(path.resolve('dist/sitemap.xml'), sitemap)
      writeFileSync(path.resolve('dist/llms.txt'), llms)
    },
  }

  return {
    base: '/',
    plugins: [domainSeo, inspectAttr(), react()],
    server: { port: 3000 },
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
  }
})
