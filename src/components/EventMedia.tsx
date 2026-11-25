import { Image } from 'lucide-react'
import type { EventPhoto } from '../config/eventConfig'

export function EventMedia({ photo, eager = false }: { photo: EventPhoto; eager?: boolean }) {
  if (photo.src) {
    return (
      <img
        className="event-media__image"
        src={photo.src}
        alt={photo.alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : 'auto'}
      />
    )
  }

  return (
    <div className="event-media__placeholder">
      <Image aria-hidden="true" strokeWidth={1.45} />
      <span>{photo.label}</span>
    </div>
  )
}
