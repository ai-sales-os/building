import { useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MOTION } from '../lib/motion'

gsap.registerPlugin(ScrollTrigger)

type MotionEffectsProps = {
  scope: RefObject<HTMLElement | null>
}

export default function MotionEffects({ scope }: MotionEffectsProps) {
  useLayoutEffect(() => {
    const root = scope.current
    if (!root) return

    const media = gsap.matchMedia(root)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-near')
        })
      },
      { rootMargin: '20% 0px' },
    )
    const observed = root.querySelectorAll<HTMLElement>('[data-reveal], [data-reveal-heading], [data-magnetic]')
    observed.forEach((element) => observer.observe(element))

    media.add('(prefers-reduced-motion: no-preference)', () => {
      const revealGroups = gsap.utils.toArray<HTMLElement>('[data-reveal]', root)
      revealGroups.forEach((group) => {
        const items = gsap.utils.toArray<HTMLElement>('[data-reveal-item]', group)
        if (!items.length) return
        gsap.from(items, {
          y: MOTION.revealDistance,
          autoAlpha: 0,
          duration: MOTION.duration.base,
          ease: MOTION.ease,
          stagger: window.matchMedia('(max-width: 767px)').matches ? 0.06 : MOTION.stagger,
          clearProps: 'willChange',
          scrollTrigger: {
            trigger: group,
            start: MOTION.revealStart,
            once: true,
          },
        })
      })

      const headings = gsap.utils.toArray<HTMLElement>('[data-reveal-heading]', root)
      headings.forEach((heading) => {
        const lines = gsap.utils.toArray<HTMLElement>('[data-reveal-line]', heading)
        const inners = lines.map((line) => line.querySelector<HTMLElement>('.heading-line__inner')).filter((inner): inner is HTMLElement => inner !== null)
        if (!inners.length) return
        gsap.from(inners, {
          yPercent: 105,
          autoAlpha: 0,
          duration: MOTION.duration.base,
          ease: MOTION.ease,
          stagger: window.matchMedia('(max-width: 767px)').matches ? 0.04 : MOTION.headingStagger,
          clearProps: 'willChange',
          scrollTrigger: {
            trigger: heading,
            start: MOTION.revealStart,
            once: true,
          },
        })
      })

      const magneticElements = gsap.utils.toArray<HTMLElement>('[data-magnetic]', root)
      const cleanups = magneticElements.map((element) => {
        const strength = Number(element.dataset.magnetic) || 0.18
        const xTo = gsap.quickTo(element, 'x', { duration: MOTION.duration.fast, ease: MOTION.ease })
        const yTo = gsap.quickTo(element, 'y', { duration: MOTION.duration.fast, ease: MOTION.ease })
        const onMove = (event: PointerEvent) => {
          const bounds = element.getBoundingClientRect()
          xTo((event.clientX - (bounds.left + bounds.width / 2)) * strength)
          yTo((event.clientY - (bounds.top + bounds.height / 2)) * strength - 2)
          element.classList.add('is-magnetic-active')
        }
        const onLeave = () => {
          xTo(0)
          yTo(0)
          element.classList.remove('is-magnetic-active')
        }
        element.addEventListener('pointermove', onMove)
        element.addEventListener('pointerleave', onLeave)
        return () => {
          element.removeEventListener('pointermove', onMove)
          element.removeEventListener('pointerleave', onLeave)
          xTo(0)
          yTo(0)
          element.classList.remove('is-magnetic-active')
        }
      })

      return () => cleanups.forEach((cleanup) => cleanup())
    })

    return () => {
      observer.disconnect()
      observed.forEach((element) => element.classList.remove('is-near', 'is-magnetic-active'))
      media.revert()
    }
  }, [scope])

  return null
}
