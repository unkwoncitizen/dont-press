'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Navigation from '@/components/Navigation'
import { Camera, Upload } from 'lucide-react'
import confetti from 'canvas-confetti'
import { useLanguage } from '@/lib/LanguageContext'
import { localizeChallenge } from '@/lib/challenge-translations'

export default function CompletePage() {
  // Read the assignment id via the client hook rather than the `params` prop.
  // Next 15 made `params` a Promise, which a client component cannot await during render.
  const params = useParams<{ id: string }>()
  const [user, setUser] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [assignment, setAssignment] = useState<any>(null)
  const [challenge, setChallenge] = useState<any>(null)
  const [storyContent, setStoryContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [heldForReview, setHeldForReview] = useState(false)
  const router = useRouter()
  const { t, language } = useLanguage()
  const localizedChallenge = localizeChallenge(challenge, language)

  const loadAssignment = useCallback(async () => {
    const assignmentId = params?.id
    if (!assignmentId) return

    const { data: assignmentData, error: assignmentError } = await supabase
      .from('challenge_assignments')
      .select(`
        *,
        challenges (*)
      `)
      .eq('id', assignmentId)
      .single()

    if (assignmentError) {
      console.error('Error loading assignment:', assignmentError)
      return
    }

    setAssignment(assignmentData)
    setChallenge(assignmentData.challenges)
  }, [params])

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth')
        return
      }
      setUser(session.user)
      // The access token is needed to call the server-side content check.
      setSession(session)
      loadAssignment()
    }
    checkUser()
  }, [router, loadAssignment])

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !assignment || !storyContent.trim()) return

    setLoading(true)

    try {
      let photoUrl = null

      // Upload photo if provided
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${fileExt}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('story-photos')
          .upload(fileName, photoFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('story-photos')
          .getPublicUrl(fileName)

        photoUrl = publicUrl
      }

      // Content check before anything is created. Runs on the server so the
      // verdict cannot be forged, and hands back a signed token that
      // submit_story() verifies. Direct inserts into stories are revoked, so
      // this call is the only way a post gets made.
      const checkRes = await fetch('/api/moderate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ text: storyContent, photoUrl }),
      })
      const checkData = await checkRes.json()
      if (!checkRes.ok) {
        throw new Error(
          checkData?.error === 'moderation_not_configured'
            ? t('moderation_unavailable')
            : t('moderation_check_failed')
        )
      }

      // Create story
      const { data: storyData, error: storyError } = await supabase.rpc('submit_story', {
        p_content: storyContent,
        p_challenge_id: challenge.id,
        p_assignment_id: assignment.id,
        p_photo_url: photoUrl,
        p_is_anonymous: isAnonymous,
        p_moderation_token: checkData.token,
      })

      if (storyError) throw storyError

      // Update assignment status
      await supabase
        .from('challenge_assignments')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', assignment.id)

      // A post held for review is not a failed post. It exists, it is just not
      // in the feed yet, so it gets an honest message instead of confetti that
      // implies it is already live.
      if (storyData?.moderation_status === 'pending') {
        setHeldForReview(true)
        return
      }

      // 🎉 CELEBRATE WITH CONFETTI!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      })

      // Wait a moment, then redirect
      setTimeout(() => {
        router.push('/app')
      }, 1500)
    } catch (error: any) {
      console.error('Error submitting story:', error)
      // Surfaced, not alerted: an alert is easy to miss and a silent failure
      // here looks identical to "nothing happened".
      setSubmitError(error?.message || t('auth_generic_error'))
    } finally {
      setLoading(false)
    }
  }

  if (heldForReview) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark via-primary-dark to-deep-green/20 flex items-center justify-center px-6">
        <Navigation />
        <div className="card text-center max-w-md">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-xl font-display font-bold text-warm-white mb-2">
            {t('post_pending_title')}
          </h1>
          <p className="text-warm-white/60 text-sm mb-6">{t('post_pending_body')}</p>
          <Link href="/app" className="btn-primary inline-block">
            {t('nav_home')}
          </Link>
        </div>
      </div>
    )
  }

  if (!assignment || !challenge) {
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
        <div className="max-w-3xl mx-auto">
          {/* Success Message */}
          <div className="text-center mb-12">
            <div className="text-6xl mb-4">❤️</div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-warm-white mb-4">
              {t('you_did_it')}
            </h1>
            <p className="text-warm-white/60 text-lg">
              {t('now_tell_story')}
            </p>
          </div>

          {/* Challenge Reminder */}
          <div className="card mb-8">
            <div className="text-sm text-warm-white/50 mb-2">{t('challenge_label')}</div>
            <h2 className="text-2xl font-bold text-warm-white mb-2">
              {localizedChallenge.title}
            </h2>
            <p className="text-warm-white/70">{localizedChallenge.description}</p>
          </div>

          {/* Story Form */}
          <form onSubmit={handleSubmit} className="card">
            <h3 className="text-xl font-bold text-warm-white mb-6">
              {t('share_experience')}
            </h3>

            {submitError && (
              <div className="bg-coral-red/20 border border-coral-red text-coral-red px-4 py-3 rounded-xl text-sm mb-5">
                {submitError}
              </div>
            )}

            {/* Story Content */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-warm-white mb-2">
                {t('what_happened')}
              </label>
              <textarea
                value={storyContent}
                onChange={(e) => setStoryContent(e.target.value)}
                required
                rows={6}
                placeholder={t('story_placeholder')}
                className="w-full bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-3 text-warm-white focus:outline-none focus:border-coral-red/50 resize-none"
              />
              <p className="text-xs text-warm-white/40 mt-2">
                {t('story_hint')}
              </p>
            </div>

            {/* Photo Upload */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-warm-white mb-3">
                {t('add_photo')}
              </label>

              {photoPreview ? (
                <div className="relative rounded-xl overflow-hidden mb-3">
                  {/* Local preview from FileReader.readAsDataURL. next/image
                      cannot optimize data: URLs, so <img> is correct here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Preview" className="w-full h-auto" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null)
                      setPhotoPreview(null)
                    }}
                    className="absolute top-3 right-3 bg-coral-red text-white px-3 py-1 rounded-lg text-sm hover:bg-coral-red/90 font-medium"
                  >
                    {t('remove')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center gap-2 bg-warm-white/5 border border-warm-white/10 rounded-xl p-6 cursor-pointer hover:bg-warm-white/10 transition">
                    <Camera size={32} className="text-warm-white/50" />
                    <span className="text-sm text-warm-white/70">{t('camera')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>

                  <label className="flex flex-col items-center justify-center gap-2 bg-warm-white/5 border border-warm-white/10 rounded-xl p-6 cursor-pointer hover:bg-warm-white/10 transition">
                    <Upload size={32} className="text-warm-white/50" />
                    <span className="text-sm text-warm-white/70">{t('upload')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              <p className="text-xs text-warm-white/40 mt-2">
                {t('photo_safety_tip')}
              </p>
            </div>

            {/* Anonymous Option */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-5 h-5 rounded border-warm-white/20 bg-warm-white/5 checked:bg-coral-red"
                />
                <span className="text-sm text-warm-white">
                  {t('post_anonymously')}
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !storyContent.trim()}
              className="w-full bg-coral-red text-white px-8 py-4 rounded-2xl font-display font-bold text-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? t('publishing') : t('publish_story')}
            </button>

            <p className="text-xs text-warm-white/40 text-center mt-4">
              {t('story_inspires_note')}
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}
