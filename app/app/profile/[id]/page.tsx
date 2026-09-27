'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Navigation from '@/components/Navigation'
import StoryCard from '@/components/StoryCard'
import ChainCard from '@/components/ChainCard'
import { Story, User, Chain } from '@/lib/supabase'
import { useLanguage } from '@/lib/LanguageContext'
import Link from 'next/link'
import { Home } from 'lucide-react'

export default function OtherProfilePage() {
  const params = useParams()
  const router = useRouter()
  const profileId = params.id as string
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [createdChains, setCreatedChains] = useState<Chain[]>([])
  const [stats, setStats] = useState({
    totalChallenges: 0,
    completedChallenges: 0,
    activeChains: 0,
    peopleInspired: 0,
  })
  const [loading, setLoading] = useState(true)
  const { t } = useLanguage()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth')
        return
      }
      setUser(session.user)
      loadProfile(profileId)
      loadStories(profileId)
      loadStats(profileId, session.user.id === profileId)
      loadChains(profileId)
    }
    checkUser()
  }, [router, profileId])

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name, bio, avatar_url, created_at, updated_at')
      .eq('id', userId)
      .single()

    if (data) setProfile(data)
  }

  const loadStories = async (userId: string) => {
    const { data, error } = await supabase
      .from('stories')
      .select(`
        *,
        users:user_id (id, display_name, avatar_url),
        challenges:challenge_id (id, title, description, category, difficulty, estimated_time),
        reactions (id, type, user_id, users:user_id (display_name)),
        comments (id, content, user_id, created_at, users:user_id (display_name))
      `)
      .eq('user_id', userId)
      .eq('is_anonymous', false)
      .order('created_at', { ascending: false })

    if (data) setStories(data || [])
    setLoading(false)
  }

  const loadChains = async (userId: string) => {
    try {
      // Only public chains are visible on someone else's profile.
      const { data } = await supabase
        .from('chains')
        .select(`
          *,
          users:started_by_user_id (id, display_name, avatar_url)
        `)
        .eq('kind', 'goal')
        .eq('started_by_user_id', userId)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })

      if (data) setCreatedChains(data as unknown as Chain[])
    } catch (error) {
      console.error('Error loading chains:', error)
    }
  }

  const loadStats = async (userId: string, isOwn: boolean) => {
    let totalCount = 0
    let completedCount = 0

    // challenge_assignments has an "own assignments only" RLS policy, so these
    // counts can only be read for the signed-in user.
    if (isOwn) {
      const { count: total } = await supabase
        .from('challenge_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      totalCount = total || 0

      const { count: completed } = await supabase
        .from('challenge_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed')
      completedCount = completed || 0
    }

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

  const isOwnProfile = user?.id === profileId

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center">
        <div className="text-warm-white/50">{t('loading')}</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center">
        <div className="text-warm-white/50">{t('profile_not_found')}</div>
      </div>
    )
  }

  // Never fall back to another user's email address: the public users table no
  // longer exposes it, and showing it would defeat the point of hiding it.
  const userName = profile.display_name || t('user')
  const userInitial = userName[0] || 'U'
  const gradient = [
    'from-coral-red to-warm-orange',
    'from-warm-orange to-soft-yellow',
    'from-kindness-green to-coral-red',
    'from-soft-yellow to-kindness-green',
    'from-coral-red to-kindness-green',
    'from-warm-orange to-kindness-green',
  ][userName.charCodeAt(0) % 6]

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark via-primary-dark to-deep-green/20 pb-24 md:pb-8">
      <Navigation />

      <main className="pt-20 md:pt-24 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <div className="flex items-center justify-between mb-8">
            <Link
              href={isOwnProfile ? '/app/profile' : '/app'}
              className="flex items-center gap-2 text-warm-white/70 hover:text-warm-white transition"
            >
              <Home size={20} />
              <span className="hidden sm:inline">{isOwnProfile ? t('my_profile') : t('back_to_feed')}</span>
            </Link>
          </div>

          {/* Profile Header */}
          <div className="text-center mb-12">
            <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${gradient} mx-auto mb-4 flex items-center justify-center text-white text-4xl font-bold`}>
              {userInitial}
            </div>
            <h1 className="text-3xl font-display font-bold text-warm-white mb-2">
              {userName}
            </h1>
            <p className="text-warm-white/60">
              {profile.bio || t('default_bio')}
            </p>
          </div>

          {/* Stats */}
          <div className={`grid gap-4 mb-12 ${isOwnProfile ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'}`}>
            {isOwnProfile && (
              <>
                <div className="card text-center">
                  <div className="text-3xl font-bold text-coral-red mb-1">
                    {stats.completedChallenges}
                  </div>
                  <div className="text-sm text-warm-white/60">
                    ❤️ {t('stat_good_deeds')}
                  </div>
                </div>

                <div className="card text-center">
                  <div className="text-3xl font-bold text-kindness-green mb-1">
                    {stats.totalChallenges}
                  </div>
                  <div className="text-sm text-warm-white/60">
                    🎯 {t('stat_challenges')}
                  </div>
                </div>
              </>
            )}

            <div className="card text-center">
              <div className="text-3xl font-bold text-warm-orange mb-1">
                {stats.activeChains}
              </div>
              <div className="text-sm text-warm-white/60">
                🔥 {t('stat_chains')}
              </div>
            </div>

            <div className="card text-center">
              <div className="text-3xl font-bold text-soft-yellow mb-1">
                {stats.peopleInspired}
              </div>
              <div className="text-sm text-warm-white/60">
                ✨ {t('stat_inspired')}
              </div>
            </div>
          </div>

          {/* Chains they started */}
          {createdChains.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl font-display font-bold text-warm-white mb-6 flex items-center gap-3">
                <span>🎯</span>
                {t('chains_i_created')}
              </h2>
              <div className="space-y-6">
                {createdChains.map((chain) => (
                  <ChainCard key={chain.id} chain={chain} showContinue={chain.status === 'active'} />
                ))}
              </div>
            </div>
          )}

          {/* Stories */}
          <div>
            <h2 className="text-2xl font-display font-bold text-warm-white mb-6">
              {isOwnProfile ? t('your_stories') : t('their_stories')}
            </h2>

            {stories.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-warm-white/50 mb-4">
                  {isOwnProfile ? t('no_stories_profile') : t('no_stories_other')}
                </p>
                {isOwnProfile && (
                  <button
                    onClick={() => router.push('/app/press')}
                    className="btn-primary"
                  >
                    {t('start_first_challenge')}
                  </button>
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
        </div>
      </main>
    </div>
  )
}