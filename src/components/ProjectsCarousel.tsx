import { useLayoutEffect, useRef, useState } from 'react'

type Project = {
  number: string
  title: string
  description: string
  meta: string
  tone: string
  image: string | null
  imageAlt: string
}

const projects: Project[] = [
  { number: '01', title: 'Рубленый дом', description: 'Тихий семейный дом.', meta: '2025', tone: 'forest', image: '/projects/rublenyi-dom.webp', imageAlt: 'Рубленый дом из бревна с высокими окнами' },
  { number: '02', title: 'Дом из бруса', description: 'Пространство для больших встреч и длинных выходных.', meta: '2026', tone: 'amber', image: '/projects/dom-iz-brusa.webp', imageAlt: 'Дом из бруса с террасой у леса' },
  { number: '03', title: 'Баня', description: 'Небольшая баня с тёплой парной.', meta: '2026', tone: 'night', image: '/projects/bani.webp', imageAlt: 'Баня из бревна с террасой в сосновом лесу' },
]

const DRAG_THRESHOLD = 6
const SNAP_DELAY = 160
const INERTIA_STOP = 0.02
const LERP = 0.14
const INERTIA_FRICTION = 0.06

export default function ProjectsCarousel() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLElement | null)[]>([])
  const positionRef = useRef(0)
  const targetRef = useRef(0)
  const velocityRef = useRef(0)
  const minPositionRef = useRef(0)
  const maxPositionRef = useRef(0)
  const stepRef = useRef(0)
  const activeIndexRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastFrameRef = useRef(0)
  const pointerRef = useRef({ active: false, dragging: false, id: -1, startX: 0, startY: 0, lastX: 0, lastTime: 0 })
  const snapTimerRef = useRef<number | null>(null)
  const reducedMotionRef = useRef(false)
  const paddingLeftRef = useRef(0)
  const cardCentersRef = useRef<number[]>([])
  const visibleRef = useRef(true)
  const [activeIndex, setActiveIndex] = useState(0)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return

    const cards = cardRefs.current.filter((card): card is HTMLElement => card !== null)
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionRef.current = motion.matches

    const clamp = (value: number) => Math.min(minPositionRef.current, Math.max(maxPositionRef.current, value))
    const nearestIndex = () => {
      const step = stepRef.current
      if (!step) return 0
      return Math.min(projects.length - 1, Math.max(0, Math.round((minPositionRef.current - positionRef.current) / step)))
    }
    const updateActiveIndex = (index: number) => {
      if (index === activeIndexRef.current) return
      activeIndexRef.current = index
      setActiveIndex(index)
    }
    const render = () => {
      const viewportCenter = viewport.clientWidth / 2
      const step = stepRef.current || 1
      track.style.transform = `translate3d(${positionRef.current}px, 0, 0)`
      cards.forEach((card, index) => {
        // Card offsets are measured from the track, but the track itself starts at
        // the viewport's content box — so the left padding must be added to know
        // where the card actually sits inside the viewport (same term recalculate()
        // subtracts when centring). The per-card centre inside the track is cached at
        // layout time rather than read here: offsetLeft forces a reflow and this loop
        // runs on every animation frame.
        const center = paddingLeftRef.current + positionRef.current + (cardCentersRef.current[index] ?? 0)
        const distance = Math.abs(center - viewportCenter) / step
        const intensity = Math.max(0, 1 - Math.min(distance, 1))
        card.style.setProperty('--project-scale', (0.9 + intensity * 0.1).toFixed(3))
        card.style.setProperty('--project-opacity', (0.45 + intensity * 0.55).toFixed(3))
        card.style.setProperty('--project-blur', `${((1 - intensity) * 2.5).toFixed(2)}px`)
      })
      updateActiveIndex(nearestIndex())
    }
    const frame = (time: number) => {
      const previous = lastFrameRef.current || time
      const delta = Math.min(48, Math.max(8, time - previous))
      lastFrameRef.current = time
      const pointer = pointerRef.current

      if (pointer.dragging) {
        positionRef.current = targetRef.current
      } else if (Math.abs(velocityRef.current) > INERTIA_STOP && !reducedMotionRef.current) {
        positionRef.current = clamp(positionRef.current + velocityRef.current * delta)
        if (positionRef.current === minPositionRef.current || positionRef.current === maxPositionRef.current) velocityRef.current = 0
        velocityRef.current *= Math.pow(INERTIA_FRICTION, delta / 1000)
        if (Math.abs(velocityRef.current) <= INERTIA_STOP) targetRef.current = clamp(minPositionRef.current - nearestIndex() * stepRef.current)
      } else {
        positionRef.current += (targetRef.current - positionRef.current) * (reducedMotionRef.current ? 1 : Math.min(1, delta * LERP / 16))
        if (Math.abs(targetRef.current - positionRef.current) < 0.1) positionRef.current = targetRef.current
      }

      render()
      // Parking the loop while the carousel is off-screen keeps a permanent
      // per-frame style write off the main thread on the way down the page.
      rafRef.current = visibleRef.current ? requestAnimationFrame(frame) : null
    }
    const startFrame = () => {
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(frame)
    }
    const recalculate = () => {
      const first = cards[0]
      const second = cards[1]
      if (!first || !second) return
      const oldIndex = activeIndexRef.current
      const step = second.offsetLeft - first.offsetLeft
      // The track (with will-change: transform) is the offsetParent of the cards,
      // so offsetLeft is measured from the track, not the viewport. The viewport's
      // horizontal padding is what displaces the first card from the centre.
      const paddingLeft = parseFloat(getComputedStyle(viewport).paddingLeft) || 0
      paddingLeftRef.current = paddingLeft
      cardCentersRef.current = cards.map((card) => card.offsetLeft + card.offsetWidth / 2)
      const centeredPosition = viewport.clientWidth / 2 - paddingLeft - first.offsetLeft - first.offsetWidth / 2
      stepRef.current = step
      minPositionRef.current = centeredPosition
      maxPositionRef.current = centeredPosition - step * (projects.length - 1)
      const next = clamp(centeredPosition - oldIndex * step)
      positionRef.current = next
      targetRef.current = next
      render()
      startFrame()
    }
    const snapTo = (index: number) => {
      const nextIndex = Math.min(projects.length - 1, Math.max(0, index))
      velocityRef.current = 0
      targetRef.current = clamp(minPositionRef.current - nextIndex * stepRef.current)
      if (reducedMotionRef.current) positionRef.current = targetRef.current
      startFrame()
    }
    const clearSnapTimer = () => {
      if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current)
      snapTimerRef.current = null
    }
    const scheduleSnap = () => {
      clearSnapTimer()
      snapTimerRef.current = window.setTimeout(() => snapTo(nearestIndex()), SNAP_DELAY)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      clearSnapTimer()
      pointerRef.current = {
        active: true,
        dragging: false,
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastTime: performance.now(),
      }
      velocityRef.current = 0
    }
    const onPointerMove = (event: PointerEvent) => {
      const pointer = pointerRef.current
      if (!pointer.active || pointer.id !== event.pointerId) return
      const dx = event.clientX - pointer.startX
      const dy = event.clientY - pointer.startY
      if (!pointer.dragging) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_THRESHOLD) return
        if (Math.abs(dy) > Math.abs(dx)) {
          pointer.active = false
          return
        }
        pointer.dragging = true
        viewport.setPointerCapture(event.pointerId)
        viewport.classList.add('is-dragging')
      }
      event.preventDefault()
      const now = performance.now()
      const elapsed = Math.max(8, now - pointer.lastTime)
      const delta = event.clientX - pointer.lastX
      targetRef.current = clamp(targetRef.current + delta)
      positionRef.current = targetRef.current
      velocityRef.current = delta / elapsed
      pointer.lastX = event.clientX
      pointer.lastTime = now
      startFrame()
    }
    const onPointerUp = (event: PointerEvent) => {
      const pointer = pointerRef.current
      if (!pointer.active || pointer.id !== event.pointerId) return
      pointer.active = false
      if (!pointer.dragging) return
      pointer.dragging = false
      viewport.classList.remove('is-dragging')
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
      if (reducedMotionRef.current) snapTo(nearestIndex())
      else startFrame()
      scheduleSnap()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      snapTo(activeIndexRef.current + (event.key === 'ArrowRight' ? 1 : -1))
    }
    const onMotionChange = () => {
      reducedMotionRef.current = motion.matches
      if (motion.matches) {
        velocityRef.current = 0
        targetRef.current = clamp(minPositionRef.current - activeIndexRef.current * stepRef.current)
        positionRef.current = targetRef.current
        render()
      }
    }
    // The frame loop rewrites card styles continuously, so idle it whenever the
    // carousel is out of view and wake it again on the way back.
    const visibility = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = Boolean(entry?.isIntersecting)
        if (visibleRef.current) startFrame()
      },
      { rootMargin: '40% 0px' },
    )
    visibility.observe(viewport)
    const resizeObserver = new ResizeObserver(recalculate)
    resizeObserver.observe(viewport)
    window.addEventListener('resize', recalculate)
    viewport.addEventListener('pointerdown', onPointerDown)
    viewport.addEventListener('pointermove', onPointerMove)
    viewport.addEventListener('pointerup', onPointerUp)
    viewport.addEventListener('pointercancel', onPointerUp)
    viewport.addEventListener('keydown', onKeyDown)
    motion.addEventListener('change', onMotionChange)
    recalculate()
    rafRef.current = requestAnimationFrame(frame)

    return () => {
      clearSnapTimer()
      visibility.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener('resize', recalculate)
      viewport.removeEventListener('pointerdown', onPointerDown)
      viewport.removeEventListener('pointermove', onPointerMove)
      viewport.removeEventListener('pointerup', onPointerUp)
      viewport.removeEventListener('pointercancel', onPointerUp)
      viewport.removeEventListener('keydown', onKeyDown)
      motion.removeEventListener('change', onMotionChange)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      viewport.classList.remove('is-dragging')
    }
  }, [])

  const goTo = (direction: -1 | 1) => {
    const nextIndex = Math.min(projects.length - 1, Math.max(0, activeIndexRef.current + direction))
    const step = stepRef.current
    targetRef.current = Math.min(minPositionRef.current, Math.max(maxPositionRef.current, minPositionRef.current - nextIndex * step))
    velocityRef.current = 0
    if (reducedMotionRef.current) positionRef.current = targetRef.current
  }

  return (
    <section className="projects section" id="projects" aria-labelledby="projects-title">
      <div className="projects__heading" data-reveal>
        <div className="section-intro" data-reveal-heading>
          <span className="eyebrow" data-reveal-item>Портфолио</span>
          <h2 id="projects-title"><span data-reveal-line><span className="heading-line__inner">Дома, в которых</span></span><span data-reveal-line><span className="heading-line__inner"><em>живут</em></span></span></h2>
        </div>
        <p data-reveal-item>Несколько историй о домах, которые мы построили вместе с их владельцами.</p>
      </div>

      <div className="projects__carousel">
        <button className="projects__arrow projects__arrow--prev" type="button" onClick={() => goTo(-1)} aria-label="Предыдущий проект">←</button>
        <div
          ref={viewportRef}
          className="projects__viewport"
          role="region"
          aria-roledescription="карусель"
          aria-label="Проекты Рублино"
          tabIndex={0}
        >
          <div ref={trackRef} className="projects__track">
            {projects.map((project, index) => (
              <article
                className={`project-card project-card--${project.tone}`}
                key={project.number}
                ref={(element) => { cardRefs.current[index] = element }}
                aria-label={`${project.number}. ${project.title}`}
              >
                <div className="project-card__texture" aria-hidden="true" />
                <div className="project-card__placeholder" aria-hidden="true">
                  {project.image ? <img src={project.image} alt={project.imageAlt} /> : <span>Проект {project.number}</span>}
                </div>
                <div className="project-card__info">
                  <span>{project.number}</span>
                  <div><h3>{project.title}</h3><p>{project.description}</p><small>{project.meta}</small></div>
                </div>
              </article>
            ))}
          </div>
        </div>
        <button className="projects__arrow projects__arrow--next" type="button" onClick={() => goTo(1)} aria-label="Следующий проект">→</button>
        <ol className="projects__progress" aria-label="Проекты">
          {projects.map((project, index) => <li key={project.number}><span className={index === activeIndex ? 'is-active' : ''} aria-label={`${project.title}, ${index + 1} из ${projects.length}`} /></li>)}
        </ol>
      </div>
      <p className="projects__status" aria-live="polite">Проект {String(activeIndex + 1).padStart(2, '0')} из {projects.length}: {projects[activeIndex].title}</p>
    </section>
  )
}
