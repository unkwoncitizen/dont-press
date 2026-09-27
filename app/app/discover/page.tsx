'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import StoryCard from '@/components/StoryCard'
import { Story } from '@/lib/supabase'
import { categories } from '@/lib/challenges-data'
import { useLanguage } from '@/lib/LanguageContext'

export default function DiscoverPage() {
  const [user, setUser] = useState<any>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [activeTab, setActiveTab] = useState<'inspiring' | 'recent' | 'chains'>('inspiring')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { t } = useLanguage()

  const loadStories = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('stories')
        .select(`
          *,
          users:user_id (id, display_name, avatar_url),
          challenges:challenge_id!inner (id, title, description, category, difficulty, estimated_time),
          reactions (id, type, user_id, users:user_id (display_name)),
          comments (id, content, user_id, created_at, users:user_id (display_name))
        `)

      // Filtering on the embedded challenge needs the !inner join above,
      // otherwise the condition is applied after the rows are already joined
      // and stories from every category come back.
      if (activeCategory) {
        query = query.eq('challenges.category', activeCategory)
      }

      if (activeTab === 'inspiring') {
        query = query.order('created_at', { ascending: false })
      } else if (activeTab === 'chains') {
        query = query.not('chain_id', 'is', null)
      } else {
        query = query.order('created_at', { ascending: false })
      }

      const { data, error } = await query.limit(20)

      if (error) throw error
      setStories(data || [])
    } catch (error) {
      console.error('Error loading stories:', error)
    } finally {
      setLoading(false)
    }
  }, [activeTab, activeCategory])

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
  }, [router, loadStories])

  const getCategoryName = (catId: string) => {
    const key = `cat_${catId.replace(/-/g, '_')}`
    return t(key) || catId
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

      <main className="pt-20 md:pt-24 px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-display font-bold text-warm-white mb-4">
              {t('discover_title')}
            </h1>
            <p className="text-warm-white/60 text-lg">
              {t('discover_subtitle')}
            </p>
          </div>

          {/* Categories Grid — acts as a filter over the stories below */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <button
              onClick={() => setActiveCategory(null)}
              aria-pressed={activeCategory === null}
              className={`card text-center p-4 transition-all hover:scale-105 ${
                activeCategory === null
                  ? 'border-coral-red bg-coral-red/15'
                  : 'hover:border-coral-red/50'
              }`}
            >
              <div className="text-4xl mb-2">✨</div>
              <div className="text-sm font-semibold text-warm-white">{t('filter_all')}</div>
            </button>

            {categories.filter(c => c.id !== 'random').map((category) => {
              const isActive = activeCategory === category.id
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(isActive ? null : category.id)}
                  aria-pressed={isActive}
                  className={`card text-center p-4 transition-all hover:scale-105 ${
                    isActive ? 'border-coral-red bg-coral-red/15' : 'hover:border-coral-red/50'
                  }`}
                >
                  <div className="text-4xl mb-2">{category.emoji}</div>
                  <div className="text-sm font-semibold text-warm-white">
                    {getCategoryName(category.id)}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('inspiring')}
              className={`px-6 py-3 rounded-2xl font-semibold transition whitespace-nowrap ${
                activeTab === 'inspiring'
                  ? 'bg-coral-red text-white'
                  : 'bg-warm-white/10 text-warm-white hover:bg-warm-white/20'
              }`}
            >
              {t('tab_most_inspiring')}
            </button>
            <button
              onClick={() => setActiveTab('recent')}
              className={`px-6 py-3 rounded-2xl font-semibold transition whitespace-nowrap ${
                activeTab === 'recent'
                  ? 'bg-coral-red text-white'
                  : 'bg-warm-white/10 text-warm-white hover:bg-warm-white/20'
              }`}
            >
              {t('tab_recent_stories')}
            </button>
            <button
              onClick={() => setActiveTab('chains')}
              className={`px-6 py-3 rounded-2xl font-semibold transition whitespace-nowrap ${
                activeTab === 'chains'
                  ? 'bg-coral-red text-white'
                  : 'bg-warm-white/10 text-warm-white hover:bg-warm-white/20'
              }`}
            >
              {t('tab_active_chains')}
            </button>
          </div>

          {/* Stories Grid */}
          {stories.length === 0 ? (
            <div className="card text-center py-12">
              {activeCategory ? (
                <>
                  <p className="text-warm-white/50 mb-4">
                    {t('no_stories_in_category').replace('{cat}', getCategoryName(activeCategory))}
                  </p>
                  <button
                    onClick={() => setActiveCategory(null)}
                    className="btn-secondary"
                  >
                    {t('filter_all')}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-warm-white/50 mb-4">
                    {t('no_stories_found')}
                  </p>
                  <button
                    onClick={() => router.push('/app/press')}
                    className="btn-primary"
                  >
                    {t('be_the_first')}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {stories.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
