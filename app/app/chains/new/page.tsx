'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Check, Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Navigation from '@/components/Navigation'
import { useLanguage } from '@/lib/LanguageContext'
import { categories } from '@/lib/challenges-data'

// useSearchParams opts the page out of static prerendering, so Next 15 requires
// a Suspense boundary around it.
export default function NewChainPage() {
  return (
    <Suspense fallback={<ChainFormFallback />}>
      <NewChainForm />
    </Suspense>
  )
}

function ChainFormFallback() {
  return (
    <div className="min-h-screen bg-primary-dark flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-warm-white/50" />
    </div>
  )
}

function NewChainForm() {
  const [user, setUser] = useState<any>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>('')
  const [goal, setGoal] = useState('')
  const [unit, setUnit] = useState('')
  const [initial, setInitial] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const router = useRouter()
  const params = useSearchParams()
  const fromChainId = params.get('from')
  const { t } = useLanguage()

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

  // "Start a similar chain" pre-fills from a completed chain, but never edits it.
  useEffect(() => {
    if (!fromChainId) return
    let cancelled = false

    const prefill = async () => {
      const { data } = await supabase
        .from('chains')
        .select('title, description, category, goal_amount, unit')
        .eq('id', fromChainId)
        .single()

      if (cancelled || !data) return
      setDescription(data.description || '')
      setCategory(data.category || '')
      setGoal(String(data.goal_amount ?? ''))
      setUnit(data.unit || '')
      setTitle('')
    }

    prefill()
    return () => { cancelled = true }
  }, [fromChainId])

  const goalNum = Number(goal)
  const initialNum = Number(initial)
  const remaining =
    Number.isFinite(goalNum) && Number.isFinite(initialNum) ? goalNum - initialNum : NaN

  // Mirrors the server-side checks so the user gets feedback before submitting.
  const validate = (): string => {
    if (title.trim().length < 3) return t('chain_err_title')
    if (!category) return t('chain_err_category')
    if (!goal || !Number.isFinite(goalNum) || goalNum <= 0) return t('chain_err_goal')
    if (!unit.trim()) return t('chain_err_unit')
    if (!initial || !Number.isFinite(initialNum) || initialNum <= 0) return t('chain_err_initial')
    if (initialNum > goalNum) return t('chain_err_over')
    return ''
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }

    setLoading(true)
    setError('')

    try {
      let imageUrl: string | null = null

      if (photoFile && user) {
        const fileExt = photoFile.name.split('.').pop() || 'jpg'
        const fileName = `chain-${user.id}-${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('story-photos')
          .upload(fileName, photoFile)
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('story-photos')
          .getPublicUrl(fileName)
        imageUrl = publicUrl
      }

      // All validation and the progress maths run inside the database.
      const { data, error: rpcError } = await supabase.rpc('create_goal_chain', {
        p_title: title.trim(),
        p_description: description.trim() || null,
        p_category: category,
        p_goal_amount: Math.floor(goalNum),
        p_unit: unit.trim(),
        p_visibility: isPrivate ? 'private' : 'public',
        p_image_url: imageUrl,
        p_initial_amount: Math.floor(initialNum),
        p_initial_message: null,
      })

      if (rpcError) throw rpcError

      setSuccess(true)
      setTimeout(() => router.push(`/app/chains/${data.chain_id}`), 1400)
    } catch (err: any) {
      setError(err?.message || t('auth_generic_error'))
    } finally {
      setLoading(false)
    }
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
        <div className="max-w-2xl mx-auto">
          <Link href="/app/chains" className="text-sm text-warm-white/60 hover:text-warm-white transition">
            {t('back_to_feed')}
          </Link>

          <h1 className="text-3xl md:text-4xl font-display font-bold text-warm-white mt-4 mb-2">
            {t('start_a_chain')}
          </h1>
          <p className="text-warm-white/60 mb-8">{t('start_a_chain_hint')}</p>

          {success ? (
            <div className="card text-center py-12">
              <div className="text-6xl mb-4">🎉</div>
              <p className="text-warm-white/80 font-semibold mb-2">{t('chain_created')}</p>
              <p className="text-warm-white/50 text-sm">{t('auth_redirecting')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card space-y-5">
              {error && (
                <div className="bg-coral-red/20 border border-coral-red text-coral-red px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-warm-white mb-2">
                  {t('chain_title_label')}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  required
                  placeholder={t('chain_title_placeholder')}
                  className="w-full bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-3 text-warm-white focus:outline-none focus:border-coral-red/50"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-warm-white mb-2">
                  {t('chain_description_label')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder={t('chain_description_placeholder')}
                  className="w-full bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-3 text-warm-white focus:outline-none focus:border-coral-red/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-warm-white mb-2">
                  {t('chain_category_label')}
                </label>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {categories.filter((c) => c.id !== 'random').map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`p-3 rounded-xl text-center transition border ${
                        category === c.id
                          ? 'border-coral-red bg-coral-red/20'
                          : 'border-warm-white/10 bg-warm-white/5 hover:bg-warm-white/10'
                      }`}
                    >
                      <div className="text-2xl mb-1">{c.emoji}</div>
                      <div className="text-[11px] text-warm-white/80">{t(`cat_${c.id.replace(/-/g, '_')}`)}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-warm-white mb-2">
                    {t('chain_goal_label')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    required
                    placeholder="100"
                    className="w-full bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-3 text-warm-white focus:outline-none focus:border-coral-red/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-warm-white mb-2">
                    {t('chain_unit_label')}
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    required
                    maxLength={24}
                    placeholder={t('chain_unit_placeholder')}
                    className="w-full bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-3 text-warm-white focus:outline-none focus:border-coral-red/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-warm-white mb-2">
                  {t('chain_initial_label')}
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={initial}
                  onChange={(e) => setInitial(e.target.value)}
                  required
                  placeholder="50"
                  className="w-full bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-3 text-warm-white focus:outline-none focus:border-coral-red/50"
                />
                {Number.isFinite(remaining) && remaining >= 0 && (
                  <p className="text-xs text-warm-white/50 mt-2">
                    {initial || 0} / {goal || 0} {unit} · {remaining} {unit} {t('chain_remaining')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-warm-white mb-2">
                  {t('add_photo')}
                </label>
                {photoPreview ? (
                  <div className="relative rounded-xl overflow-hidden mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="Preview" className="w-full h-40 object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null)
                        setPhotoPreview(null)
                      }}
                      className="absolute top-2 end-2 bg-primary-dark/80 text-white text-xs px-3 py-1.5 rounded-full"
                    >
                      {t('remove')}
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 w-full py-6 rounded-xl border border-dashed border-warm-white/20 text-warm-white/60 cursor-pointer hover:border-coral-red/50 transition">
                    <Camera size={18} />
                    <span className="text-sm">{t('add_photo')}</span>
                    <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
                  </label>
                )}
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 accent-coral-red"
                />
                <span className="text-sm text-warm-white/80">{t('chain_private_label')}</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary !py-4 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{t('loading')}</span>
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    <span>{t('create_chain')}</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
