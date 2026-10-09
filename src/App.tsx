import { useEffect, useRef, useState } from 'react'
import FrameSequence from './components/FrameSequence'
import AdvantagesSection from './components/AdvantagesSection'
import ProjectsCarousel from './components/ProjectsCarousel'
import MotionEffects from './components/MotionEffects'
import SmoothScroll from './components/SmoothScroll'
import './index.css'

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  // The bar is pinned while the frame section still fills the viewport and released
  // once it has scrolled past, so it leaves together with the first block instead of
  // following the reader down the page. Desktop keeps the plain absolute header.
  useEffect(() => {
    const header = headerRef.current
    const stages = document.getElementById('stages')
    if (!header || !stages) return
    const mobile = window.matchMedia('(max-width: 767px)')
    let visible = stages.getBoundingClientRect().bottom > 0
    const apply = () => {
      header.classList.toggle('is-released', mobile.matches && !visible)
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting)
      apply()
    })
    observer.observe(stages)
    mobile.addEventListener('change', apply)
    apply()
    return () => {
      observer.disconnect()
      mobile.removeEventListener('change', apply)
      header.classList.remove('is-released')
    }
  }, [])

  return (
    <div ref={shellRef} className="site-shell">
      <SmoothScroll />
      <MotionEffects scope={shellRef} />
      <div className="motion-scope">
      <header ref={headerRef} className="site-header">
        <a className="brand" data-magnetic="0.12" href="#top" aria-label="Рублино — на главную">
          <img className="brand__logo" src="/logo.webp" alt="" width="512" height="512" />
          <span className="brand__name">Рублино</span>
        </a>
        <button className="menu-toggle" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} data-lenis-prevent>
          <span /> <span />
          <span className="sr-only">Меню</span>
        </button>
        <nav className={menuOpen ? 'site-nav is-open' : 'site-nav'} aria-label="Основная навигация" data-lenis-prevent>
          <a href="#about" onClick={() => setMenuOpen(false)}>О доме</a>
          <a href="#stages" onClick={() => setMenuOpen(false)}>Этапы</a>
          <a href="#projects" onClick={() => setMenuOpen(false)}>Проекты</a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>Контакты</a>
        </nav>
        <a className="button button--header" data-magnetic="0.16" href="#contact">Связаться</a>
      </header>

      <main id="top">
        <FrameSequence />

        <section className="about section" id="about">
          <div className="section-intro" data-reveal-heading>
            <span className="eyebrow" data-reveal-item>О компании</span>
            <h2><span data-reveal-line><span className="heading-line__inner">Дом, который</span></span><span data-reveal-line><span className="heading-line__inner"><em>останется</em> с вами</span></span></h2>
          </div>
          <div className="about__body" data-reveal>
            <p className="lead" data-reveal-item>Рублино строит деревянные дома из цельного бревна — от первого эскиза до ключей.</p>
            <p data-reveal-item>Мы не торопим материал и не прячем процесс за красивыми словами. Каждый венец садится в чашу вручную, а каждый этап вы видите на экране.</p>
            <a className="text-link" data-reveal-item data-magnetic="0.15" href="#contact">Обсудить ваш дом <span>↗</span></a>
          </div>
        </section>

        <AdvantagesSection />

        <ProjectsCarousel />

        <section className="contact section" id="contact" aria-labelledby="contact-title">
          <div className="contact__copy" data-reveal>
            <div data-reveal-heading>
              <span className="eyebrow" data-reveal-item>Начать разговор</span>
              <h2 id="contact-title"><span data-reveal-line><span className="heading-line__inner">Расскажите,</span></span><span data-reveal-line><span className="heading-line__inner">каким будет ваш <em>дом</em></span></span></h2>
            </div>
            <p data-reveal-item>Позвоните или напишите нам напрямую — без заявок и ожидания. Ответим на первые вопросы и поможем начать.</p>
          </div>
          <div className="contact__details" data-reveal>
            <ul className="contact-list">
              <li data-reveal-item>
                <div className="contact-person">
                  <span className="contact-person__name">Денис</span>
                  <a className="contact-person__phone" href="tel:+79135322020" data-magnetic="0.1">+7 913 532-20-20</a>
                  <span className="contact-person__channels">WhatsApp · Max</span>
                </div>
              </li>
              <li data-reveal-item>
                <div className="contact-person">
                  <span className="contact-person__name">Богдан</span>
                  <a className="contact-person__phone" href="tel:+79082203000" data-magnetic="0.1">+7 908 220-30-00</a>
                  <span className="contact-person__channels">WhatsApp · Telegram</span>
                </div>
              </li>
            </ul>
            <a className="contact-social" href="https://instagram.com/rubleno_houses" target="_blank" rel="noreferrer" data-reveal-item data-magnetic="0.12">
              <span className="contact-social__label">Instagram</span>
              <span className="contact-social__handle">@rubleno_houses</span>
            </a>
          </div>
        </section>
      </main>
      </div>

      <footer className="site-footer">
        <a className="brand" data-magnetic="0.12" href="#top"><img className="brand__logo" src="/logo.webp" alt="" width="512" height="512" /><span className="brand__name">Рублино</span></a>
        <p>Строим дома, в которые хочется возвращаться.</p>
        <span>© 2026 Рублино</span>
      </footer>
    </div>
  )
}

export default App
