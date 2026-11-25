import { BookOpen, Gamepad2, MessageCircle, Mic, Sparkles, Trophy, UsersRound, Utensils, type LucideIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEventContent } from '../config/EventContentProvider'
import type { ActivityIcon } from '../config/eventConfig'

const activityIcons: Record<ActivityIcon, LucideIcon> = {
  gamepad: Gamepad2,
  message: MessageCircle,
  people: UsersRound,
  book: BookOpen,
  food: Utensils,
  microphone: Mic,
  trophy: Trophy,
  sparkles: Sparkles,
}

export default function Activities() {
  const { config } = useEventContent()
  const reduced = useReducedMotion()
  return (
    <section className="section activities" id="activities" aria-labelledby="activities-heading">
      <div className="container">
        <h2 id="activities-heading" className="section-heading">{config.activitiesHeading}</h2>
        <p className="section-lead">{config.activitiesIntroduction}</p>
        <ul className="activities__grid">
          {config.activities.map(({ title, description, icon }, index) => {
            const Icon = activityIcons[icon] ?? Sparkles
            return (
            <motion.li
              className="activity-card"
              key={title}
              initial={reduced ? false : { opacity: 0.75, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ delay: reduced ? 0 : (index % 4) * 0.035, duration: 0.32 }}
            >
              <span className="activity-card__icon"><Icon aria-hidden="true" strokeWidth={1.8} /></span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </motion.li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
