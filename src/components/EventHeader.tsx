import { useEffect, useState } from 'react'
import { Image } from 'lucide-react'
import { useEventContent } from '../config/EventContentProvider'

export const navigation = [
  ['home', 'Home'], ['about', 'About'], ['activities', 'Activities'],
  ['location', 'Location'], ['register', 'Register'],
] as const

export function Brand({ href = '#home' }: { href?: string }) {
  const { config } = useEventContent()
  return (
    <a className="event-brand" href={href}>
      <span className="event-brand__mark">
        {config.logoUrl
          ? <img src={config.logoUrl} alt="" width="42" height="42" />
          : <Image aria-hidden="true" strokeWidth={1.65} />}
      </span>
      <span>{config.churchName}</span>
    </a>
  )
}

export default function EventHeader() {
  const { config } = useEventContent()
  const [active, setActive] = useState<string>('home')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const sections = ['home', 'about', 'activities', 'register', 'location']
      .map(id => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section))
      .reverse()
    let frame = 0

    function updateActive() {
      frame = 0
      const line = Math.min(180, window.innerHeight * 0.25)
      const section = sections.find(candidate => candidate.getBoundingClientRect().top <= line)
      setActive(section?.id ?? 'home')
    }

    function onScroll() {
      if (!frame) frame = window.requestAnimationFrame(updateActive)
    }

    updateActive()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      document.getElementById('menu-toggle')?.focus()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open])

  return (
    <header className="event-header">
      <div className="container event-header__row" onClick={event => {
        if (event.target instanceof Element && event.target.closest('a')) setOpen(false)
      }}>
        <Brand />
        <button
          id="menu-toggle"
          className="menu-toggle"
          type="button"
          aria-controls="event-navigation"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen(previous => !previous)}
        >
          <span /><span /><span />
        </button>
        <nav className="event-nav" id="event-navigation" aria-label="Main navigation" data-open={open}>
          {navigation.map(([id, label]) => (
            <a key={id} href={`#${id}`} aria-current={active === id ? 'location' : undefined}>{label}</a>
          ))}
          <a className="button button--primary event-nav__register" href="#register">{config.registrationButton}</a>
        </nav>
      </div>
    </header>
  )
}
