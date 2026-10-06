import type Lenis from 'lenis'

let activeLenis: Lenis | null = null

/** Hands the smooth-scroll instance to code that needs to move the page. */
export function setScrollInstance(lenis: Lenis | null) {
  activeLenis = lenis
}

/**
 * Jump to an absolute page offset immediately. Routing through Lenis keeps the
 * smooth scroller's internal position in step with the browser's, so a programmatic
 * move is not undone on the next frame.
 */
export function scrollPageTo(value: number) {
  if (activeLenis) activeLenis.scrollTo(value, { immediate: true, force: true })
  else window.scrollTo(0, value)
}
