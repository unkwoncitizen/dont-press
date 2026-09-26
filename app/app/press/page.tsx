'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { categories } from '@/lib/challenges-data'
import { useLanguage } from '@/lib/LanguageContext'

export default function PressPage() {
  const [user, setUser] = useState<any>(null)
  const [step, setStep] = useState<'intro' | 'category' | 'challenge'>('intro')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [challenge, setChallenge] = useState<any>(null)
  const router = useRouter()
  const { t } = useLanguage()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth')
        return
      }
      setUser(session.user)
    }
    checkUser()
  }, [router])

  const handlePressButton = () => {
    setStep('category')
  }

  const handleSelectCategory = async (categoryId: string) => {
    setSelectedCategory(categoryId)

    // Get random challenge from category
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('category', categoryId)
      .eq('active', true)

    if (data && data.length > 0) {
      const randomChallenge = data[Math.floor(Math.random() * data.length)]
      setChallenge(randomChallenge)
      setStep('challenge')
    }
  }

  const handleAcceptChallenge = async () => {
    if (!user || !challenge) return

    try {
      // Create assignment
      const { data: assignment, error: assignmentError } = await supabase
        .from('challenge_assignments')
        .insert({
          user_id: user.id,
          challenge_id: challenge.id,
          status: 'accepted',
        })
        .select()
        .single()

      if (assignmentError) throw assignmentError

      // Redirect to complete challenge page
      router.push(`/app/complete/${assignment.id}`)
    } catch (error) {
      console.error('Error accepting challenge:', error)
    }
  }

  const handlePassChallenge = () => {
    router.push('/app')
  }

  const getCategoryTranslation = (categoryId: string) => {
    const catKey = `cat_${categoryId.replace(/-/g, '_')}`
    const descKey = `${catKey}_desc`
    return {
      name: t(catKey),
      description: t(descKey),
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center">
        <div className="text-warm-white/50">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark via-primary-dark to-deep-green/20 pb-24 md:pb-8">
      <Navigation />

      <main className="pt-20 md:pt-24 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          {/* INTRO STEP */}
          {step === 'intro' && (
            <div className="min-h-[80vh] flex flex-col items-center justify-center text-center">
              <h1 className="text-6xl md:text-8xl font-display font-bold text-warm-white mb-8 animate-float">
                {t('brand_name')}
              </h1>
              <button
                onClick={handlePressButton}
                className="press-button mb-8"
              >
                {t('press_verb')}
              </button>
              <p className="text-warm-white/50 text-lg">
                {t('you_know_you_want')}
              </p>
            </div>
          )}

          {/* CATEGORY SELECTION STEP */}
          {step === 'category' && (
            <div className="min-h-[80vh] flex flex-col items-center justify-center">
              <div className="text-center mb-12 space-y-6">
                <h2 className="text-4xl md:text-5xl font-display font-bold text-warm-white">
                  {t('you_pressed_it')}
                </h2>
                <p className="text-2xl md:text-3xl font-display text-warm-white/70">
                  {t('no_going_back')}
                </p>
                <p className="text-xl text-coral-red font-semibold">
                  {t('choose_challenge_title')}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
                {categories.map((category) => {
                  const translated = getCategoryTranslation(category.id)
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleSelectCategory(category.id)}
                      className="card hover:scale-105 hover:border-coral-red/50 transition-all text-center p-6 cursor-pointer"
                    >
                      <div className="text-5xl mb-3">{category.emoji}</div>
                      <h3 className="text-lg font-semibold text-warm-white mb-1">
                        {translated.name || category.name}
                      </h3>
                      <p className="text-xs text-warm-white/60">
                        {translated.description || category.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* CHALLENGE DISPLAY STEP */}
          {step === 'challenge' && challenge && (
            <div className="min-h-[80vh] flex flex-col items-center justify-center">
              <div className="card max-w-2xl w-full text-center p-8 md:p-12">
                <div className="mb-8">
                  <p className="text-warm-white/50 text-sm mb-2">{t('you_chose')}</p>
                  <h2 className="text-3xl font-display font-bold text-coral-red mb-8 flex items-center justify-center gap-3">
                    <span className="text-4xl">
                      {categories.find(c => c.id === selectedCategory)?.emoji}
                    </span>
                    {getCategoryTranslation(selectedCategory || '').name || selectedCategory}
                  </h2>
                </div>

                <div className="border-t border-b border-warm-white/20 py-8 mb-8">
                  <p className="text-warm-white/50 text-sm mb-4">{t('your_challenge')}</p>
                  <h3 className="text-2xl md:text-3xl font-bold text-warm-white mb-4">
                    {challenge.title}
                  </h3>
                  <p className="text-lg text-warm-white/80 leading-relaxed">
                    {challenge.description}
                  </p>
                </div>

                {/* Challenge Details */}
                <div className="flex flex-wrap items-center justify-center gap-4 mb-8 text-sm text-warm-white/60">
                  <span className="flex items-center gap-1">
                    ⏱ {challenge.estimated_time}
                  </span>
                  <span className="flex items-center gap-1">
                    📊 {challenge.difficulty}
                  </span>
                  {challenge.requires_other_person && (
                    <span className="flex items-center gap-1">
                      👥 {t('requires_other_person')}
                    </span>
                  )}
                  {challenge.requires_money && (
                    <span className="flex items-center gap-1">
                      💰 {t('requires_money')}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleAcceptChallenge}
                    className="flex-1 bg-kindness-green text-white px-8 py-4 rounded-2xl font-display font-bold text-lg hover:scale-105 transition-transform"
                  >
                    {t('accept')}
                  </button>
                  <button
                    onClick={handlePassChallenge}
                    className="flex-1 bg-warm-white/10 text-warm-white px-8 py-4 rounded-2xl font-display font-bold text-lg hover:bg-warm-white/20 transition-all"
                  >
                    {t('pass')}
                  </button>
                </div>

                <p className="text-xs text-warm-white/40 mt-6">
                  {t('pass_note')}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
