'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { Camera, Upload } from 'lucide-react'

export default function CompletePage({ params }: { params: { id: string } }) {
  const [user, setUser] = useState<any>(null)
  const [assignment, setAssignment] = useState<any>(null)
  const [challenge, setChallenge] = useState<any>(null)
  const [storyContent, setStoryContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth')
        return
      }
      setUser(session.user)
      loadAssignment()
    }
    checkUser()
  }, [])

  const loadAssignment = async () => {
    const { data: assignmentData, error: assignmentError } = await supabase
      .from('challenge_assignments')
      .select(`
        *,
        challenges (*)
      `)
      .eq('id', params.id)
      .single()

    if (assignmentError) {
      console.error('Error loading assignment:', assignmentError)
      return
    }

    setAssignment(assignmentData)
    setChallenge(assignmentData.challenges)
  }

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

      // Create story
      const { data: storyData, error: storyError } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          challenge_id: challenge.id,
          assignment_id: assignment.id,
          content: storyContent,
          photo_url: photoUrl,
          is_anonymous: isAnonymous,
        })
        .select()
        .single()

      if (storyError) throw storyError

      // Update assignment status
      await supabase
        .from('challenge_assignments')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', assignment.id)

      // Redirect to story view or feed
      router.push('/app')
    } catch (error) {
      console.error('Error submitting story:', error)
      alert('Error submitting story. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!assignment || !challenge) {
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
        <div className="max-w-3xl mx-auto">
          {/* Success Message */}
          <div className="text-center mb-12">
            <div className="text-6xl mb-4">❤️</div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-warm-white mb-4">
              You did it!
            </h1>
            <p className="text-warm-white/60 text-lg">
              Now tell your story
            </p>
          </div>

          {/* Challenge Reminder */}
          <div className="card mb-8">
            <div className="text-sm text-warm-white/50 mb-2">Your Challenge</div>
            <h2 className="text-2xl font-bold text-warm-white mb-2">
              {challenge.title}
            </h2>
            <p className="text-warm-white/70">{challenge.description}</p>
          </div>

          {/* Story Form */}
          <form onSubmit={handleSubmit} className="card">
            <h3 className="text-xl font-bold text-warm-white mb-6">
              Share your experience
            </h3>

            {/* Story Content */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-warm-white mb-2">
                What happened? *
              </label>
              <textarea
                value={storyContent}
                onChange={(e) => setStoryContent(e.target.value)}
                required
                rows={6}
                placeholder="Tell your story... What did you do? How did it go? What happened afterward?"
                className="w-full bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-3 text-warm-white focus:outline-none focus:border-coral-red/50 resize-none"
              />
              <p className="text-xs text-warm-white/40 mt-2">
                Share the details that made this moment special
              </p>
            </div>

            {/* Photo Upload */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-warm-white mb-3">
                Add a photo (optional)
              </label>

              {photoPreview ? (
                <div className="relative rounded-xl overflow-hidden mb-3">
                  <img src={photoPreview} alt="Preview" className="w-full h-auto" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null)
                      setPhotoPreview(null)
                    }}
                    className="absolute top-3 right-3 bg-coral-red text-white px-3 py-1 rounded-lg text-sm hover:bg-coral-red/90"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center gap-2 bg-warm-white/5 border border-warm-white/10 rounded-xl p-6 cursor-pointer hover:bg-warm-white/10 transition">
                    <Camera size={32} className="text-warm-white/50" />
                    <span className="text-sm text-warm-white/70">Camera</span>
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
                    <span className="text-sm text-warm-white/70">Upload</span>
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
                💡 Remember: Never photograph people without their permission
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
                  Post anonymously (your name won't be shown)
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !storyContent.trim()}
              className="w-full bg-coral-red text-white px-8 py-4 rounded-2xl font-display font-bold text-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? 'Publishing...' : 'Publish Your Story'}
            </button>

            <p className="text-xs text-warm-white/40 text-center mt-4">
              Your story will inspire others to do good
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}
