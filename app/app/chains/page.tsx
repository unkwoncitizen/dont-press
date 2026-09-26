'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'

export default function ChainsPage() {
  const [user, setUser] = useState<any>(null)
  const [chains, setChains] = useState<any[]>([])
  const router = useRouter()

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
        <div className="text-warm-white/50">Loading...</div>
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
              Your Chains
            </h1>
            <p className="text-warm-white/60 text-lg">
              Every good deed can start a chain reaction
            </p>
          </div>

          {chains.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-6xl mb-4">🔥</div>
              <p className="text-warm-white/50 mb-4">
                Your first chain could start here.
              </p>
              <button
                onClick={() => router.push('/app/press')}
                className="btn-primary"
              >
                Start a chain
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {chains.map((chainNode) => (
                <div key={chainNode.id} className="card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-coral-red to-warm-orange flex items-center justify-center text-white text-xl">
                        🔥
                      </div>
                      <div>
                        <div className="font-bold text-warm-white">
                          Chain #{chainNode.chain_id.slice(0, 8)}
                        </div>
                        <div className="text-sm text-warm-white/60">
                          Position #{chainNode.position}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-coral-red">
                        {chainNode.chains?.length || 1}
                      </div>
                      <div className="text-xs text-warm-white/50">
                        people in chain
                      </div>
                    </div>
                  </div>

                  {chainNode.stories && (
                    <div className="bg-warm-white/5 rounded-xl p-4 border border-warm-white/10">
                      <p className="text-sm text-warm-white/80">
                        {chainNode.stories.content.slice(0, 150)}
                        {chainNode.stories.content.length > 150 ? '...' : ''}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 text-xs text-warm-white/40">
                    {new Date(chainNode.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
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
