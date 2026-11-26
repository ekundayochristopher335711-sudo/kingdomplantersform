import { CalendarDays, Clock3, Facebook, Instagram, MapPin, MessageCircle, Navigation, Phone } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import Activities from '../components/Activities'
import Countdown from '../components/Countdown'
import EventHeader, { Brand, navigation } from '../components/EventHeader'
import { EventMedia } from '../components/EventMedia'
import RegistrationForm from '../components/RegistrationForm'
import { useEventContent } from '../config/EventContentProvider'

function EventFacts({ final = false }: { final?: boolean }) {
  const { config, display } = useEventContent()
  return (
    <ul className="event-facts">
      <li><CalendarDays aria-hidden="true" /><time dateTime={config.startsAt}>{final ? display.dateLabel : display.shortDate}</time></li>
      {!final && <li><Clock3 aria-hidden="true" /><time dateTime={config.startsAt}>{display.timeLabel}</time></li>}
      <li><MapPin aria-hidden="true" /><a href="#location">{config.venue}</a></li>
    </ul>
  )
}

function Hero() {
  const { config, display } = useEventContent()
  const reduced = useReducedMotion()
  const [mainPhoto, secondaryPhoto] = config.photos.hero
  return (
    <section id="home" className="hero" aria-labelledby="event-title" tabIndex={-1}>
      <div className="container hero__layout">
        <motion.div
          className="hero__content"
          initial={reduced ? false : { opacity: 0.85, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 id="event-title">
            {config.title === '[EVENT TITLE]' ? <>[EVENT<br />{' '}TITLE]</> : config.title}
          </h1>
          <p className="hero__tagline">{config.tagline}</p>
          <p className="hero__intro">{config.introduction}</p>
          <EventFacts />
          <div className="hero__actions">
            <a className="button button--primary" href="#register">{config.registrationButton}</a>
            <a className="button button--outline" href="#about">{config.exploreButton}</a>
          </div>
        </motion.div>
        <motion.div
          className="hero__art"
          initial={reduced ? false : { opacity: 0.8, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.58, delay: 0.06 }}
        >
          <span className="hero__star four-point" aria-hidden="true" />
          <div className="hero__photo hero__photo--main media-frame"><EventMedia photo={mainPhoto} eager /></div>
          <div className="hero__photo hero__photo--small media-frame"><EventMedia photo={secondaryPhoto} /></div>
          <div className="hero__date" aria-hidden="true"><strong>{display.day}</strong><span>{display.month}</span></div>
          <span className="hero__ring hero__ring--one" aria-hidden="true" />
          <span className="hero__ring hero__ring--two" aria-hidden="true" />
        </motion.div>
      </div>
    </section>
  )
}

function About() {
  const { config } = useEventContent()
  const reduced = useReducedMotion()
  return (
    <section id="about" className="section about" aria-labelledby="about-heading">
      <div className="container about__layout">
        <motion.div
          initial={reduced ? false : { opacity: 0.83, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <p className="section-label">About the event</p>
          <h2 id="about-heading" className="section-heading">{config.aboutHeading}</h2>
          <p className="about__description">{config.aboutSummary.replaceAll('{eventTitle}', config.title).replaceAll('{venue}', config.venue)}</p>
          <p className="about__description">{config.description}</p>
          <p className="about__description">{config.expectations}</p>
        </motion.div>
      </div>
    </section>
  )
}

function Location() {
  const { config, display } = useEventContent()
  return (
    <section id="location" className="section location" aria-labelledby="location-heading">
      <div className="container location__layout">
        <div>
          <h2 id="location-heading" className="section-heading">{config.locationHeading} <span>{config.locality}</span></h2>
          <address className="location__address">
            <div><MapPin aria-hidden="true" /><span><strong>{config.venue}</strong><br />{config.address}</span></div>
            <div><Phone aria-hidden="true" /><a href={`tel:${config.enquiryPhoneInternational}`}>{config.enquiryPhone}</a></div>
          </address>
          <div className="location__actions">
            <a className="button button--primary" href={display.directionsUrl} target="_blank" rel="noopener noreferrer">
              <Navigation aria-hidden="true" size={19} /> Get Directions
            </a>
            <a className="button button--outline" href={display.whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" size={19} /> Chat on WhatsApp
            </a>
          </div>
        </div>
        <div className="location__map">
          {config.mapEmbedUrl ? (
            <iframe src={config.mapEmbedUrl} title={`Map showing ${config.venue}`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          ) : (
            <div className="location__map-placeholder">
              <span><MapPin aria-hidden="true" /></span>
              <p>{config.venue}</p>
              <small>{config.mapPlaceholder}</small>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function FinalInvitation() {
  const { config } = useEventContent()
  return (
    <section className="invitation" aria-labelledby="invitation-title">
      <div className="container invitation__inner">
        <span className="invitation__star four-point" aria-hidden="true" />
        <h2 id="invitation-title" className="section-heading">{config.invitationHeading}</h2>
        <p>{config.invitationDescription}</p>
        <EventFacts final />
        <a className="button button--primary" href="#register">{config.registrationButton}</a>
      </div>
    </section>
  )
}

const socials = { Instagram, Facebook }

function Footer() {
  const { config, display } = useEventContent()
  return (
    <footer className="event-footer">
      <div className="container">
        <div className="event-footer__grid">
          <div><Brand /><p className="event-footer__title">{config.title}</p></div>
          <nav aria-label="Footer navigation">
            <h2>Navigate</h2>
            <ul>{navigation.map(([id, name]) => <li key={id}><a href={`#${id}`}>{name}</a></li>)}</ul>
          </nav>
          <div>
            <h2>Contact</h2>
            <a className="event-footer__phone" href={`tel:${config.enquiryPhoneInternational}`}><Phone aria-hidden="true" size={17} /> {config.enquiryPhone}</a>
            <p>{display.fullAddress}</p>
            <div className="event-footer__social">
              {Object.entries(config.socialLinks).map(([name, url]) => {
                const Icon = socials[name as keyof typeof socials]
                return url
                  ? <a key={name} href={url} aria-label={name} target="_blank" rel="noopener noreferrer"><Icon aria-hidden="true" size={18} /></a>
                  : <span key={name} role="img" aria-label={`${name} profile placeholder`} title={`${name} profile placeholder`}><Icon aria-hidden="true" size={18} /></span>
              })}
            </div>
          </div>
        </div>
        <div className="event-footer__bottom"><p>© {display.year} {config.churchName}.</p><a href="/admin">Organizer sign-in</a></div>
      </div>
    </footer>
  )
}

export default function HomePage() {
  const { config, display } = useEventContent()
  return (
    <>
      <a className="skip-link" href="#home">Skip to content</a>
      <EventHeader />
      <main>
        <Hero />
        <Countdown />
        <About />
        <Activities />
        <RegistrationForm
          eventTitle={config.title}
          dateLabel={display.dateLabel}
          timeLabel={display.timeLabel}
          venue={display.fullAddress}
          venueShort={config.venue}
          shareUrl={config.siteUrl ?? undefined}
          introduction={config.registrationIntroduction}
          formHeading={config.formHeading}
          registrationButton={config.registrationButton}
        />
        <Location />
        <FinalInvitation />
      </main>
      <Footer />
    </>
  )
}
