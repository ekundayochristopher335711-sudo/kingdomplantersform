import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const escapeHtml = (value: string) => value.replace(/[&"<>]/g, character => ({
  '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;',
})[character] ?? character)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'event-metadata',
      transformIndexHtml(html) {
        const eventConfig = JSON.parse(
          readFileSync(new URL('./public/event-content/event.json', import.meta.url), 'utf8'),
        ) as {
          title: string
          introduction: string
          siteUrl?: string | null
          socialImageUrl?: string | null
        }
        return html
          .replaceAll('@@EVENT_TITLE@@', () => escapeHtml(eventConfig.title))
          .replaceAll('@@EVENT_DESCRIPTION@@', () => escapeHtml(eventConfig.introduction))
          .replace('<!-- EVENT_SOCIAL_METADATA -->', () => [
            eventConfig.siteUrl && `<link rel="canonical" href="${escapeHtml(eventConfig.siteUrl)}"><meta property="og:url" content="${escapeHtml(eventConfig.siteUrl)}">`,
            eventConfig.socialImageUrl && `<meta property="og:image" content="${escapeHtml(eventConfig.socialImageUrl)}">`,
          ].filter(Boolean).join('\n    '))
      },
    },
  ],
})
