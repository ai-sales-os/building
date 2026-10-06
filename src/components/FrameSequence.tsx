import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { scrollPageTo } from '../lib/scroll'
import '../index.css'

gsap.registerPlugin(ScrollTrigger)

const desktopFrames = 289
const mobileFrames = 289

// How the frame series is loaded: a coarse pass first so every scroll position has
// a frame to show, then the remaining frames fill in while the reader scrolls. The
// desktop frames are far larger, so they are spread thinner before the section opens.
const COARSE_CONCURRENCY = 6
const FINE_CONCURRENCY = 6
const COARSE_STRIDE = { desktop: 16, mobile: 8 } as const

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
  const rafRef = useRef<number | null>(null)
  const loadTokenRef = useRef(0)
  const drawRef = useRef<(index: number) => void>(() => undefined)
  const drumTrackRef = useRef<HTMLDivElement>(null)
  const drumStageRef = useRef(0)
  const progressRef = useRef(0)
  const stageRef = useRef(0)
  const snapshotRef = useRef<{ y: number; progress: number } | null>(null)
  const restoreRafRef = useRef<number | null>(null)
  const refreshAtRef = useRef(0)

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
    const total = framesIn(frameSet)
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
    const initialStage = stageForProgress(initialProgress)
    stageRef.current = initialStage
    setStage(initialStage)
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
        targetFrameRef.current = Math.round(nextProgress * (total - 1))
        // Continuous progress drives only the canvas; the DOM reads the discrete
        // stage. Keeping progress in a ref keeps the section to roughly five renders
        // per pass instead of one per scroll frame - the bulk of the mobile cost.
        const nextStage = stageForProgress(nextProgress)
        if (nextStage !== stageRef.current) {
          stageRef.current = nextStage
          setStage(nextStage)
        }
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
  }, [frameSet, isReducedMotion, ready])

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
