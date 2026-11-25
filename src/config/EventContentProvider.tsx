import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { getEventDisplay, loadEventConfig, type EventConfig, type EventDisplay } from './eventConfig'

interface EventContent {
  config: EventConfig
  display: EventDisplay
}

const EventContentContext = createContext<EventContent | null>(null)

function setMetadata(selector: string, attribute: string, value: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.append(element)
  }
  element.setAttribute(attribute, value)
}

export function EventContentProvider({ children }: PropsWithChildren) {
  const [content, setContent] = useState<EventContent | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void loadEventConfig(controller.signal).then(config => {
      if (!controller.signal.aborted) setContent({ config, display: getEventDisplay(config) })
    }).catch(loadError => {
      if (!controller.signal.aborted) {
        setError(loadError instanceof Error ? loadError.message : 'Could not read the event information.')
      }
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!content) return
    const { config } = content
    document.title = config.title
    setMetadata('meta[name="description"]', 'content', config.introduction)
    setMetadata('meta[property="og:title"]', 'content', config.title)
    setMetadata('meta[property="og:description"]', 'content', config.introduction)
    if (config.siteUrl) {
      let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
      if (!canonical) {
        canonical = document.createElement('link')
        canonical.rel = 'canonical'
        document.head.append(canonical)
      }
      canonical.href = config.siteUrl
      setMetadata('meta[property="og:url"]', 'content', config.siteUrl)
    }
    if (config.socialImageUrl) setMetadata('meta[property="og:image"]', 'content', config.socialImageUrl)
  }, [content])

  if (error) {
    return (
      <main className="content-loading">
        <div>
          <h1>Check the event information</h1>
          <p>{error}</p>
          <p>Open public/event-content/event.json, correct the entry, then refresh this page.</p>
        </div>
      </main>
    )
  }

  if (!content) {
    return <main className="content-loading" role="status">Loading event information…</main>
  }

  return <EventContentContext.Provider value={content}>{children}</EventContentContext.Provider>
}

export function useEventContent(): EventContent {
  const content = useContext(EventContentContext)
  if (!content) throw new Error('Event content must be used inside EventContentProvider.')
  return content
}
