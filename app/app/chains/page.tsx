'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Compass, Award } from 'lucide-react'
import { supabase, Chain } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import ChainCard from '@/components/ChainCard'
import { useLanguage } from '@/lib/LanguageContext'

type Tab = 'discover' | 'mine'

export default function ChainsPage() {
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState<Tab>('discover')
  const [chains, setChains] = useState<Chain[]>([])
  const [created, setCreated] = useState<Chain[]>([])
  const [joined, setJoined] = useState<Chain[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const router = useRouter()
  const { t } = useLanguage()

  // Public chains that still need contributions come first.
  const loadChains = useCallback(async () => {    try {
      const { data, error } = await supabase
        .from('chains')
        .select(`
          *,
          users:started_by_user_id (id, display_name, avatar_url)
        `)
        .eq('kind', 'goal')
        .eq('visibility', 'public')
        .eq('status', 'active')
        // chains has no created_at. The column is started_at, and ordering by
        // the wrong one makes PostgREST reject the whole query, which is what
        // made this page look permanently empty.
        .order('started_at', { ascending: false })
        .limit(30)

      if (error) throw error
      setChains(data || [])
      setLoadError(null)
    } catch (error: any) {
      // Surfaced rather than swallowed: a failing query and a genuinely empty
      // list look identical on screen, and that is how this hid for so long.
      console.error('Error loading chains:', error)
      setLoadError(error?.message || 'Could not load chains')
    }
  }, [])

  const loadMine = useCallback(async (userId: string) => {
    try {
      const select = `
        *,
        users:started_by_user_id (id, display_name, avatar_url)
      `

      const [createdRes, contributionsRes] = await Promise.all([
        supabase
          .from('chains')
          .select(select)
          .eq('kind', 'goal')
          .eq('started_by_user_id', userId)
          .order('started_at', { ascending: false }),

        supabase
          .from('chain_contributions')
          .select(`
            chain_id,
            chains (
              *,
              users:started_by_user_id (id, display_name, avatar_url)
            )
          `)
          .eq('user_id', userId),
      ])

      if (createdRes.error) throw createdRes.error
      if (contributionsRes.error) throw contributionsRes.error
      if (createdRes.data) setCreated(createdRes.data as Chain[])

      if (contributionsRes.data) {
        // A contribution can repeat across chains, and the creator already has
        // their chains listed above, so de-duplicate and drop self-created.
        const seen = new Set<string>()
        const list: Chain[] = []
        for (const row of contributionsRes.data as any[]) {
          const c = row.chains as Chain | null
          if (!c || seen.has(c.id)) continue
          if (c.started_by_user_id === userId) continue
          seen.add(c.id)
          list.push(c)
        }
        setJoined(list)
      }
      setLoadError(null)
    } catch (error: any) {
      console.error('Error loading my chains:', error)
      setLoadError(error?.message || 'Could not load your chains')
    }
  }, [])

  // Declared after the loaders above so the dependency array below does not
  // reference them before they are initialised.
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth')
        return
      }
      setUser(session.user)
      await Promise.all([loadChains(), loadMine(session.user.id)])
      setLoading(false)
    }
    checkUser()
  }, [router, loadChains, loadMine])

  if (!user || loading) {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center">
        <div className="text-warm-white/50">{t('loading')}</div>
      </div>
    )
  }

  const emptyState = (
    <div className="card text-center py-12">
      <div className="text-6xl mb-4">🔥</div>
      <p className="text-warm-white/50 mb-2">{t('no_active_chains')}</p>
      <p className="text-warm-white/40 text-sm mb-6">{t('be_first_link')}</p>
      <Link href="/app/chains/new" className="btn-primary inline-block">
        {t('start_a_chain')}
      </Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark via-primary-dark to-deep-green/20 pb-24 md:pb-8">
      <Navigation />

      <main className="pt-20 md:pt-24 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-display font-bold text-warm-white mb-4">
              {t('chains_title')}
            </h1>
            <p className="text-warm-white/60 text-lg mb-8">{t('chains_subtitle_goal')}</p>

            <Link href="/app/chains/new" className="btn-primary inline-flex items-center gap-2">
              <Plus size={18} />
              {t('start_a_chain')}
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto">
            <button
              onClick={() => setTab('discover')}
              className={`px-6 py-3 rounded-2xl font-semibold transition whitespace-nowrap inline-flex items-center gap-2 ${
                tab === 'discover'
                  ? 'bg-coral-red text-white'
                  : 'bg-warm-white/10 text-warm-white hover:bg-warm-white/20'
              }`}
            >
              <Compass size={16} />
              {t('tab_discover_chains')}
            </button>
            <button
              onClick={() => setTab('mine')}
              className={`px-6 py-3 rounded-2xl font-semibold transition whitespace-nowrap inline-flex items-center gap-2 ${
                tab === 'mine'
                  ? 'bg-coral-red text-white'
                  : 'bg-warm-white/10 text-warm-white hover:bg-warm-white/20'
              }`}
            >
              <Award size={16} />
              {t('tab_my_chains')}
            </button>
          </div>

          {loadError ? (
            <div className="card border-coral-red/30 bg-coral-red/5 text-center py-8">
              <p className="text-coral-red font-semibold mb-2">Could not load chains</p>
              <p className="text-warm-white/50 text-sm break-words">{loadError}</p>
            </div>
          ) : tab === 'discover' ? (
            chains.length === 0 ? (
              emptyState
            ) : (
              <div className="space-y-6">
                {chains.map((chain) => (
                  <ChainCard key={chain.id} chain={chain} showContinue />
                ))}
              </div>
            )
          ) : (
            <div className="space-y-10">
              <section>
                <h2 className="text-xl font-display font-bold text-warm-white mb-4 flex items-center gap-2">
                  <span>🎯</span>
                  {t('chains_i_created')}
                </h2>
                {created.length === 0 ? (
                  <div className="card text-center py-8">
                    <p className="text-warm-white/50 text-sm mb-4">{t('no_created_chains')}</p>
                    <Link href="/app/chains/new" className="btn-primary text-sm inline-block">
                      {t('start_a_chain')}
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {created.map((chain) => (
                      <ChainCard key={chain.id} chain={chain} />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h2 className="text-xl font-display font-bold text-warm-white mb-4 flex items-center gap-2">
                  <span>🤝</span>
                  {t('chains_i_joined')}
                </h2>
                {joined.length === 0 ? (
                  <div className="card text-center py-8">
                    <p className="text-warm-white/50 text-sm mb-4">{t('no_joined_chains')}</p>
                    <button
                      onClick={() => setTab('discover')}
                      className="btn-secondary text-sm inline-block"
                    >
                      {t('tab_discover_chains')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {joined.map((chain) => (
                      <ChainCard key={chain.id} chain={chain} showContinue={chain.status === 'active'} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
