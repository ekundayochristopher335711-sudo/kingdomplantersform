import { useEffect, useRef, useState, type FormEvent, type HTMLInputTypeAttribute } from 'react'
import {
  CalendarDays, ChevronDown, CircleCheck, Clock3, LoaderCircle, LockKeyhole, MapPin, MessageCircle,
} from 'lucide-react'
import {
  RegistrationSubmissionError, registrationLimits, submitRegistration, validateRegistration,
  type RegistrationConfirmation, type RegistrationErrors, type RegistrationInput,
} from '../lib/registration'
import './registration.css'

interface RegistrationFormProps {
  eventTitle: string
  dateLabel: string
  timeLabel: string
  venue: string
  venueShort?: string
  shareUrl?: string
  introduction: string
  formHeading: string
  registrationButton: string
}

type TextFieldName = 'name' | 'phone' | 'email' | 'fellowship'

interface TextFieldProps {
  name: TextFieldName
  label: string
  value: string
  error?: string
  type?: HTMLInputTypeAttribute
  autoComplete?: string
  placeholder?: string
  required?: boolean
  onChange: (name: TextFieldName, value: string) => void
}

const initialInput: RegistrationInput = {
  name: '', phone: '', email: '', gender: '', fellowship: '', bringingGuests: false, guests: '',
}

function FormLabel({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return (
    <label className="registration-label" htmlFor={`registration-${name}`}>
      {label}{' '}
      {required ? <span className="registration-required" aria-hidden="true">*</span> : <span>(optional)</span>}
    </label>
  )
}

function TextField({ name, label, value, error, type = 'text', autoComplete, placeholder, required, onChange }: TextFieldProps) {
  return (
    <div className={`registration-field${name === 'fellowship' ? ' registration-field--wide' : ''}`}>
      <FormLabel name={name} label={label} required={required} />
      <input
        id={`registration-${name}`}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        maxLength={registrationLimits[name]}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `registration-${name}-error` : undefined}
      />
      {error && <p id={`registration-${name}-error`} className="registration-error">{error}</p>}
    </div>
  )
}

function EventDetails({ dateLabel, timeLabel, venue }: Pick<RegistrationFormProps, 'dateLabel' | 'timeLabel' | 'venue'>) {
  return (
    <ul className="registration-details">
      <li><span><CalendarDays aria-hidden="true" /></span>{dateLabel}</li>
      <li><span><Clock3 aria-hidden="true" /></span>{timeLabel}</li>
      <li><span><MapPin aria-hidden="true" /></span>{venue}</li>
    </ul>
  )
}

export default function RegistrationForm({
  eventTitle, dateLabel, timeLabel, venue, venueShort, shareUrl,
  introduction, formHeading, registrationButton,
}: RegistrationFormProps) {
  const [input, setInput] = useState(initialInput)
  const [errors, setErrors] = useState<RegistrationErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<RegistrationConfirmation | null>(null)
  const inFlight = useRef(false)
  const request = useRef<{ key: string; id: string } | null>(null)
  const confirmationHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (confirmation) confirmationHeading.current?.focus()
  }, [confirmation])

  function changeField(name: Exclude<keyof RegistrationInput, 'bringingGuests'>, value: string) {
    setInput((current) => ({ ...current, [name]: value }))
    setErrors((current) => current[name] ? { ...current, [name]: undefined } : current)
  }

  function chooseAttendance(bringingGuests: boolean) {
    setInput((current) => ({ ...current, bringingGuests }))
    setErrors((current) => current.guests ? { ...current, guests: undefined } : current)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || confirmation) return

    const form = event.currentTarget
    const validation = validateRegistration(input)
    const firstError = Object.keys(validation.errors)[0]
    setSubmitError('')
    setErrors(validation.errors)

    if (firstError) {
      requestAnimationFrame(() => {
        const field = form.elements.namedItem(firstError)
        if (field instanceof HTMLElement) field.focus()
      })
      return
    }

    inFlight.current = true
    setIsSubmitting(true)
    try {
      const key = JSON.stringify(validation.payload)
      if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() }
      const saved = await submitRegistration(validation.payload, request.current.id)
      setConfirmation(saved)
      setInput(initialInput)
      request.current = null
    } catch (error) {
      setSubmitError(error instanceof RegistrationSubmissionError
        ? error.message
        : 'We could not confirm your registration. Please try again.')
    } finally {
      inFlight.current = false
      setIsSubmitting(false)
    }
  }

  const selectedGuests = Number(input.guests)
  const partySize = input.bringingGuests && Number.isInteger(selectedGuests) && selectedGuests >= 1
    && selectedGuests <= registrationLimits.guests ? 1 + selectedGuests : 1
  const eventUrl = confirmation && (shareUrl || new URL(window.location.pathname, window.location.origin).href)
  const shareMessage = `Join me at ${eventTitle} on ${dateLabel} at ${timeLabel}, at ${venue}. Register here: ${eventUrl}`

  return (
    <section id="register" className="registration" aria-labelledby="registration-title">
      <div className="container registration-layout">
        <div className="registration-intro">
          <h2 id="registration-title"><span>Register to</span>{' '}Attend</h2>
          <p>{introduction}</p>
          <EventDetails dateLabel={dateLabel} timeLabel={timeLabel} venue={venueShort ?? venue} />
        </div>

        {confirmation ? (
          <div className="registration-card registration-confirmation">
            <div className="registration-confirmation-icon"><CircleCheck size={30} aria-hidden="true" /></div>
            <h3 ref={confirmationHeading} tabIndex={-1}>You’re registered, {confirmation.full_name}!</h3>
            <p>We’ll see you at {eventTitle}. Your registration is confirmed for <strong>{confirmation.total_attendees} {confirmation.total_attendees === 1 ? 'person' : 'people'}</strong>.</p>
            <EventDetails dateLabel={dateLabel} timeLabel={timeLabel} venue={venue} />
            <a
              className="button button--primary registration-share"
              href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              <MessageCircle size={18} aria-hidden="true" /> Share on WhatsApp
            </a>
          </div>
        ) : (
          <form className="registration-card" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
            <h3>{formHeading}</h3>
            <fieldset disabled={isSubmitting} className="registration-controls" aria-label="Registration details">
              <div className="registration-fields">
                <TextField
                  name="name" label="Full Name" value={input.name} error={errors.name}
                  autoComplete="name" placeholder="Enter your full name" required onChange={changeField}
                />
                <TextField
                  name="phone" label="Phone Number" value={input.phone} error={errors.phone}
                  autoComplete="tel" type="tel" placeholder="Enter your phone number" required onChange={changeField}
                />
                <TextField
                  name="email" label="Email Address" value={input.email} error={errors.email}
                  autoComplete="email" type="email" placeholder="Enter your email address" onChange={changeField}
                />
                <div className="registration-field">
                  <FormLabel name="gender" label="Gender" />
                  <div className="registration-select">
                    <select
                      id="registration-gender"
                      name="gender"
                      value={input.gender}
                      onChange={(event) => changeField('gender', event.target.value)}
                      aria-invalid={Boolean(errors.gender)}
                      aria-describedby={errors.gender ? 'registration-gender-error' : undefined}
                    >
                      <option value="">Select gender</option>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Other</option>
                      <option>Prefer not to say</option>
                    </select>
                    <ChevronDown size={16} aria-hidden="true" />
                  </div>
                  {errors.gender && <p id="registration-gender-error" className="registration-error">{errors.gender}</p>}
                </div>
                <TextField
                  name="fellowship" label="Church / Fellowship" value={input.fellowship} error={errors.fellowship}
                  placeholder="Enter your church or fellowship" onChange={changeField}
                />
              </div>

              <fieldset className="registration-attendance" aria-describedby="registration-party-size">
                <legend>How many people will be attending with you?</legend>
                <div className="registration-options">
                  <label className="registration-option">
                    <input
                      name="attendance" type="radio" value="solo" checked={!input.bringingGuests}
                      onChange={() => chooseAttendance(false)}
                    />
                    Just me
                  </label>
                  <label className="registration-option">
                    <input
                      name="attendance" type="radio" value="guests" checked={input.bringingGuests}
                      onChange={() => chooseAttendance(true)}
                    />
                    I’m bringing additional guests
                  </label>
                </div>
                {input.bringingGuests && (
                  <div className="registration-field registration-guest-count">
                    <FormLabel name="guests" label="How many additional people are you bringing?" required />
                    <input
                      id="registration-guests"
                      name="guests"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max={registrationLimits.guests}
                      step="1"
                      required
                      value={input.guests}
                      onChange={(event) => changeField('guests', event.target.value)}
                      aria-invalid={Boolean(errors.guests)}
                      aria-describedby={errors.guests ? 'registration-guests-error' : undefined}
                    />
                    {errors.guests && <p id="registration-guests-error" className="registration-error">{errors.guests}</p>}
                  </div>
                )}
                <p className="registration-party-size" id="registration-party-size" aria-live="polite">
                  {partySize === 1 && input.bringingGuests
                    ? 'Your registration includes you and any guests you enter above.'
                    : <>Registering for <strong>{partySize} {partySize === 1 ? 'person' : 'people'}</strong>, including you.</>}
                </p>
              </fieldset>

              <p className="registration-privacy">
                <LockKeyhole size={19} aria-hidden="true" /> Your details are only shared with the event organisers for event planning.
              </p>
              {submitError && <p className="registration-submit-error" role="alert">{submitError}</p>}
              <button className="button button--primary registration-submit" type="submit">
                {isSubmitting ? <><LoaderCircle size={18} aria-hidden="true" /> Registering…</> : registrationButton}
              </button>
            </fieldset>
          </form>
        )}
      </div>
    </section>
  )
}
