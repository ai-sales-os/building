import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { scrollPageTo } from '../lib/scroll'
import '../index.css'

gsap.registerPlugin(ScrollTrigger)

const desktopFrames = 289
const mobileFrames = 289

// The mobile set is a downscaled copy of the same render, so it shares the
// desktop timeline and the same normalized progress thresholds.
const stageBoundaries = [0, 22 / 289, 68 / 289, 140 / 289, 205 / 289, 1]
const stageLabels = [
  { title: 'Пустой участок', detail: 'Разметка фундамента, экскаватор на площадке' },
  { title: 'Фундамент', detail: 'Заливка бетонного основания' },
  { title: 'Каркас стен', detail: 'Венцы брёвен, стропильная система' },
  { title: 'Кровля и окна', detail: 'Кровля уложена, окна и обшивка' },
  { title: 'Готовый дом', detail: 'Ландшафт, освещение, финальный вид' },
]

function frameSrc(index: number, mobile: boolean) {
  const number = String(index + 1).padStart(4, '0')
  return `/frames/${mobile ? 'mobile' : 'desktop'}/frame_${number}.webp`
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
  const [progress, setProgress] = useState(0)
  const [loaded, setLoaded] = useState(0)
  const [ready, setReady] = useState(false)
  const [isReducedMotion, setIsReducedMotion] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const framesRef = useRef<HTMLImageElement[]>([])
  const currentFrameRef = useRef(-1)
  const targetFrameRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const loadTokenRef = useRef(0)
  const drawRef = useRef<(index: number) => void>(() => undefined)
  const drumTrackRef = useRef<HTMLDivElement>(null)
  const drumStageRef = useRef(0)
  const progressRef = useRef(0)
  const snapshotRef = useRef<{ y: number; progress: number } | null>(null)
  const restoreRafRef = useRef<number | null>(null)
  const refreshAtRef = useRef(0)

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
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        observer.disconnect()
        const total = isMobile ? mobileFrames : desktopFrames
        const images: HTMLImageElement[] = []
        let complete = 0
        setLoaded(0)
        setReady(false)
        framesRef.current = []
        for (let index = 0; index < total; index += 1) {
          const image = new Image()
          image.decoding = 'async'
          image.src = frameSrc(index, isMobile)
          image.onload = () => {
            if (loadTokenRef.current !== token) return
            complete += 1
            setLoaded(complete)
            if (complete === total) {
              framesRef.current = images
              setReady(true)
            }
          }
          image.onerror = () => {
            if (loadTokenRef.current !== token) return
            complete += 1
            setLoaded(complete)
          }
          images.push(image)
        }
      },
      { rootMargin: '120% 0px' },
    )
    observer.observe(section)
    return () => {
      observer.disconnect()
      loadTokenRef.current += 1
    }
  }, [isMobile])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return

    const draw = (index: number) => {
      const image = framesRef.current[index]
      if (!image || !image.naturalWidth) return
      const dpr = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2)
      const width = canvas.clientWidth
      const height = canvas.clientHeight
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
    const resize = () => {
      if (ready) draw(targetFrameRef.current)
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    window.addEventListener('resize', resize)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [isMobile, ready])

  useEffect(() => {
    if (!ready) return
    const section = sectionRef.current
    if (!section) return
    const total = isMobile ? mobileFrames : desktopFrames
    // A breakpoint change rebuilds this trigger, so read the frame back from the
    // current scroll position instead of assuming the section starts at frame one.
    const progressAtCurrentScroll = () => {
      const span = section.offsetHeight - window.innerHeight
      if (span <= 0) return 0
      const rect = section.getBoundingClientRect()
      return Math.min(1, Math.max(0, -rect.top / span))
    }
    const initialProgress = isReducedMotion ? 1 : progressAtCurrentScroll()
    progressRef.current = initialProgress
    targetFrameRef.current = Math.round(initialProgress * (total - 1))
    setProgress(initialProgress)
    drawRef.current(targetFrameRef.current)
    if (isReducedMotion) return

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        // Skip the transient position ScrollTrigger applies while it re-measures.
        if (refreshAtRef.current !== 0 && performance.now() - refreshAtRef.current < 250) return
        // Mid-resize the trigger still measures the previous layout, so its progress
        // is meaningless until the next refresh. Ignoring it keeps the last real
        // reading, which is what the restore after the refresh relies on.
        if (Math.abs(progressAtCurrentScroll() - self.progress) > 0.05) return
        const nextProgress = self.progress
        progressRef.current = nextProgress
        setProgress(nextProgress)
        targetFrameRef.current = Math.round(nextProgress * (total - 1))
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null
            if (targetFrameRef.current !== currentFrameRef.current) {
              drawRef.current(targetFrameRef.current)
            }
          })
        }
      },
    })
    return () => {
      trigger.kill()
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [isMobile, isReducedMotion, ready])

  // ScrollTrigger.refresh() parks the page at the top while it re-measures, and
  // every orientation/breakpoint change triggers one. Put the reader back where
  // they were so the sequence keeps playing from the same stage.
  useEffect(() => {
    const onRefreshInit = () => {
      refreshAtRef.current = performance.now()
      // A refresh that already starts from the top must not erase a good snapshot,
      // otherwise a second refresh in the same resize would restore nothing.
      if (window.scrollY > 0) {
        snapshotRef.current = { y: window.scrollY, progress: progressRef.current }
      }
    }
    const onRefresh = () => {
      if (restoreRafRef.current !== null) cancelAnimationFrame(restoreRafRef.current)
      restoreRafRef.current = requestAnimationFrame(() => {
        restoreRafRef.current = null
        const snapshot = snapshotRef.current
        if (!snapshot || snapshot.y <= 0) return
        snapshotRef.current = null
        if (Math.abs(window.scrollY - snapshot.y) <= 2) return
        const section = sectionRef.current
        let target = snapshot.y
        if (section && snapshot.progress > 0.001 && snapshot.progress < 0.999) {
          const span = section.offsetHeight - window.innerHeight
          if (span > 0) {
            const top = section.getBoundingClientRect().top + window.scrollY
            target = top + snapshot.progress * span
          }
        }
        target = Math.max(0, Math.min(target, ScrollTrigger.maxScroll(window)))
        // Release the guard before moving, so the resulting update is not skipped.
        refreshAtRef.current = 0
        scrollPageTo(target)
        ScrollTrigger.update()
      })
    }
    ScrollTrigger.addEventListener('refreshInit', onRefreshInit)
    ScrollTrigger.addEventListener('refresh', onRefresh)
    return () => {
      ScrollTrigger.removeEventListener('refreshInit', onRefreshInit)
      ScrollTrigger.removeEventListener('refresh', onRefresh)
      if (restoreRafRef.current !== null) cancelAnimationFrame(restoreRafRef.current)
    }
  }, [])

  const stage = stageForProgress(progress)

  useEffect(() => {
    const track = drumTrackRef.current
    if (!track) return
    const offset = -(stage * 100) / stageLabels.length
    const previous = drumStageRef.current
    drumStageRef.current = stage
    if (previous === stage) {
      gsap.set(track, { yPercent: offset, filter: 'blur(0px)' })
      return
    }
    gsap.killTweensOf(track)
    gsap.to(track, {
      yPercent: offset,
      duration: 0.55,
      ease: stage === 0 ? 'power3.out' : 'back.out(1.4)',
    })
    gsap.fromTo(track, { filter: 'blur(3px)' }, { filter: 'blur(0px)', duration: 0.55, ease: 'power2.out' })
  }, [stage])

  const percentage = Math.round((loaded / (isMobile ? mobileFrames : desktopFrames)) * 100)

  return (
    <section ref={sectionRef} className="sequence" id="stages" aria-label="Этапы строительства дома">
      <div className="sequence__sticky">
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
    </section>
  )
}
