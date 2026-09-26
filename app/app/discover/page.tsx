'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import StoryCard from '@/components/StoryCard'
import { Story } from '@/lib/supabase'
import { categories } from '@/lib/challenges-data'

export default function DiscoverPage() {
  const [user, setUser] = useState<any>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [activeTab, setActiveTab] = useState<'inspiring' | 'recent' | 'chains'>('inspiring')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

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
  }, [router, activeTab])

  const loadStories = async () => {
    try {
      let query = supabase
        .from('stories')
        .select(`
          *,
          users:user_id (id, email, display_name, avatar_url),
          challenges:challenge_id (id, title, description, category, difficulty, estimated_time),
          reactions (id, type, user_id, users:user_id (display_name)),
          comments (id, content, user_id, created_at, users:user_id (display_name))
        `)

      if (activeTab === 'inspiring') {
        // Stories with most "inspired" reactions
        query = query.order('created_at', { ascending: false })
      } else if (activeTab === 'chains') {
        // Stories that are part of chains
        query = query.not('chain_id', 'is', null)
      } else {
        // Recent stories
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
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center">
        <div className="text-warm-white/50">Loading...</div>
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
              Discover
            </h1>
            <p className="text-warm-white/60 text-lg">
              Stories that inspire action
            </p>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {categories.filter(c => c.id !== 'random').map((category) => (
              <button
                key={category.id}
                className="card hover:scale-105 transition-transform text-center p-4"
              >
                <div className="text-4xl mb-2">{category.emoji}</div>
                <div className="text-sm font-semibold text-warm-white">
                  {category.name}
                </div>
              </button>
            ))}
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
              ❤️ Most Inspiring
            </button>
            <button
              onClick={() => setActiveTab('recent')}
              className={`px-6 py-3 rounded-2xl font-semibold transition whitespace-nowrap ${
                activeTab === 'recent'
                  ? 'bg-coral-red text-white'
                  : 'bg-warm-white/10 text-warm-white hover:bg-warm-white/20'
              }`}
            >
              ✨ Recent Stories
            </button>
            <button
              onClick={() => setActiveTab('chains')}
              className={`px-6 py-3 rounded-2xl font-semibold transition whitespace-nowrap ${
                activeTab === 'chains'
                  ? 'bg-coral-red text-white'
                  : 'bg-warm-white/10 text-warm-white hover:bg-warm-white/20'
              }`}
            >
              🔥 Active Chains
            </button>
          </div>

          {/* Stories Grid */}
          {stories.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-warm-white/50 mb-4">
                No stories found yet.
              </p>
              <button
                onClick={() => router.push('/app/press')}
                className="btn-primary"
              >
                Be the first
              </button>
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
