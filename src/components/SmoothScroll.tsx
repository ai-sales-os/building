import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MOTION, isReducedMotion } from '../lib/motion'
import { setScrollInstance } from '../lib/scroll'

gsap.registerPlugin(ScrollTrigger)

function getScrollTop(value?: number) {
  if (value !== undefined) return value
  return window.scrollY
}

export default function SmoothScroll() {
  useEffect(() => {
    if (isReducedMotion()) return

    const lenis = new Lenis({
      autoRaf: false,
      duration: MOTION.duration.slow,
      easing: MOTION.lenisEasing,
      smoothWheel: true,
      syncTouch: true,
      touchMultiplier: 1,
      anchors: false,
      respectReducedMotion: true,
    })
    setScrollInstance(lenis)
    const onScroll = () => ScrollTrigger.update()
    const raf = (time: number) => lenis.raf(time * 1000)
    const onAnchorClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null
      if (!target) return
      const hash = target.getAttribute('href')
      if (!hash || hash === '#') return
      const destination = document.querySelector(hash)
      if (!destination) return
      event.preventDefault()
      if (!(destination instanceof HTMLElement)) return
      lenis.scrollTo(destination, { duration: MOTION.duration.slow, easing: MOTION.lenisEasing })
      window.history.pushState(null, '', hash)
    }

    lenis.on('scroll', onScroll)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    ScrollTrigger.scrollerProxy(window, {
      scrollTop(value) {
        if (value !== undefined) lenis.scrollTo(value, { immediate: true, force: true })
        return getScrollTop(value)
      },
      getBoundingClientRect() {
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
      },
      pinType: document.body.style.transform ? 'transform' : 'fixed',
    })
    document.addEventListener('click', onAnchorClick)
    ScrollTrigger.refresh()

    return () => {
      document.removeEventListener('click', onAnchorClick)
      lenis.off('scroll', onScroll)
      gsap.ticker.remove(raf)
      setScrollInstance(null)
      lenis.destroy()
    }
  }, [])

  return null
}
