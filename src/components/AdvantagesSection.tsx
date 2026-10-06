import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const advantages = [
  {
    title: 'Цельное бревно',
    lead: 'Природный материал, который задаёт характер дому.',
    paragraphs: [
      'Мы строим дома из натурального дерева, тщательно отбирая материал для каждого проекта. Используем древесину подходящей влажности и качества, уделяя внимание геометрии, плотности и состоянию каждого элемента.',
      'Дерево сохраняет свою природную фактуру, создаёт особую атмосферу внутри дома и обладает естественными теплоизоляционными свойствами. Благодаря этому деревянный дом остаётся комфортным в любое время года, а его внешний вид со временем приобретает ещё больше характера.',
      'Мы не стремимся скрыть материал за лишней отделкой — для нас важно сохранить то, за что ценят настоящий деревянный дом: фактуру, тепло и ощущение живого дерева.',
    ],
  },
  {
    title: 'Один подрядчик',
    lead: 'Весь путь от проекта до готового дома — в одних руках.',
    paragraphs: [
      'Мы берём на себя строительство дома комплексно, чтобы вам не приходилось самостоятельно координировать архитектора, производство, доставку и строительные бригады.',
      'После согласования проекта мы организуем все основные этапы: подготовку и производство материала, логистику, строительство и сборку дома на участке. Один ответственный подрядчик контролирует процесс целиком и отвечает за результат.',
      'Вы понимаете, на каком этапе находится строительство, кто отвечает за текущие работы и что происходит с проектом дальше. Это позволяет сосредоточиться на выборе будущего дома, а не на ежедневной координации десятков подрядчиков.',
    ],
  },
  {
    title: 'Честная смета',
    lead: 'Понятная стоимость дома ещё до начала строительства.',
    paragraphs: [
      'Мы подробно рассчитываем стоимость проекта до начала работ: отдельно показываем материалы, строительные работы и основные этапы реализации.',
      'Вы заранее понимаете, за что платите и из чего складывается итоговая стоимость дома. Все существенные работы и материалы фиксируются в смете, а любые изменения проекта согласовываются до их реализации.',
      'Наша задача — сделать стоимость строительства максимально прозрачной, чтобы в процессе не возникало неприятных сюрпризов и неожиданных расходов. Вы принимаете решение, имея перед собой понятную картину бюджета и будущего результата.',
    ],
  },
]

export default function AdvantagesSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const introRef = useRef<HTMLDivElement>(null)
  const activeIndexRef = useRef(0)
  const [activeIndex, setActiveIndex] = useState(0)

  useLayoutEffect(() => {
    const section = sectionRef.current
    const viewport = viewportRef.current
    const track = trackRef.current
    const intro = introRef.current
    if (!section || !viewport || !track || !intro) return

    const cards = gsap.utils.toArray<HTMLElement>('[data-advantage-card]', section)
    const contents = gsap.utils.toArray<HTMLElement>('[data-advantage-content]', section)
    const media = gsap.matchMedia()

    media.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
      section.classList.add('is-horizontal')

      const updateCards = (progress: number) => {
        const normalizedPosition = progress * (advantages.length - 1)
        const nextActiveIndex = Math.min(advantages.length - 1, Math.round(normalizedPosition))
        if (nextActiveIndex !== activeIndexRef.current) {
          activeIndexRef.current = nextActiveIndex
          setActiveIndex(nextActiveIndex)
        }

        gsap.set(track, { x: -window.innerWidth * (advantages.length - 1) * progress })
        const introExit = gsap.utils.clamp(0, 1, progress * (advantages.length - 1))
        gsap.set(intro, {
          autoAlpha: 1 - introExit,
          xPercent: -introExit * 8,
          scale: 1 - introExit * 0.04,
        })
        cards.forEach((card, index) => {
          const distance = index - normalizedPosition
          const amount = Math.min(Math.abs(distance), 1)
          gsap.set(card, {
            opacity: 1 - amount * 0.6,
            scale: 1 - amount * 0.08,
          })
        })
        contents.forEach((content, index) => {
          const distance = index - normalizedPosition
          gsap.set(content, { xPercent: -distance * 7 })
        })
      }

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: '+=200%',
        pin: viewport,
        pinSpacing: true,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => updateCards(self.progress),
        onRefresh: (self) => updateCards(self.progress),
      })

      updateCards(0)

      return () => {
        trigger.kill()
        section.classList.remove('is-horizontal')
        activeIndexRef.current = 0
        setActiveIndex(0)
        gsap.set([intro, track, ...cards, ...contents], { clearProps: 'all' })
      }
    })

    media.add('(max-width: 767px) and (prefers-reduced-motion: no-preference)', () => {
      const reveals = cards.map((card) => gsap.fromTo(
        card,
        { autoAlpha: 0, y: 32 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.75,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 84%',
            once: true,
          },
        },
      ))

      return () => reveals.forEach((reveal) => reveal.kill())
    })

    return () => media.revert()
  }, [])

  return (
    <section ref={sectionRef} className="advantages" aria-labelledby="advantages-title">
      <div ref={viewportRef} className="advantages__viewport">
        <div ref={introRef} className="advantages__intro section-intro sr-only">
          <span className="eyebrow">Наш подход</span>
          <h2 id="advantages-title">
            <span>Почему выбирают</span>
            <span><em>нас</em></span>
          </h2>
        </div>

        <div ref={trackRef} className="advantages__track">
          {advantages.map((item, index) => (
            <article className={`advantages__card advantages__card--${index + 1}`} data-advantage-card key={item.title}>
              <div className="advantages__texture" aria-hidden="true" />
              <div className="advantages__card-content" data-advantage-content>
                <span className="advantages__number">0{index + 1}</span>
                <div className="advantages__copy">
                  <h3>{item.title}</h3>
                  <p className="advantages__lead">{item.lead}</p>
                  <div className="advantages__body">
                    {item.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <ol className="advantages__progress" aria-label="Преимущества">
          {advantages.map((item, index) => (
            <li key={item.title}>
              <span
                className={index === activeIndex ? 'is-active' : ''}
                aria-current={index === activeIndex ? 'step' : undefined}
                aria-label={`${item.title}, ${index + 1} из ${advantages.length}`}
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
