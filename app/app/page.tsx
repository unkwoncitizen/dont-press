'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import StoryCard from '@/components/StoryCard'
import { Story } from '@/lib/supabase'
import { useIsAdmin } from '@/lib/useIsAdmin'
import { useLanguage } from '@/lib/LanguageContext'

export default function AppPage() {
  const [user, setUser] = useState<any>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [inspiringStoryId, setInspiringStoryId] = useState<string | null>(null)
  const { isAdmin } = useIsAdmin()
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
      loadStories()
    }
    checkUser()
  }, [router])

  const loadStories = async () => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          users:user_id (id, display_name, avatar_url),
          challenges:challenge_id (id, title, description, category, difficulty, estimated_time),
          reactions (id, type, user_id, users:user_id (display_name)),
          comments (id, content, user_id, created_at, users:user_id (display_name))
        `)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setStories(data || [])
    } catch (error) {
      console.error('Error loading stories:', error)
    } finally {
      setLoading(false)
    }
  }

  // Drop the card immediately rather than refetching, so deletion feels
  // instant and the feed does not re-sort under the user.
  const handleDeleted = useCallback((storyId: string) => {
    setStories((prev) => prev.filter((s) => s.id !== storyId))
  }, [])

  const handleInspire = async (storyId: string, isAdding: boolean) => {
    if (!user) return

    // Show animation only when adding (inspiring)
    if (isAdding) {
      setInspiringStoryId(storyId)

      // Create floating hearts animation
      const storyCard = document.querySelector(`[data-story-id="${storyId}"]`)
      if (storyCard) {
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            const heart = document.createElement('div')
            heart.innerHTML = '❤️'
            heart.style.position = 'fixed'
            heart.style.fontSize = '24px'
            heart.style.zIndex = '9999'
            heart.style.pointerEvents = 'none'
            heart.style.animation = 'float-up 2s ease-out forwards'

            const rect = storyCard.getBoundingClientRect()
            heart.style.left = `${rect.left + Math.random() * rect.width}px`
            heart.style.top = `${rect.top + rect.height / 2}px`

            document.body.appendChild(heart)

            setTimeout(() => heart.remove(), 2000)
          }, i * 100)
        }
      }
    }

    // Reload stories to sync counts after DB change (StoryCard handles the DB)
    setTimeout(() => {
      setInspiringStoryId(null)
      loadStories()
    }, isAdding ? 1000 : 500)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center">
        <div className="text-warm-white/50">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark via-primary-dark to-deep-green/20 pb-24 md:pb-8">
      <Navigation />

      {/* Floating hearts animation */}
      <style jsx global>{`
        @keyframes float-up {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-100px) scale(1.5);
          }
        }
      `}</style>

      {/* Main Content */}
      <main className="pt-20 md:pt-24 px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl font-display font-bold text-warm-white mb-4">
              {t('brand_name')}
            </h1>
            <p className="text-warm-white/60 mb-8">
              {t('pressed_today')}
            </p>
            <button
              onClick={() => router.push('/app/press')}
              className="press-button scale-75 md:scale-100"
            >
              {t('press_verb')}
            </button>
            <p className="text-warm-white/40 text-sm mt-6">
              {t('after_press_note')}
            </p>
          </div>

          {/* Stories Feed */}
          <div className="mt-16">
            <h2 className="text-2xl font-display font-bold text-warm-white mb-6 flex items-center gap-3">
              <span className="text-3xl">❤️</span>
              {t('people_who_pressed')}
            </h2>

            {stories.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-warm-white/50 mb-4">
                  {t('no_stories_feed')}
                </p>
                <button
                  onClick={() => router.push('/app/press')}
                  className="btn-primary"
                >
                  {t('be_the_first')}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {stories.map((story) => (
                  <div
                    key={story.id}
                    data-story-id={story.id}
                    className={inspiringStoryId === story.id ? 'animate-pulse' : ''}
                  >
                    <StoryCard
                      story={story}
                      onInspire={(isAdding) => handleInspire(story.id, isAdding)}
                      canModerate={isAdmin}
                      onDeleted={handleDeleted}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
