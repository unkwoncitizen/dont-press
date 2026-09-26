'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { useLanguage } from '@/lib/LanguageContext'

export default function ChainsPage() {
  const [user, setUser] = useState<any>(null)
  const [chains, setChains] = useState<any[]>([])
  const router = useRouter()
  const { t, language } = useLanguage()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth')
        return
      }
      setUser(session.user)
      loadChains(session.user.id)
    }
    checkUser()
  }, [router])

  const loadChains = async (userId: string) => {
    const { data, error } = await supabase
      .from('chain_nodes')
      .select(`
        *,
        chains (id, started_at, length),
        stories (id, content, created_at)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (data) setChains(data || [])
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
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-display font-bold text-warm-white mb-4">
              {t('your_chains')}
            </h1>
            <p className="text-warm-white/60 text-lg">
              {t('chains_subtitle')}
            </p>
          </div>

          {chains.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-6xl mb-4">🔥</div>
              <p className="text-warm-white/50 mb-4">
                {t('first_chain_start')}
              </p>
              <button
                onClick={() => router.push('/app/press')}
                className="btn-primary"
              >
                {t('start_a_chain')}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {chains.map((chainNode) => (
                <div key={chainNode.id} className="card relative overflow-hidden">
                  {/* Background flame effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-coral-red/5 via-warm-orange/5 to-transparent pointer-events-none"></div>

                  <div className="relative">
                    {/* Chain Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        {/* Animated Fire Icon */}
                        <div className="relative">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-coral-red to-warm-orange flex items-center justify-center text-white text-3xl shadow-lg animate-pulse">
                            🔥
                          </div>
                          <div className="absolute -inset-2 bg-gradient-to-br from-coral-red/20 to-warm-orange/20 rounded-full animate-ping"></div>
                        </div>

                        <div>
                          <div className="font-display font-bold text-warm-white text-xl mb-1">
                            {t('chain_number')}{chainNode.chain_id.slice(0, 8)}
                          </div>
                          <div className="text-sm text-warm-white/60 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 bg-warm-orange/20 text-warm-orange px-2 py-1 rounded-full text-xs font-semibold">
                              <span>📍</span>
                              {t('position_number')}{chainNode.position}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Chain Length */}
                      <div className="text-right">
                        <div className="text-3xl font-bold bg-gradient-to-br from-coral-red to-warm-orange bg-clip-text text-transparent">
                          {chainNode.chains?.length || 1}
                        </div>
                        <div className="text-xs text-warm-white/50 font-semibold">
                          {t('people_in_chain')}
                        </div>
                      </div>
                    </div>

                    {/* Visual Chain Link */}
                    <div className="mb-6 flex items-center gap-2">
                      {[...Array(Math.min(chainNode.position, 5))].map((_, i) => (
                        <div key={i} className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-kindness-green to-coral-red flex items-center justify-center text-white text-xs font-bold shadow-md">
                            {i + 1}
                          </div>
                          {i < Math.min(chainNode.position, 5) - 1 && (
                            <div className="w-4 h-1 bg-gradient-to-r from-kindness-green to-coral-red"></div>
                          )}
                        </div>
                      ))}
                      {chainNode.position > 5 && (
                        <>
                          <div className="text-warm-white/40 text-xs font-bold">...</div>
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-soft-yellow to-coral-red flex items-center justify-center text-white text-xs font-bold shadow-md border-2 border-warm-white/20">
                            {chainNode.position}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Story Preview */}
                    {chainNode.stories && (
                      <div className="bg-gradient-to-br from-warm-white/10 to-warm-white/5 rounded-2xl p-4 border border-warm-white/10 backdrop-blur-sm">
                        <div className="text-xs text-warm-white/50 mb-2 font-semibold">{t('your_contribution')}</div>
                        <p className="text-sm text-warm-white/90 leading-relaxed">
                          {chainNode.stories.content.slice(0, 150)}
                          {chainNode.stories.content.length > 150 ? '...' : ''}
                        </p>
                      </div>
                    )}

                    {/* Chain Stats */}
                    <div className="mt-6 flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1 text-warm-white/50">
                        <span>🌟</span>
                        <span>{t('keep_it_going')}</span>
                      </div>
                      <div className="flex items-center gap-1 text-warm-white/40 ms-auto">
                        <span>📅</span>
                        <span>
                          {new Date(chainNode.created_at).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
