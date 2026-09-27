'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, Check, Camera, Link2, PartyPopper, Lock, Share2,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { supabase, Chain, ChainContribution } from '@/lib/supabase'
import Navigation from '@/components/Navigation'
import { getChainProgress } from '@/components/ChainCard'
import { useLanguage } from '@/lib/LanguageContext'

const categoryEmojis: { [key: string]: string } = {
  'good-deed': '❤️',
  'help-someone': '🤝',
  community: '🌱',
  give: '💚',
  creative: '🎨',
  fun: '😂',
  'learn-share': '🧠',
}

// useSearchParams opts the page out of static prerendering, so Next 15 requires
// a Suspense boundary around it.
export default function ChainDetailPage() {
  return (
    <Suspense fallback={<ChainFallback />}>
      <ChainDetail />
    </Suspense>
  )
}

function ChainFallback() {
  return (
    <div className="min-h-screen bg-primary-dark flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-warm-white/50" />
    </div>
  )
}

function ChainDetail() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const chainId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [chain, setChain] = useState<Chain | null>(null)
  const [contributions, setContributions] = useState<ChainContribution[]>([])
  const [loading, setLoading] = useState(true)

  // Contribution form
  const [showContribute, setShowContribute] = useState(searchParams.get('contribute') === '1')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Feedback + pass-the-chain
  const [toast, setToast] = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)
  const [justContributed, setJustContributed] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const { t, language } = useLanguage()

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

  const loadChain = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('chains')
        .select(`
          *,
          users:started_by_user_id (id, display_name, avatar_url)
        `)
        .eq('id', chainId)
        .single()

      if (error) throw error
      setChain(data as Chain)

      const { data: history } = await supabase
        .from('chain_contributions')
        .select(`
          id, chain_id, user_id, amount, message, image_url, created_at,
          users:user_id (id, display_name, avatar_url)
        `)
        .eq('chain_id', chainId)
        .order('created_at', { ascending: true })

      if (history) {
        // PostgREST infers embedded relations as arrays, which does not line up
        // with the single-object `users` field on ChainContribution.
        setContributions(history as unknown as ChainContribution[])
      }
    } catch (error) {
      console.error('Error loading chain:', error)
    } finally {
      setLoading(false)
    }
  }, [chainId])

  useEffect(() => {
    loadChain()
  }, [loadChain])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3200)
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chain || !user) return

    const value = Number(amount)
    const { remaining } = getChainProgress(chain)
    const unit = chain.unit || ''

    if (!amount || !Number.isFinite(value) || value <= 0) {
      setFormError(t('chain_err_amount'))
      return
    }
    if (value > remaining) {
      setFormError(t('chain_err_too_much').replace('{n}', String(remaining)).replace('{unit}', unit))
      return
    }

    setSubmitting(true)
    setFormError('')

    try {
      let imageUrl: string | null = null

      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop() || 'jpg'
        const fileName = `contrib-${user.id}-${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('story-photos')
          .upload(fileName, photoFile)
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('story-photos')
          .getPublicUrl(fileName)
        imageUrl = publicUrl
      }

      // Validation and the progress update happen atomically in the database.
      const { data, error: rpcError } = await supabase.rpc('contribute_to_chain', {
        p_chain_id: chain.id,
        p_amount: Math.floor(value),
        p_message: message.trim() || null,
        p_image_url: imageUrl,
      })

      if (rpcError) throw rpcError

      setAmount('')
      setMessage('')
      setPhotoFile(null)
      setPhotoPreview(null)
      setShowContribute(false)
      setJustContributed(true)

      await loadChain()

      if (data?.just_completed) {
        confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } })
        showToast(t('chain_completed_toast'))
      } else {
        showToast(t('contribution_added'))
        setShowPass(true)
      }
    } catch (err: any) {
      setFormError(err?.message || t('auth_generic_error'))
    } finally {
      setSubmitting(false)
    }
  }

  // Passing is an invitation, not an ownership transfer. The chain stays public
  // and the creator stays the creator, so this only shares a link.
  const chainUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/app/chains/${chainId}`
    : ''

  const inviteText = language === 'ar'
    ? `🔥 هناك سلسلة "${chain?.title}" وتحتاج مساهمتك! أضف ما أنجزته ثم مررها للآخر:\n${chainUrl}`
    : `🔥 The chain "${chain?.title}" needs you! Add what you accomplished, then pass it on:\n${chainUrl}`

  const handlePass = async () => {
    if (!chain) return

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: chain.title || t('brand_name'),
          text: inviteText,
          url: chainUrl,
        })
        showToast(t('chain_passed_toast'))
        return
      } catch (err: any) {
        if (err?.name === 'AbortError') return
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(inviteText)
        setLinkCopied(true)
        showToast(t('chain_invite_copied'))
        setTimeout(() => setLinkCopied(false), 2500)
      } catch (err) {
        console.error('Copy failed:', err)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center">
        <div className="text-warm-white/50">{t('loading')}</div>
      </div>
    )
  }

  if (!chain) {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-warm-white/50 mb-6">{t('chain_not_found')}</p>
          <Link href="/app/chains" className="btn-primary inline-block">
            {t('chains_title')}
          </Link>
        </div>
      </div>
    )
  }

  const { goal, current, percent, remaining } = getChainProgress(chain)
  const unit = chain.unit || ''
  const isCompleted = chain.status === 'completed'
  const emoji = categoryEmojis[chain.category || ''] || '🔥'
  const isCreator = user?.id === chain.started_by_user_id
  const canContribute = !isCompleted && (chain.visibility === 'public' || isCreator)

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark via-primary-dark to-deep-green/20 pb-24 md:pb-8">
      <Navigation />

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-kindness-green text-white text-sm font-bold px-5 py-3 rounded-full shadow-lg flex items-center gap-2 animate-fade-in">
          <Check size={16} />
          <span>{toast}</span>
        </div>
      )}

      <main className="pt-20 md:pt-24 px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/app/chains" className="text-sm text-warm-white/60 hover:text-warm-white transition">
            {t('chains_title')}
          </Link>

          {/* Hero */}
          <div className="card mt-4 mb-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-coral-red/5 via-warm-orange/5 to-transparent pointer-events-none" />

            <div className="relative">
              {isCompleted && (
                <div className="bg-kindness-green/15 border border-kindness-green/50 rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-kindness-green font-bold">
                  <PartyPopper size={18} />
                  {t('chain_completed_title')}
                </div>
              )}

              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-coral-red to-warm-orange flex items-center justify-center text-4xl shrink-0 shadow-lg">
                  {emoji}
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-display font-bold text-warm-white leading-tight break-words">
                    {chain.title}
                  </h1>
                  <div className="text-sm text-warm-white/50 mt-1 flex items-center gap-2 flex-wrap">
                    <span>
                      {t('started_by')}{' '}
                      <Link
                        href={`/app/profile/${chain.started_by_user_id}`}
                        className="text-warm-white/80 font-semibold hover:text-coral-red transition"
                      >
                        @{chain.users?.display_name || t('user')}
                      </Link>
                    </span>
                    {chain.visibility === 'private' && (
                      <span className="inline-flex items-center gap-1 bg-warm-white/10 px-2 py-0.5 rounded-full">
                        <Lock size={10} />
                        {t('chain_private')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {chain.description && (
                <p className="text-warm-white/75 leading-relaxed mb-6">{chain.description}</p>
              )}

              {chain.image_url && (
                <div className="rounded-2xl overflow-hidden mb-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={chain.image_url} alt={chain.title} className="w-full h-52 object-cover" />
                </div>
              )}

              {/* Progress */}
              <div className="bg-warm-white/5 rounded-2xl p-5 border border-warm-white/10">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="font-display font-bold text-warm-white">
                    <span className="text-4xl">{current}</span>
                    <span className="text-warm-white/50 text-xl"> / {goal}</span>
                    <span className="text-warm-white/70 text-base ms-2">{unit}</span>
                  </div>
                  <div className="text-2xl font-bold text-warm-white/70">{percent}%</div>
                </div>

                <div className="w-full h-4 rounded-full bg-warm-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isCompleted
                        ? 'bg-gradient-to-r from-kindness-green to-soft-yellow'
                        : 'bg-gradient-to-r from-coral-red to-warm-orange'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="mt-3 text-sm text-warm-white/60">
                  {isCompleted ? (
                    <span className="text-kindness-green font-semibold">
                      {t('chain_completion_message').replace('{n}', String(goal)).replace('{unit}', unit)}
                    </span>
                  ) : (
                    <span>
                      <span className="font-bold text-warm-white">{remaining} {unit}</span> {t('chain_remaining')}
                    </span>
                  )}
                </div>
              </div>

              {/* Continue */}
              {!isCompleted && canContribute && !showContribute && (
                <button
                  onClick={() => setShowContribute(true)}
                  className="w-full mt-6 bg-coral-red text-white px-8 py-4 rounded-2xl font-display font-bold text-lg hover:scale-[1.02] transition-transform"
                >
                  {t('continue_the_chain')}
                </button>
              )}

              {!isCompleted && !canContribute && (
                <p className="text-center text-sm text-warm-white/40 mt-6">
                  {t('chain_private_notice')}
                </p>
              )}

              {isCompleted && (
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <Link href={`/app/chains/new?from=${chain.id}`} className="btn-primary flex-1 text-center">
                    {t('start_similar_chain')}
                  </Link>
                  <Link href="/app/chains" className="btn-secondary flex-1 text-center">
                    {t('chains_title')}
                  </Link>
                </div>
              )}

              {/* Pass the chain */}
              {(justContributed || showPass) && !isCompleted && (
                <div className="mt-6 bg-gradient-to-br from-coral-red/10 to-warm-orange/10 rounded-2xl p-5 border border-coral-red/30">
                  <h3 className="font-display font-bold text-warm-white text-lg mb-1 flex items-center gap-2">
                    🔗 {t('pass_the_chain')}
                  </h3>
                  <p className="text-sm text-warm-white/70 mb-4">{t('pass_the_chain_hint')}</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handlePass}
                      className="flex-1 bg-coral-red text-white px-6 py-3 rounded-2xl font-semibold hover:bg-coral-red/90 transition inline-flex items-center justify-center gap-2"
                    >
                      {linkCopied ? <Check size={16} /> : <Share2 size={16} />}
                      {linkCopied ? t('link_copied') : t('share_invite')}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(chainUrl)
                          setLinkCopied(true)
                          showToast(t('link_copied'))
                          setTimeout(() => setLinkCopied(false), 2500)
                        } catch { /* clipboard unavailable */ }
                      }}
                      className="btn-secondary flex-1 inline-flex items-center justify-center gap-2"
                    >
                      {linkCopied ? <Check size={16} /> : <Link2 size={16} />}
                      {t('copy_chain_link')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contribute form */}
          {showContribute && !isCompleted && canContribute && (
            <form onSubmit={handleContribute} className="card mb-6 space-y-4">
              <h2 className="text-xl font-display font-bold text-warm-white">
                {t('how_much_did_you_do')}
              </h2>

              <div className="bg-warm-white/5 rounded-xl p-3 text-sm text-warm-white/70 flex items-center justify-between">
                <span>{t('chain_progress_label')}</span>
                <span className="font-bold text-warm-white">{current} / {goal} {unit}</span>
              </div>

              {formError && (
                <div className="bg-coral-red/20 border border-coral-red text-coral-red px-4 py-3 rounded-xl text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-warm-white mb-2">
                  {t('chain_amount_label')}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    autoFocus
                    placeholder="20"
                    className="flex-1 bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-3 text-warm-white focus:outline-none focus:border-coral-red/50"
                  />
                  <span className="text-warm-white/70 font-semibold">{unit}</span>
                </div>
                <p className="text-xs text-warm-white/50 mt-2">
                  {t('adding_preview').replace('{n}', amount || '0').replace('{unit}', unit || t('chain_unit_placeholder'))}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-warm-white mb-2">
                  {t('chain_message_label')}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={t('chain_message_placeholder')}
                  className="w-full bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-3 text-warm-white focus:outline-none focus:border-coral-red/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-warm-white mb-2">
                  {t('add_photo')} <span className="text-warm-white/40 font-normal">({t('optional')})</span>
                </label>
                {photoPreview ? (
                  <div className="relative rounded-xl overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="Preview" className="w-full h-32 object-cover" />
                    <button
                      type="button"
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                      className="absolute top-2 end-2 bg-primary-dark/80 text-white text-xs px-3 py-1.5 rounded-full"
                    >
                      {t('remove')}
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 w-full py-5 rounded-xl border border-dashed border-warm-white/20 text-warm-white/60 cursor-pointer hover:border-coral-red/50 transition">
                    <Camera size={16} />
                    <span className="text-sm">{t('add_proof')}</span>
                    <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
                  </label>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowContribute(false); setFormError('') }}
                  className="btn-secondary flex-1"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{t('loading')}</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{t('confirm_contribution')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* History */}
          <div className="card">
            <h2 className="text-xl font-display font-bold text-warm-white mb-6 flex items-center gap-2">
              <span>📜</span>
              {t('chain_history')}
            </h2>

            {contributions.length === 0 ? (
              <p className="text-warm-white/50 text-sm">{t('chain_no_contributions')}</p>
            ) : (
              <div className="space-y-4">
                {contributions.map((c, i) => {
                  const name = c.users?.display_name || t('user')
                  const initial = name[0] || 'U'
                  return (
                    <div key={c.id} className="flex gap-3">
                      {/* Timeline */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-coral-red to-warm-orange flex items-center justify-center text-white text-sm font-bold">
                          {initial}
                        </div>
                        {i < contributions.length - 1 && (
                          <div className="w-0.5 flex-1 bg-warm-white/15 my-1 min-h-[24px]"></div>
                        )}
                      </div>

                      <div className="flex-1 pb-2 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                          <Link
                            href={`/app/profile/${c.user_id}`}
                            className="font-semibold text-warm-white hover:text-coral-red transition"
                          >
                            @{name}
                          </Link>
                          <span className="text-kindness-green font-bold text-sm">
                            +{c.amount} {unit}
                          </span>
                        </div>

                        {c.message && (
                          <p className="text-sm text-warm-white/75 mt-1 whitespace-pre-wrap break-words">
                            {c.message}
                          </p>
                        )}

                        {c.image_url && (
                          <div className="mt-2 rounded-xl overflow-hidden max-w-[220px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={c.image_url} alt="" className="w-full h-32 object-cover" />
                          </div>
                        )}

                        <div className="text-xs text-warm-white/35 mt-1">
                          {new Date(c.created_at).toLocaleString(
                            language === 'ar' ? 'ar-MA' : 'en-US',
                            { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {isCompleted && (
                  <div className="mt-6 pt-6 border-t border-warm-white/10 text-center">
                    <div className="text-4xl mb-2">🎉</div>
                    <p className="text-kindness-green font-semibold">
                      {t('chain_completion_message').replace('{n}', String(goal)).replace('{unit}', unit)}
                    </p>
                    <p className="text-warm-white/50 text-sm mt-1">
                      {t('chain_contributors_count').replace('{n}', String(contributions.length))}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
