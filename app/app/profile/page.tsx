'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import StoryCard from '@/components/StoryCard'
import { Story } from '@/lib/supabase'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [stats, setStats] = useState({
    totalChallenges: 0,
    completedChallenges: 0,
    activeChains: 0,
    peopleInspired: 0,
  })
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth')
        return
      }
      setUser(session.user)
      loadProfile(session.user.id)
      loadStories(session.user.id)
      loadStats(session.user.id)
    }
    checkUser()
  }, [router])

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (data) setProfile(data)
  }

  const loadStories = async (userId: string) => {
    const { data, error } = await supabase
      .from('stories')
      .select(`
        *,
        users:user_id (id, email, display_name, avatar_url),
        challenges:challenge_id (id, title, description, category, difficulty, estimated_time),
        reactions (id, type, user_id),
        comments (id, content, user_id, created_at)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (data) setStories(data || [])
  }

  const loadStats = async (userId: string) => {
    // Get total challenges
    const { count: totalCount } = await supabase
      .from('challenge_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Get completed challenges
    const { count: completedCount } = await supabase
      .from('challenge_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')

    // Get active chains
    const { count: chainsCount } = await supabase
      .from('chain_nodes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Get people inspired (reactions on user's stories)
    const { data: userStories } = await supabase
      .from('stories')
      .select('id')
      .eq('user_id', userId)

    let inspiredCount = 0
    if (userStories && userStories.length > 0) {
      const storyIds = userStories.map(s => s.id)
      const { count } = await supabase
        .from('reactions')
        .select('*', { count: 'exact', head: true })
        .in('story_id', storyIds)
        .eq('type', 'inspired')

      inspiredCount = count || 0
    }

    setStats({
      totalChallenges: totalCount || 0,
      completedChallenges: completedCount || 0,
      activeChains: chainsCount || 0,
      peopleInspired: inspiredCount,
    })
  }

  if (!user) {
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
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="text-center mb-12">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-coral-red to-warm-orange mx-auto mb-4 flex items-center justify-center text-white text-4xl font-bold">
              {profile?.display_name?.[0] || user.email?.[0] || 'U'}
            </div>
            <h1 className="text-3xl font-display font-bold text-warm-white mb-2">
              {profile?.display_name || user.email?.split('@')[0] || 'User'}
            </h1>
            <p className="text-warm-white/60">
              {profile?.bio || 'Try to leave people better than you found them.'}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <div className="card text-center">
              <div className="text-3xl font-bold text-coral-red mb-1">
                {stats.completedChallenges}
              </div>
              <div className="text-sm text-warm-white/60">
                ❤️ Good Deeds
              </div>
            </div>

            <div className="card text-center">
              <div className="text-3xl font-bold text-kindness-green mb-1">
                {stats.totalChallenges}
              </div>
              <div className="text-sm text-warm-white/60">
                🎯 Challenges
              </div>
            </div>

            <div className="card text-center">
              <div className="text-3xl font-bold text-warm-orange mb-1">
                {stats.activeChains}
              </div>
              <div className="text-sm text-warm-white/60">
                🔥 Chains
              </div>
            </div>

            <div className="card text-center">
              <div className="text-3xl font-bold text-soft-yellow mb-1">
                {stats.peopleInspired}
              </div>
              <div className="text-sm text-warm-white/60">
                ✨ Inspired
              </div>
            </div>
          </div>

          {/* Recent Stories */}
          <div>
            <h2 className="text-2xl font-display font-bold text-warm-white mb-6">
              Your Stories
            </h2>

            {stories.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-warm-white/50 mb-4">
                  You haven't shared any stories yet.
                </p>
                <button
                  onClick={() => router.push('/app/press')}
                  className="btn-primary"
                >
                  Start your first challenge
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
        </div>
      </main>
    </div>
  )
}
