export const MOTION = {
  ease: 'expo.out',
  transitionEase: 'expo.inOut',
  cssEase: 'cubic-bezier(0.16, 1, 0.3, 1)',
  duration: {
    fast: 0.3,
    base: 0.75,
    slow: 1.1,
  },
  revealDistance: 24,
  revealStart: 'top 82%',
  stagger: 0.1,
  headingStagger: 0.05,
  lenisEasing: (time: number) => Math.min(1, 1.001 - 2 ** (-10 * time)),
} as const

export function isReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
