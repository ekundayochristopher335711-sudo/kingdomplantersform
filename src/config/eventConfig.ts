export type ActivityIcon = 'gamepad' | 'message' | 'people' | 'book' | 'food' | 'microphone' | 'trophy' | 'sparkles'

export interface EventPhoto {
  src: string | null
  alt: string
  label: string
}

function isPhoto(value: unknown): value is EventPhoto {
  return isRecord(value)
    && (typeof value.src === 'string' || value.src === null)
    && typeof value.alt === 'string'
    && typeof value.label === 'string'
}

export interface EventActivity {
  title: string
  description: string
  icon: ActivityIcon
}

export interface EventConfig {
  churchName: string
  logoUrl: string | null
  title: string
  tagline: string
  introduction: string
  aboutHeading: string
  aboutSummary: string
  description: string
  expectations: string
  activitiesHeading: string
  activitiesIntroduction: string
  activities: EventActivity[]
  galleryHeading: string
  registrationIntroduction: string
  locationHeading: string
  mapPlaceholder: string
  invitationHeading: string
  invitationDescription: string
  formHeading: string
  registrationButton: string
  exploreButton: string
  startsAt: string
  endsAt: string
  timezone: string
  venue: string
  locality: string
  address: string
  enquiryPhone: string
  enquiryPhoneInternational: string
  mapEmbedUrl: string | null
  siteUrl: string | null
  socialImageUrl: string | null
  photos: {
    hero: EventPhoto[]
    about: EventPhoto
    gallery: EventPhoto[]
  }
  socialLinks: Record<string, string | null>
}

export interface EventDisplay {
  dateLabel: string
  shortDate: string
  day: string
  month: string
  year: string
  timeLabel: string
  fullAddress: string
  directionsUrl: string
  whatsappUrl: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function loadEventConfig(signal: AbortSignal): Promise<EventConfig> {
  const response = await fetch('/event-content/event.json', { signal, cache: 'no-cache' })
  if (!response.ok) throw new Error(`Could not load event.json (HTTP ${response.status}).`)

  const data: unknown = await response.json()
  if (!isRecord(data)) throw new Error('event.json must contain one JSON object.')

  const requiredTextFields = [
    'churchName', 'title', 'tagline', 'introduction', 'aboutHeading', 'aboutSummary',
    'description', 'expectations', 'activitiesHeading', 'activitiesIntroduction',
    'galleryHeading', 'registrationIntroduction', 'locationHeading', 'mapPlaceholder',
    'invitationHeading', 'invitationDescription', 'formHeading', 'registrationButton',
    'exploreButton', 'startsAt', 'endsAt', 'timezone', 'venue', 'locality', 'address',
    'enquiryPhone', 'enquiryPhoneInternational',
  ]

  if (requiredTextFields.some(field => typeof data[field] !== 'string' || !data[field].trim())) {
    throw new Error('Fill in each required text field in event.json.')
  }
  if (!Number.isFinite(Date.parse(data.startsAt as string)) || !Number.isFinite(Date.parse(data.endsAt as string))) {
    throw new Error('Use valid date and time values in startsAt and endsAt.')
  }
  if (!Array.isArray(data.activities) || !isRecord(data.photos) || !isRecord(data.socialLinks)) {
    throw new Error('Check the activities, photos, and socialLinks sections in event.json.')
  }
  const photos = data.photos
  const supportedIcons: ActivityIcon[] = [
    'gamepad', 'message', 'people', 'book', 'food', 'microphone', 'trophy', 'sparkles',
  ]
  if (
    !data.activities.every(activity => isRecord(activity)
      && typeof activity.title === 'string'
      && typeof activity.description === 'string'
      && typeof activity.icon === 'string'
      && supportedIcons.includes(activity.icon as ActivityIcon))
    || !Array.isArray(photos.hero)
    || photos.hero.length < 2
    || !photos.hero.every(isPhoto)
    || !isPhoto(photos.about)
    || !Array.isArray(photos.gallery)
    || photos.gallery.length < 1
    || !photos.gallery.every(isPhoto)
    || !Object.values(data.socialLinks).every(value => typeof value === 'string' || value === null)
  ) {
    throw new Error('Check each activity, photo, and social link in event.json.')
  }

  return data as unknown as EventConfig
}

export function getEventDisplay(config: EventConfig): EventDisplay {
  const date = new Date(config.startsAt)
  const options = { timeZone: config.timezone }
  return {
    dateLabel: new Intl.DateTimeFormat('en-GB', {
      ...options, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(date),
    shortDate: new Intl.DateTimeFormat('en-GB', {
      ...options, day: 'numeric', month: 'long', year: 'numeric',
    }).format(date),
    day: new Intl.DateTimeFormat('en-GB', { ...options, day: 'numeric' }).format(date),
    month: new Intl.DateTimeFormat('en-GB', { ...options, month: 'short' }).format(date),
    year: new Intl.DateTimeFormat('en-GB', { ...options, year: 'numeric' }).format(date),
    timeLabel: `${new Intl.DateTimeFormat('en-US', {
      ...options, hour: 'numeric', minute: '2-digit',
    }).format(date)} ${config.timezone === 'Africa/Lagos' ? 'WAT' : config.timezone}`,
    fullAddress: `${config.venue}, ${config.address}`,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${config.venue}, ${config.address}`)}`,
    whatsappUrl: `https://wa.me/${config.enquiryPhoneInternational.replace(/\D/g, '')}`,
  }
}
