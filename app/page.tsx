'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage, LanguageToggle } from '@/lib/LanguageContext'
import HeroVideoIntro from '@/components/HeroVideoIntro'

export default function Home() {
  const { t, isArabic } = useLanguage()
  const router = useRouter()
  const [startingCategory, setStartingCategory] = useState<string | null>(null)

  // No per-category description. Eight cards of two-line blurbs was the other
  // text-heavy block on the page, and the emoji plus the name already say
  // enough to pick one. The descriptions still exist as translation keys and
  // are used on the press screen, where there is room for them.
  const categoriesData = [
    { id: 'good-deed', emoji: '❤️', name: t('cat_good_deed') },
    { id: 'help-someone', emoji: '🤝', name: t('cat_help_someone') },
    { id: 'community', emoji: '🌱', name: t('cat_community') },
    { id: 'give', emoji: '💚', name: t('cat_give') },
    { id: 'creative', emoji: '🎨', name: t('cat_creative') },
    { id: 'fun', emoji: '😂', name: t('cat_fun') },
    { id: 'learn-share', emoji: '🧠', name: t('cat_learn_share') },
    { id: 'random', emoji: '🌍', name: t('cat_random') },
  ]

  // A category picked on the landing page carries the intent through signup so
  // the visitor lands straight on a challenge instead of the generic feed.
  const handleCategoryClick = async (categoryId: string) => {
    if (startingCategory) return
    setStartingCategory(categoryId)

    const destination = `/app/press?category=${categoryId}`

    try {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        router.push(destination)
      } else {
        router.push(`/auth?next=${encodeURIComponent(destination)}`)
      }
    } catch {
      router.push('/auth')
    }
  }

  // The five steps are no longer rendered here: the video replaced them, and
  // their text is carried by the video's figcaption and aria-label instead. The
  // translation keys stay in LanguageContext, where they are still used as the
  // written description on the press screen.
  const howItWorksSteps = [
    { num: 1, title: t('step1_title'), desc: t('step1_desc') },
    { num: 2, title: t('step2_title'), desc: t('step2_desc') },
    { num: 3, title: t('step3_title'), desc: t('step3_desc') },
    { num: 4, title: t('step4_title'), desc: t('step4_desc') },
    { num: 5, title: t('step5_title'), desc: t('step5_desc') },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark via-primary-dark to-deep-green/20">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-50 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-2xl font-display font-bold text-coral-red">
            {t('brand_name')}
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <Link
              href="/auth"
              className="text-warm-white hover:text-coral-red transition font-semibold"
            >
              {t('nav_signin')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section.
          Deliberately almost empty: headline, button, one line. The video below
          does the explaining, which is the point of it. */}
      <div className="relative min-h-[88vh] flex flex-col items-center justify-center px-6 pt-24">
        <div className="text-center mb-10 animate-float">
          <h1 className="text-6xl md:text-8xl font-display font-bold text-warm-white mb-3 tracking-tight">
            {t('dont_press_hero_1')}
          </h1>
          <h1 className="text-6xl md:text-8xl font-display font-bold text-warm-white tracking-tight">
            {t('dont_press_hero_2')}
          </h1>
        </div>

        <Link href="/auth">
          <button className="press-button mb-6">
            {t('press_verb')}
          </button>
        </Link>

        {/* A scroll cue instead of a paragraph. Saying less here is the whole
            brief, and the page below earns the reader's attention on its own. */}
        <a
          href="#intro"
          className="mt-6 text-warm-white/40 hover:text-warm-white/70 transition text-sm inline-flex items-center gap-2"
        >
          {t('watch_intro')}
          <ChevronDown size={16} className="animate-bounce" />
        </a>
      </div>

      {/* Intro video. This replaces the old five-step "How It Works" text
          block, which was the most text-heavy thing on the page and explained
          the idea less well in a sentence than the video does in ten seconds.
          Framed rather than full-bleed on purpose: the clip opens on a screen
          recording of this very homepage, so behind a full-bleed hero it would
          show a video of the page it is sitting on. */}
      <div id="intro" className="max-w-4xl mx-auto px-6 pb-8 scroll-mt-20">
        <HeroVideoIntro />
      </div>

      {/* How It Works.
          Was five numbered cards of explanation. Now it is one video and a
          single line: the same information, in ten seconds of watching instead
          of a screenful of reading. The step titles survive as an aria-label so
          the content is still there for a screen reader, and for anyone who
          would rather read it. */}
      <div className="max-w-5xl mx-auto px-6 py-14">
        <h2 className="sr-only">{t('how_it_works')}</h2>
        <p className="text-center text-warm-white/60 max-w-xl mx-auto">
          {t('one_press_one_challenge')}
        </p>
      </div>

      {/* Tagline */}
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-5xl md:text-6xl font-display font-bold text-warm-white mb-6 leading-tight">
          {t('tagline')}
        </h2>
        <p className="text-xl text-warm-white/70 mb-12 max-w-2xl mx-auto">
          {t('tagline_sub')}
        </p>
        <Link
          href="/auth"
          className="inline-block bg-coral-red text-white px-12 py-4 rounded-full font-display font-bold text-xl hover:scale-105 transition-transform"
        >
          {t('start_first_challenge')}
        </Link>
      </div>

      {/* Categories Preview */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-display font-bold text-center text-warm-white mb-16">
          {t('choose_path')}
        </h2>

        <div className="grid md:grid-cols-4 gap-6">
          {categoriesData.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => handleCategoryClick(category.id)}
              disabled={startingCategory !== null}
              className="card text-center hover:scale-105 hover:border-coral-red/50 transition-transform cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              <div className="text-4xl mb-2">{category.emoji}</div>
              <h3 className="text-base font-semibold text-warm-white mb-2">
                {category.name}
              </h3>
              <div className="text-xs text-coral-red font-semibold">
                {startingCategory === category.id ? t('loading') : t('choose_path_cta')}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-warm-white/10 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-warm-white/50 text-sm mb-4">
            {t('footer_tagline')}
          </p>
          <p className="text-warm-white/30 text-xs">
            {t('footer_copy')}
          </p>
        </div>
      </footer>
    </div>
  )
}
