'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'

/**
 * The intro clip on the landing page.
 *
 * Handling autoplay video properly means three things that are easy to miss:
 *
 * 1. MUTED, ALWAYS. The source file has an audio track, and iOS Safari refuses
 *    to autoplay any video with audio that is not muted. Without `muted` the
 *    element silently sits on the poster forever and it looks broken rather
 *    than blocked. The DOM property is set directly as well as via the prop,
 *    because the attribute alone is unreliable on iOS.
 *
 * 2. REDUCED MOTION AND DATA SAVER BOTH WIN. Someone who has asked their
 *    operating system for less motion, or who is on a metered connection,
 *    gets the poster and a play button. That is not a fallback, it is the same
 *    content without the motion or the 2MB.
 *
 * 3. A REAL PAUSE BUTTON. WCAG 2.2.2 requires anything that moves for more
 *    than five seconds to be pausable. A looped background video with no
 *    control fails that outright.
 *
 * The poster matters more than usual here: the clip opens on a screen recording
 * of this homepage, so without a poster the first paint would be the page
 * followed immediately by a video of the page. The poster is the hand on the
 * red button, which is the idea, not a picture of the UI.
 */
export default function HeroVideoIntro() {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [canAutoplay, setCanAutoplay] = useState(true)
  const [ready, setReady] = useState(false)
  const { t } = useLanguage()

  useEffect(() => {
    const el = ref.current
    if (!el) return

    el.muted = true
    el.defaultMuted = true

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const conn = (navigator as any)?.connection
    const frugal =
      conn?.saveData === true || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g'

    if (reduceMotion || frugal) {
      setCanAutoplay(false)
      return
    }

    setCanAutoplay(true)
    const attempt = el.play()
    if (attempt && typeof attempt.then === 'function') {
      attempt
        .then(() => setPlaying(true))
        .catch(() => {
          // The browser is entitled to refuse. Show the poster and the play
          // button rather than leaving a frozen first frame with no explanation.
          setCanAutoplay(false)
        })
    }
  }, [])

  const toggle = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (el.paused) {
      el.muted = true
      const p = el.play()
      if (p && typeof p.then === 'function') p.then(() => setPlaying(true)).catch(() => setCanAutoplay(false))
    } else {
      el.pause()
      setPlaying(false)
    }
  }, [])

  return (
    <figure className="relative">
      <div className="relative rounded-3xl overflow-hidden border border-warm-white/10 bg-primary-dark">
        <video
          ref={ref}
          className="w-full aspect-video object-cover"
          autoPlay={canAutoplay}
          muted
          loop
          playsInline
          preload="metadata"
          poster="/video/intro-poster.jpg"
          onCanPlay={() => setReady(true)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          // Describes what the video is, for anyone who cannot see it.
          aria-label={t('intro_video_alt')}
        >
          {/* 720p first for phones, 1080p for everything else. A phone
              downloading the desktop file wastes about 1.4MB. */}
          <source src="/video/intro-mobile.mp4" type="video/mp4" media="(max-width: 768px)" />
          <source src="/video/intro.mp4" type="video/mp4" />
        </video>

        {/* The pause control doubles as the play control. Rendered only once
            the element is actually playable, so there is never a button that
            does nothing. */}
        {ready && (
          <button
            onClick={toggle}
            aria-label={playing ? t('pause_video') : t('play_video')}
            className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-black/50 backdrop-blur text-warm-white hover:bg-black/70 transition flex items-center justify-center"
          >
            {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>
        )}

        {/* A soft edge so the video sits on the page rather than being pasted
            on top of it. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary-dark/40 to-transparent" />
      </div>

      <figcaption className="sr-only">{t('intro_video_caption')}</figcaption>
    </figure>
  )
}
