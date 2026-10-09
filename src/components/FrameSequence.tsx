import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import '../index.css'

const desktopFrames = 289
const mobileFrames = 289

// How the frame series is loaded: a coarse pass first so every scroll position has
// a frame to show, then the remaining frames fill in while the reader scrolls. The
// desktop frames are far larger, so they are spread thinner before the section opens.
const COARSE_CONCURRENCY = 6
const FINE_CONCURRENCY = 4
const COARSE_STRIDE = { desktop: 16, mobile: 8 } as const
// A frame that never settles must not keep the whole section behind the preloader:
// after this long the sequence opens with whatever has arrived and fills in later.
const COARSE_TIMEOUT = 9000

// The mobile sets are downscaled copies of the same render, so they share the
// desktop timeline and the same normalized progress thresholds.
const stageBoundaries = [0, 22 / 289, 68 / 289, 140 / 289, 205 / 289, 1]
const stageLabels = [
  { title: 'Пустой участок', detail: 'Разметка фундамента, экскаватор на площадке' },
  { title: 'Фундамент', detail: 'Заливка бетонного основания' },
  { title: 'Каркас стен', detail: 'Венцы брёвен, стропильная система' },
  { title: 'Кровля и окна', detail: 'Кровля уложена, окна и обшивка' },
  { title: 'Готовый дом', detail: 'Ландшафт, освещение, финальный вид' },
]

type FrameSet = 'desktop' | 'mobile'

function frameSrc(index: number, set: FrameSet) {
  const number = String(index + 1).padStart(4, '0')
  return `/frames/${set}/frame_${number}.webp`
}

function framesIn(set: FrameSet) {
  return set === 'desktop' ? desktopFrames : mobileFrames
}

function stageForProgress(progress: number) {
  for (let index = stageBoundaries.length - 2; index > 0; index -= 1) {
    if (progress >= stageBoundaries[index]) return index
  }
  return 0
}

export default function FrameSequence() {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stage, setStage] = useState(0)
  const [loaded, setLoaded] = useState(0)
  const [ready, setReady] = useState(false)
  const [isReducedMotion, setIsReducedMotion] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const framesRef = useRef<HTMLImageElement[]>([])
  const currentFrameRef = useRef(-1)
  const targetFrameRef = useRef(0)
  const loadTokenRef = useRef(0)
  const paintRafRef = useRef<number | null>(null)
  const paintTimerRef = useRef<number | null>(null)
  // The canvas' CSS box, cached: reading clientWidth on the way down a scroll forces a
  // synchronous layout of the whole page, because the sticky block has just moved.
  const canvasSizeRef = useRef({ width: 0, height: 0 })
  const drawRef = useRef<(index: number) => void>(() => undefined)
  const drumTrackRef = useRef<HTMLDivElement>(null)
  const drumStageRef = useRef(0)
  const stageRef = useRef(0)
  const visibleRef = useRef(true)
  // The section's document offset and height, re-read on resize only: the scroll
  // handler must not touch layout, or every frame of a scroll pays for a reflow.
  const geometryRef = useRef({ top: 0, height: 0 })

  // Phones get the downscaled copy of the same render; desktop gets the full set.
  const frameSet: FrameSet = isMobile ? 'mobile' : 'desktop'

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onResize = () => setIsMobile(media.matches)
    const onMotion = () => setIsReducedMotion(motion.matches)
    onMotion()
    media.addEventListener('change', onResize)
    motion.addEventListener('change', onMotion)
    return () => {
      media.removeEventListener('change', onResize)
      motion.removeEventListener('change', onMotion)
    }
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const token = loadTokenRef.current + 1
    loadTokenRef.current = token
    const set = frameSet
    const total = framesIn(set)
    let timer: number | null = null
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        observer.disconnect()
        const images: HTMLImageElement[] = new Array(total)
        for (let index = 0; index < total; index += 1) {
          const image = new Image()
          image.decoding = 'async'
          images[index] = image
        }
        // Publish the array before the bytes arrive so a scrub can already draw
        // whichever frames are ready.
        framesRef.current = images
        setLoaded(0)
        setReady(false)
        let complete = 0
        let reportedPercent = -1
        let coarseDone = false
        const load = (index: number) =>
          new Promise<void>((resolve) => {
            const image = images[index]
            const settle = () => {
              if (loadTokenRef.current !== token) {
                resolve()
                return
              }
              complete += 1
              // The preloader lives only until the coarse pass lands, so report once
              // per whole percent and stop after that: a state update past this point
              // re-renders the whole section while the reader is scrolling through it.
              if (!coarseDone) {
                const percent = Math.round((complete / total) * 100)
                if (percent !== reportedPercent) {
                  reportedPercent = percent
                  setLoaded(complete)
                }
              }
              resolve()
            }
            image.onload = settle
            image.onerror = settle
            image.src = frameSrc(index, set)
          })
        const run = async (queue: number[], concurrency: number) => {
          let cursor = 0
          const worker = async () => {
            while (cursor < queue.length && loadTokenRef.current === token) {
              const next = queue[cursor]
              cursor += 1
              await load(next)
            }
          }
          await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
        }
        const coarse: number[] = []
        const stride = COARSE_STRIDE[set]
        for (let index = 0; index < total; index += stride) coarse.push(index)
        if (coarse[coarse.length - 1] !== total - 1) coarse.push(total - 1)
        const coarseSet = new Set(coarse)
        const fine: number[] = []
        for (let index = 0; index < total; index += 1) if (!coarseSet.has(index)) fine.push(index)
        // Whatever the network does, the section opens on time: the coarse frames that
        // did arrive are enough to scrub with, and the rest keep filling in behind.
        timer = window.setTimeout(() => {
          if (loadTokenRef.current !== token || coarseDone) return
          coarseDone = true
          setReady(true)
        }, COARSE_TIMEOUT)
        void (async () => {
          await run(coarse, COARSE_CONCURRENCY)
          if (loadTokenRef.current !== token) return
          coarseDone = true
          setReady(true)
          await run(fine, FINE_CONCURRENCY)
        })()
      },
      { rootMargin: '120% 0px' },
    )
    observer.observe(section)
    return () => {
      observer.disconnect()
      if (timer !== null) window.clearTimeout(timer)
      loadTokenRef.current += 1
    }
  }, [frameSet])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return

    const draw = (index: number) => {
      const frames = framesRef.current
      let image = frames[index]
      if (!image || !image.naturalWidth) {
        // Frames stream in coarse-to-fine, so while a scrub outruns the loader show
        // the nearest frame that has arrived instead of freezing on an old one.
        let bestIndex = -1
        let bestDistance = Infinity
        for (let candidate = 0; candidate < frames.length; candidate += 1) {
          const other = frames[candidate]
          if (!other || !other.naturalWidth) continue
          const distance = Math.abs(candidate - index)
          if (distance < bestDistance) {
            bestDistance = distance
            bestIndex = candidate
          }
        }
        if (bestIndex < 0) return
        image = frames[bestIndex]
      }
      const dpr = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2)
      const cached = canvasSizeRef.current
      const width = cached.width || canvas.clientWidth
      const height = cached.height || canvas.clientHeight
      const pixelWidth = Math.round(width * dpr)
      const pixelHeight = Math.round(height * dpr)
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.fillStyle = '#0B1B33'
      context.fillRect(0, 0, width, height)
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
      const drawWidth = image.naturalWidth * scale
      const drawHeight = image.naturalHeight * scale
      context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
      currentFrameRef.current = index
    }
    drawRef.current = draw
    const measureCanvas = () => {
      canvasSizeRef.current = { width: canvas.clientWidth, height: canvas.clientHeight }
    }
    const resize = () => {
      measureCanvas()
      if (ready) draw(targetFrameRef.current)
    }
    measureCanvas()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    window.addEventListener('resize', resize)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [isMobile, ready])

  // The frame the section shows is a pure function of how far it has been scrolled, so
  // it is read straight off the scroll position rather than through ScrollTrigger. That
  // removes a long chain - the scroller proxy, the refresh/restore pass, the gsap ticker
  // that drives scrub - every link of which behaves differently inside an in-app WebView.
  useEffect(() => {
    if (!ready) return
    const section = sectionRef.current
    if (!section) return
    const total = framesIn(frameSet)

    const measure = () => {
      const rect = section.getBoundingClientRect()
      geometryRef.current = { top: rect.top + window.scrollY, height: rect.height }
    }
    const progressNow = () => {
      const { top, height } = geometryRef.current
      const span = height - window.innerHeight
      if (span <= 0) return 0
      return Math.min(1, Math.max(0, (window.scrollY - top) / span))
    }
    const paint = () => {
      if (paintRafRef.current !== null) {
        cancelAnimationFrame(paintRafRef.current)
        paintRafRef.current = null
      }
      if (paintTimerRef.current !== null) {
        window.clearTimeout(paintTimerRef.current)
        paintTimerRef.current = null
      }
      if (visibleRef.current && targetFrameRef.current !== currentFrameRef.current) {
        drawRef.current(targetFrameRef.current)
      }
    }
    // One paint per animation frame, but never *only* on a rAF: inside an in-app WebView
    // (Telegram's is the one that was reported) rAF can be throttled while a finger is
    // down, which left the frame frozen at the stage the reader first touched while the
    // page itself kept scrolling underneath. The timer is the guarantee.
    const schedulePaint = () => {
      if (paintRafRef.current !== null || paintTimerRef.current !== null) return
      paintRafRef.current = requestAnimationFrame(paint)
      paintTimerRef.current = window.setTimeout(paint, 48)
    }
    const apply = (progress: number) => {
      targetFrameRef.current = Math.round(progress * (total - 1))
      // Continuous progress drives only the canvas; the DOM reads the discrete stage,
      // so the section re-renders about five times per pass instead of once per frame.
      const nextStage = stageForProgress(progress)
      if (nextStage !== stageRef.current) {
        stageRef.current = nextStage
        setStage(nextStage)
      }
      schedulePaint()
    }
    const onScroll = () => apply(progressNow())
    const onResize = () => {
      measure()
      apply(progressNow())
    }

    measure()
    if (isReducedMotion) {
      apply(1)
      return
    }
    apply(progressNow())

    const visibility = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = Boolean(entry?.isIntersecting)
        if (visibleRef.current) apply(progressNow())
      },
      { rootMargin: '40% 0px' },
    )
    visibility.observe(section)
    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(section)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    // Late layout shifts (fonts, the carousel's own resize pass) move the section
    // without a resize event, so re-measure once the page has settled.
    const settle = window.setTimeout(onResize, 800)

    return () => {
      visibility.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      window.clearTimeout(settle)
      if (paintRafRef.current !== null) cancelAnimationFrame(paintRafRef.current)
      if (paintTimerRef.current !== null) window.clearTimeout(paintTimerRef.current)
      paintRafRef.current = null
      paintTimerRef.current = null
    }
  }, [frameSet, isReducedMotion, ready])

  useEffect(() => {
    const track = drumTrackRef.current
    if (!track) return
    const offset = -(stage * 100) / stageLabels.length
    const previous = drumStageRef.current
    drumStageRef.current = stage
    // A blur tween (and even an inline blur(0px), which still spawns a filter layer)
    // is one of the costliest things to ask of a phone GPU, so the drum keeps its
    // slide on phones and only the desktop gets the focus pull.
    const focusPull = !window.matchMedia('(max-width: 767px)').matches
    if (previous === stage) {
      gsap.set(track, focusPull ? { yPercent: offset, filter: 'blur(0px)' } : { yPercent: offset })
      return
    }
    gsap.killTweensOf(track)
    gsap.to(track, {
      yPercent: offset,
      duration: 0.55,
      ease: stage === 0 ? 'power3.out' : 'back.out(1.4)',
    })
    if (focusPull) {
      gsap.fromTo(track, { filter: 'blur(3px)' }, { filter: 'blur(0px)', duration: 0.55, ease: 'power2.out' })
    }
  }, [stage])

  const percentage = Math.round((loaded / framesIn(frameSet)) * 100)

  return (
    <section ref={sectionRef} className="sequence" id="stages" aria-label="Этапы строительства дома">
      <div className="sequence__sticky">
        <div className="sequence__logs" aria-hidden="true" />
        <canvas ref={canvasRef} className="sequence__canvas" aria-hidden="true" />
        <div className="sequence__scrim" aria-hidden="true" />
        {!ready && (
          <div className="sequence__preloader">
            <span className="eyebrow">Рублино · строительство</span>
            <p>Загружаем сцену</p>
            <strong>{percentage}%</strong>
            <div className="preloader__line"><span style={{ width: `${percentage}%` }} /></div>
          </div>
        )}
        <div className="sequence__panel">
          <div className={`sequence__copy sequence__copy--stage-${stage}`}>
            <span className="eyebrow">Этап {String(stage + 1).padStart(2, '0')} / 05</span>
            <h2 className="sr-only">{stageLabels[stage].title}</h2>
            <div className="sequence__drum" aria-hidden="true">
              <div className="sequence__drum-track" ref={drumTrackRef}>
                {stageLabels.map((item) => (
                  <span key={item.title} className="sequence__drum-item">{item.title}</span>
                ))}
              </div>
            </div>
            <p>{stageLabels[stage].detail}</p>
          </div>
          <div className="sequence__progress" aria-label="Прогресс строительства">
            {stageLabels.map((item, index) => (
              <span key={item.title} className={index <= stage ? 'is-active' : ''} aria-label={item.title} />
            ))}
          </div>
          <div className="sequence__hint">Листайте, чтобы увидеть весь путь</div>
        </div>
      </div>
    </section>
  )
}
