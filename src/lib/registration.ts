export const registrationLimits = {
  name: 120,
  phone: 32,
  email: 254,
  gender: 50,
  fellowship: 120,
  guests: 1000,
} as const

export interface RegistrationInput {
  name: string
  phone: string
  email: string
  gender: string
  fellowship: string
  bringingGuests: boolean
  guests: string
}

interface RegistrationPayload {
  p_full_name: string
  p_phone_number: string
  p_email: string | null
  p_gender: string | null
  p_church_or_fellowship: string | null
  p_additional_guests: number
}

export interface RegistrationConfirmation {
  id: string
  full_name: string
  total_attendees: number
}

export type RegistrationErrors = Partial<Record<Exclude<keyof RegistrationInput, 'bringingGuests'>, string>>

export class RegistrationSubmissionError extends Error {}

export function validateRegistration(input: RegistrationInput): {
  payload: RegistrationPayload
  errors: RegistrationErrors
} {
  const payload: RegistrationPayload = {
    p_full_name: input.name.trim(),
    p_phone_number: input.phone.trim(),
    p_email: input.email.trim() || null,
    p_gender: input.gender.trim() || null,
    p_church_or_fellowship: input.fellowship.trim() || null,
    p_additional_guests: input.bringingGuests ? Number(input.guests) : 0,
  }
  const errors: RegistrationErrors = {}

  if (payload.p_full_name.length < 2 || payload.p_full_name.length > registrationLimits.name) {
    errors.name = 'Enter your full name.'
  }

  const phoneDigits = payload.p_phone_number.replace(/\D/g, '').length
  if (
    !/^\+?[\d ().-]+$/.test(payload.p_phone_number)
    || payload.p_phone_number.length > registrationLimits.phone
    || phoneDigits < 7
    || phoneDigits > 15
  ) {
    errors.phone = 'Enter a valid phone number, such as 0801 234 5678.'
  }

  if (payload.p_email && (
    payload.p_email.length > registrationLimits.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.p_email)
  )) {
    errors.email = 'Enter a valid email address.'
  }

  if (payload.p_gender && payload.p_gender.length > registrationLimits.gender) {
    errors.gender = 'Choose one of the listed options.'
  }

  if (payload.p_church_or_fellowship && payload.p_church_or_fellowship.length > registrationLimits.fellowship) {
    errors.fellowship = `Use ${registrationLimits.fellowship} characters or fewer.`
  }

  if (input.bringingGuests && (
    !Number.isInteger(payload.p_additional_guests)
    || payload.p_additional_guests < 1
    || payload.p_additional_guests > registrationLimits.guests
  )) {
    errors.guests = `Enter a whole number from 1 to ${registrationLimits.guests.toLocaleString('en-NG')}.`
  }

  return { payload, errors }
}

export async function submitRegistration(
  payload: RegistrationPayload,
  requestId: string,
): Promise<RegistrationConfirmation> {
  const { getSupabase } = await import('./supabase')
  const client = getSupabase()
  if (!client) {
    throw new RegistrationSubmissionError('Online registration is currently unavailable. Please contact the organisers for help.')
  }

  const abort = new AbortController()
  const timeout = globalThis.setTimeout(() => abort.abort(), 15000)
  try {
    const { data, error } = await client.rpc('submit_registration', {
      ...payload,
      p_request_id: requestId,
    }).abortSignal(abort.signal)

    if (error?.code === '22023') {
      throw new RegistrationSubmissionError('Some details could not be accepted. Please review your entries and try again.')
    }

    if (
      error || !data || typeof data.id !== 'string' || typeof data.full_name !== 'string'
      || !Number.isInteger(data.total_attendees) || data.total_attendees < 1
    ) {
      throw new RegistrationSubmissionError('We could not confirm your registration. Please try again.')
    }

    return { id: data.id, full_name: data.full_name, total_attendees: data.total_attendees }
  } finally {
    globalThis.clearTimeout(timeout)
  }
}
