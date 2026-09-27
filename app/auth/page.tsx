'use client'

import { Suspense, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useLanguage, LanguageToggle } from '@/lib/LanguageContext'

// useSearchParams opts the page out of static prerendering, so Next 15 requires
// a Suspense boundary around it.
export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-primary-dark flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-warm-white/50" />
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  )
}

function AuthForm() {
  const searchParams = useSearchParams()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [showForgot, setShowForgot] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [username, setUsername] = useState('')
  const router = useRouter()
  const { t } = useLanguage()

  // Mirrors the users_username_format CHECK constraint so the rule is visible
  // before submitting. The database remains the authority on uniqueness.
  const RESERVED = [
    'admin', 'administrator', 'root', 'support', 'help', 'system', 'mod', 'moderator',
    'official', 'team', 'staff', 'api', 'null', 'undefined', 'dontpress', 'dont_press',
    'press', 'login', 'signup', 'about', 'settings', 'security', 'account',
  ]

  const usernameError = (() => {
    const value = username.trim().toLowerCase()
    if (!value) return ''
    if (value.length < 3) return t('username_too_short')
    if (value.length > 24) return t('username_too_long')
    if (!/^[a-z0-9_]+$/.test(value)) return t('username_invalid_chars')
    if (RESERVED.includes(value)) return t('username_reserved')
    return ''
  })()

  // Supabase falls back to the project's Site URL when this is omitted, which
  // is why confirmation links must be pinned to the current origin.
  // Preserves the visitor's intent when they arrive from a category card on
  // the landing page, e.g. /auth?next=%2Fapp%2Fpress%3Fcategory%3Dcommunity
  const nextPath = searchParams.get('next')
  const safeNext =
    nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/app'

  const getRedirectTo = () => `${window.location.origin}/app`

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
      setResetSent(true)
    } catch (err: any) {
      setError(friendlyAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setPendingEmail(null)

    try {
      if (isSignUp) {
        if (usernameError) {
          setError(usernameError)
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getRedirectTo(),
            // The signup trigger reads this and writes public.users.username.
            // There is no INSERT policy on public.users, so the username can
            // only ever be set for the account being created.
            data: { username: username.trim().toLowerCase() },
          },
        })
        if (error) throw error

        // When email confirmation is disabled, signUp returns a session directly.
        if (data.session) {
          router.push(safeNext)
          return
        }

        setPendingEmail(email)
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push(safeNext)
      }
    } catch (error: any) {
      setError(friendlyAuthError(error))
    } finally {
      setLoading(false)
    }
  }

  const friendlyAuthError = (error: any): string => {
    const message: string = error?.message || ''

    if (error?.status === 429 || /rate limit|too many|security purposes/i.test(message)) {
      return t('auth_rate_limited')
    }
    if (/already registered|already been registered|user already exists/i.test(message)) {
      return t('auth_already_registered')
    }
    // A taken username surfaces as a unique violation raised by the signup
    // trigger, so it arrives with no usable wording of its own.
    if (/users_username_key|users_username_lower_key|duplicate key.*username/i.test(message)) {
      return t('username_taken')
    }
    if (/users_username_format|users_username_check/i.test(message)) {
      return t('username_invalid_chars')
    }
    if (/invalid login credentials/i.test(message)) {
      return t('auth_bad_credentials')
    }
    if (/redirect.*not allowed|invalid redirect/i.test(message)) {
      return t('auth_bad_redirect')
    }
    return message || t('auth_generic_error')
  }

  const handleGoogleAuth = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app`,
      },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark via-primary-dark to-deep-green/20 flex flex-col items-center justify-center px-6 py-12 relative">
      <div className="absolute top-6 right-6">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="block text-center mb-8">
          <h1 className="text-4xl font-display font-bold text-coral-red mb-2">
            {t('brand_name')}
          </h1>
          <p className="text-warm-white/60 text-sm">
            {t('after_press_note')}
          </p>
        </Link>

        {/* Auth Card */}
        <div className="card">
          <h2 className="text-2xl font-bold text-warm-white mb-6">
            {showForgot
              ? t('auth_forgot_title')
              : isSignUp
              ? t('auth_create')
              : t('auth_welcome')}
          </h2>

          {error && (
            <div className="bg-coral-red/20 border border-coral-red text-coral-red px-4 py-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Forgot password: request a recovery link */}
          {showForgot && (
            <>
              {resetSent ? (
                <div className="bg-kindness-green/15 border border-kindness-green/50 text-warm-white px-4 py-4 rounded-xl mb-4 text-sm">
                  <div className="font-semibold mb-1">{t('auth_reset_sent')}</div>
                  <div className="text-warm-white/70 text-xs leading-relaxed">
                    {t('auth_check_email_hint')}{' '}
                    <span className="text-warm-white font-semibold break-all">{email}</span>
                  </div>
                </div>
              ) : (
                <p className="text-warm-white/60 text-sm mb-4">{t('auth_forgot_hint')}</p>
              )}

              {!resetSent && (
                <form onSubmit={handleResetRequest} className="space-y-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-warm-white mb-2">
                      {t('auth_email')}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="w-full bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-3 text-warm-white focus:outline-none focus:border-coral-red/50"
                      placeholder="your@email.com"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-coral-red text-white px-6 py-3 rounded-xl font-semibold hover:bg-coral-red/90 transition disabled:opacity-50"
                  >
                    {loading ? t('loading') : t('auth_send_reset')}
                  </button>
                </form>
              )}

              <button
                onClick={() => {
                  setShowForgot(false)
                  setResetSent(false)
                  setError('')
                }}
                className="text-sm text-coral-red font-semibold hover:underline"
              >
                {t('auth_back_to_signin')}
              </button>
            </>
          )}

          {pendingEmail && (
            <div className="bg-kindness-green/15 border border-kindness-green/50 text-warm-white px-4 py-4 rounded-xl mb-4 text-sm">
              <div className="font-semibold mb-1">{t('auth_check_email')}</div>
              <div className="text-warm-white/70 text-xs leading-relaxed">
                {t('auth_check_email_hint')}{' '}
                <span className="text-warm-white font-semibold break-all">{pendingEmail}</span>
              </div>
              <button
                onClick={() => {
                  setPendingEmail(null)
                  setIsSignUp(false)
                  setError('')
                }}
                className="mt-3 text-xs text-coral-red font-semibold hover:underline"
              >
                {t('auth_back_to_signin')}
              </button>
            </div>
          )}

          {/* Email/Password Form */}
          {!pendingEmail && !showForgot && (
          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-warm-white mb-2">
                {t('auth_email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-3 text-warm-white focus:outline-none focus:border-coral-red/50"
                placeholder="your@email.com"
              />
            </div>

            {isSignUp && (
              <div>
                <label className="block text-sm font-semibold text-warm-white mb-2">
                  {t('auth_username')}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-warm-white/40 font-mono">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    required
                    minLength={3}
                    maxLength={24}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    dir="ltr"
                    placeholder="ahmed"
                    className="flex-1 bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-3 text-warm-white focus:outline-none focus:border-coral-red/50"
                  />
                </div>
                {usernameError ? (
                  <p className="text-xs text-coral-red mt-1.5">{usernameError}</p>
                ) : (
                  <p className="text-xs text-warm-white/40 mt-1.5">
                    {t('auth_username_hint')}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-warm-white mb-2">
                {t('auth_password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-3 text-warm-white focus:outline-none focus:border-coral-red/50"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-coral-red text-white px-6 py-3 rounded-xl font-semibold hover:bg-coral-red/90 transition disabled:opacity-50"
            >
              {loading ? t('loading') : isSignUp ? t('nav_signup') : t('nav_signin')}
            </button>

            {!isSignUp && (
              <button
                type="button"
                onClick={() => {
                  setShowForgot(true)
                  setError('')
                }}
                className="w-full text-center text-sm text-warm-white/50 hover:text-coral-red transition"
              >
                {t('auth_forgot_link')}
              </button>
            )}
          </form>
          )}

          {/* Divider */}
          {!pendingEmail && !showForgot && (
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-warm-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-warm-white/5 text-warm-white/50">
                {t('auth_or_continue')}
              </span>
            </div>
          </div>
          )}

          {/* Social Auth */}
          {!pendingEmail && !showForgot && (
          <button
            onClick={handleGoogleAuth}
            className="w-full bg-warm-white text-primary-dark px-6 py-3 rounded-xl font-semibold hover:bg-warm-white/90 transition flex items-center justify-center gap-2 mb-4"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </button>
          )}

          {/* Toggle Sign In/Up */}
          {!pendingEmail && !showForgot && (
          <div className="text-center text-sm text-warm-white/60">
            {isSignUp ? t('auth_have_account') : t('auth_no_account')}{' '}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError('')
              }}
              className="text-coral-red font-semibold hover:underline"
            >
              {isSignUp ? t('nav_signin') : t('nav_signup')}
            </button>
          </div>
          )}
        </div>

        {/* Age Notice */}
        <p className="text-center text-xs text-warm-white/40 mt-6">
          {t('auth_age_notice')}
        </p>
      </div>
    </div>
  )
}
