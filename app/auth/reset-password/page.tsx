'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Check, KeyRound } from 'lucide-react'
import { useLanguage, LanguageToggle } from '@/lib/LanguageContext'

type Status = 'checking' | 'ready' | 'invalid' | 'saved'

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { t } = useLanguage()

  // Supabase redirects here with a recovery session. When PKCE is in play that
  // arrives as ?code=..., which supabase-js exchanges automatically because
  // detectSessionInUrl defaults to true. We only need to confirm a session
  // actually landed before showing the form.
  useEffect(() => {
    let cancelled = false

    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (cancelled) return
        setStatus(data.session ? 'ready' : 'invalid')
      } catch {
        if (!cancelled) setStatus('invalid')
      }
    }

    checkSession()

    // Covers the case where the code exchange is still in flight.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session) setStatus('ready')
    })

    const timer = setTimeout(checkSession, 1200)

    return () => {
      cancelled = true
      clearTimeout(timer)
      sub.subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError(t('auth_password_too_short'))
      return
    }
    if (password !== confirm) {
      setError(t('auth_passwords_mismatch'))
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setStatus('saved')
      // Leave the recovery session behind rather than lingering on this page.
      setTimeout(() => router.push('/app'), 1200)
    } catch (err: any) {
      setError(err?.message || t('auth_generic_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark via-primary-dark to-deep-green/20 flex flex-col items-center justify-center px-6 py-12 relative">
      <div className="absolute top-6 right-6">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md">
        <Link href="/" className="block text-center mb-8">
          <h1 className="text-4xl font-display font-bold text-coral-red mb-2">
            {t('brand_name')}
          </h1>
          <p className="text-warm-white/60 text-sm">{t('after_press_note')}</p>
        </Link>

        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-full bg-coral-red/20 flex items-center justify-center shrink-0">
              <KeyRound size={20} className="text-coral-red" />
            </div>
            <h2 className="text-2xl font-bold text-warm-white">{t('auth_new_password_title')}</h2>
          </div>

          {status === 'checking' && (
            <div className="flex items-center gap-3 text-warm-white/60 text-sm py-4">
              <Loader2 size={18} className="animate-spin" />
              <span>{t('loading')}</span>
            </div>
          )}

          {status === 'invalid' && (
            <>
              <div className="bg-coral-red/20 border border-coral-red text-coral-red px-4 py-3 rounded-xl mb-4 text-sm">
                {t('auth_reset_link_invalid')}
              </div>
              <Link href="/auth" className="btn-primary w-full text-center inline-block">
                {t('auth_request_new_link')}
              </Link>
            </>
          )}

          {status === 'saved' && (
            <div className="bg-kindness-green/15 border border-kindness-green/50 text-warm-white px-4 py-4 rounded-xl text-sm flex items-start gap-3">
              <Check size={18} className="text-kindness-green shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">{t('auth_password_saved')}</div>
                <div className="text-warm-white/70 text-xs mt-1">{t('auth_redirecting')}</div>
              </div>
            </div>
          )}

          {status === 'ready' && (
            <>
              <p className="text-warm-white/60 text-sm mb-4">{t('auth_new_password_hint')}</p>

              {error && (
                <div className="bg-coral-red/20 border border-coral-red text-coral-red px-4 py-3 rounded-xl mb-4 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-warm-white mb-2">
                    {t('auth_new_password')}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-3 text-warm-white focus:outline-none focus:border-coral-red/50"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-warm-white mb-2">
                    {t('auth_confirm_password')}
                  </label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-3 text-warm-white focus:outline-none focus:border-coral-red/50"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-coral-red text-white px-6 py-3 rounded-xl font-semibold hover:bg-coral-red/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{t('loading')}</span>
                    </>
                  ) : (
                    <span>{t('auth_save_password')}</span>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
