'use client'

import Link from 'next/link'
import { useLanguage, LanguageToggle } from '@/lib/LanguageContext'

export default function Home() {
  const { t, isArabic } = useLanguage()

  const categoriesData = [
    { emoji: '❤️', name: t('cat_good_deed'), desc: t('cat_good_deed_desc') },
    { emoji: '🤝', name: t('cat_help_someone'), desc: t('cat_help_someone_desc') },
    { emoji: '🌱', name: t('cat_community'), desc: t('cat_community_desc') },
    { emoji: '💚', name: t('cat_give'), desc: t('cat_give_desc') },
    { emoji: '🎨', name: t('cat_creative'), desc: t('cat_creative_desc') },
    { emoji: '😂', name: t('cat_fun'), desc: t('cat_fun_desc') },
    { emoji: '🧠', name: t('cat_learn_share'), desc: t('cat_learn_share_desc') },
    { emoji: '🌍', name: t('cat_random'), desc: t('cat_random_desc') },
  ]

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

      {/* Hero Section */}
      <div className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-16">
        <div className="text-center mb-12 animate-float">
          <h1 className="text-6xl md:text-8xl font-display font-bold text-warm-white mb-4 tracking-tight">
            {t('dont_press_hero_1')}
          </h1>
          <h1 className="text-6xl md:text-8xl font-display font-bold text-warm-white mb-8 tracking-tight">
            {t('dont_press_hero_2')}
          </h1>
        </div>

        {/* The Button */}
        <Link href="/auth">
          <button className="press-button mb-8">
            {t('press_verb')}
          </button>
        </Link>

        <p className="text-warm-white/60 text-lg mb-2">
          {t('pressed_today')}
        </p>
        <p className="text-warm-white/40 text-sm max-w-md text-center">
          {t('after_press_note')}
        </p>
      </div>

      {/* How It Works */}
      <div className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-display font-bold text-center text-warm-white mb-16">
          {t('how_it_works')}
        </h2>

        <div className="grid md:grid-cols-5 gap-8">
          {howItWorksSteps.map((step) => (
            <div key={step.num} className="text-center">
              <div className="w-16 h-16 rounded-full bg-coral-red/20 text-coral-red flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                {step.num}
              </div>
              <h3 className="text-xl font-semibold text-warm-white mb-2">{step.title}</h3>
              <p className="text-warm-white/60 text-sm">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
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
            <div key={category.name} className="card text-center hover:scale-105 transition-transform">
              <div className="text-5xl mb-3">{category.emoji}</div>
              <h3 className="text-lg font-semibold text-warm-white mb-1">
                {category.name}
              </h3>
              <p className="text-sm text-warm-white/60">{category.desc}</p>
            </div>
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
