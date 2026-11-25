import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useEventContent } from '../config/EventContentProvider'
const units = ['Days', 'Hours', 'Minutes', 'Seconds']

export default function Countdown() {
  const { config } = useEventContent()
  const [now, setNow] = useState(Date.now)
  const reduced = useReducedMotion()
  const start = Date.parse(config.startsAt)
  const end = Date.parse(config.endsAt)
  const state = now < start ? 'upcoming' : now < end ? 'live' : 'ended'
  const seconds = Math.max(0, Math.ceil((start - now) / 1000))
  const digits = [
    Math.floor(seconds / 86_400), Math.floor(seconds / 3_600) % 24,
    Math.floor(seconds / 60) % 60, seconds % 60,
  ]

  useEffect(() => {
    if (state === 'ended') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [state])

  return (
    <section className="countdown" aria-labelledby="countdown-title">
      <div className="container countdown__layout">
        <h2 id="countdown-title" aria-live="polite">
          {state === 'upcoming' ? 'The countdown is on.' : state === 'live' ? 'The event is underway!' : 'The event has ended.'}
        </h2>
        {state === 'upcoming' ? (
          <div className="countdown__digits" role="timer" aria-live="off" aria-label="Time until the event">
            {units.map((label, index) => (
              <div className="countdown__unit" key={label}>
                <motion.span key={digits[index]} initial={reduced ? false : { opacity: 0.65, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                  {String(digits[index]).padStart(2, '0')}
                </motion.span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        ) : <p>{state === 'live' ? `Join us at ${config.venue}.` : 'Thank you for being part of the gathering.'}</p>}
      </div>
    </section>
  )
}
