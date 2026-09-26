'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import StoryCard from '@/components/StoryCard'
import { Story } from '@/lib/supabase'

export default function AppPage() {
  const [user, setUser] = useState<any>(null)
  const [stories, setStories] = useState<Story[]>([])
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
  }, [router])

  const loadStories = async () => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          users:user_id (id, email, display_name, avatar_url),
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

  const handleInspire = async (storyId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('reactions')
        .insert({
          story_id: storyId,
          user_id: user.id,
          type: 'inspired'
        })

      if (error) throw error
      loadStories()
    } catch (error) {
      console.error('Error adding reaction:', error)
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

      {/* Main Content */}
      <main className="pt-20 md:pt-24 px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl font-display font-bold text-warm-white mb-4">
              DON'T PRESS
            </h1>
            <p className="text-warm-white/60 mb-8">
              18,421 people pressed today
            </p>
            <button
              onClick={() => router.push('/app/press')}
              className="press-button scale-75 md:scale-100"
            >
              PRESS
            </button>
            <p className="text-warm-white/40 text-sm mt-6">
              What happens after the press is up to you.
            </p>
          </div>

          {/* Stories Feed */}
          <div className="mt-16">
            <h2 className="text-2xl font-display font-bold text-warm-white mb-6 flex items-center gap-3">
              <span className="text-3xl">❤️</span>
              People who pressed
            </h2>

            {stories.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-warm-white/50 mb-4">
                  The world is waiting for its first good deed.
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
                  <StoryCard
                    key={story.id}
                    story={story}
                    onInspire={() => handleInspire(story.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
