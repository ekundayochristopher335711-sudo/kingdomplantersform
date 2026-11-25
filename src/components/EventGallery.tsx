import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEventContent } from '../config/EventContentProvider'
import { EventMedia } from './EventMedia'

export default function EventGallery() {
  const { config } = useEventContent()
  const photos = config.photos.gallery
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const [selected, setSelected] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const reduced = useReducedMotion()
  const photo = photos[selected]

  function move(direction: number) {
    setSelected(index => (index + direction + photos.length) % photos.length)
  }

  return (
    <section id="gallery" className="section gallery" aria-labelledby="gallery-heading">
      <div className="container">
        <h2 id="gallery-heading" className="section-heading">{config.galleryHeading}</h2>
        <div className="gallery__grid">
          {photos.map((item, index) => (
            <motion.button
              key={item.label}
              className="gallery__tile media-frame"
              type="button"
              aria-label={`View ${item.src ? item.alt || item.label : item.label}`}
              initial={reduced ? false : { opacity: 0.75 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: reduced ? 0 : index * 0.05 }}
              onClick={event => {
                opener.current = event.currentTarget
                setSelected(index)
                setIsOpen(true)
                dialog.current?.showModal()
              }}
            >
              <EventMedia photo={item} />
              <span className="gallery__zoom"><ZoomIn aria-hidden="true" size={20} /></span>
            </motion.button>
          ))}
        </div>
      </div>
      <dialog
        ref={dialog}
        className="gallery-dialog"
        aria-labelledby="gallery-dialog-title"
        onClose={() => {
          setIsOpen(false)
          opener.current?.focus()
        }}
        onClick={event => {
          if (event.target === event.currentTarget) dialog.current?.close()
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            move(event.key === 'ArrowLeft' ? -1 : 1)
          }
        }}
      >
        {isOpen && photo && (
          <div className="gallery-dialog__content">
            <div className="gallery-dialog__top">
              <h3 id="gallery-dialog-title">{config.galleryHeading}</h3>
              <button type="button" className="icon-button" aria-label="Close gallery" autoFocus onClick={() => dialog.current?.close()}><X /></button>
            </div>
            <div className="media-frame gallery-dialog__media"><EventMedia photo={photo} /></div>
            <div className="gallery-dialog__controls">
              <button type="button" className="icon-button" aria-label="Previous photo" onClick={() => move(-1)} disabled={photos.length < 2}><ChevronLeft /></button>
              <p aria-live="polite">{selected + 1} of {photos.length}</p>
              <button type="button" className="icon-button" aria-label="Next photo" onClick={() => move(1)} disabled={photos.length < 2}><ChevronRight /></button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  )
}
