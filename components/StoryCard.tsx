'use client'

import { Heart, MessageCircle, Share2, Send, Check, Loader2, Trash2, MoreHorizontal, Shield, Flag } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Story, supabase } from '@/lib/supabase'
import Image from 'next/image'
import { useLanguage } from '@/lib/LanguageContext'
import { localizeChallenge } from '@/lib/challenge-translations'
import Link from 'next/link'

interface StoryCardProps {
  story: Story
  onInspire?: (isAdding: boolean) => void
  onComment?: () => void
  /** Removes the card from the list once the story is deleted. */
  onDeleted?: (storyId: string) => void
  /** When true the viewer can moderate other people's posts too. */
  canModerate?: boolean
}

const getGradient = (name: string) => {
  const gradients = [
    'from-coral-red to-warm-orange',
    'from-warm-orange to-soft-yellow',
    'from-kindness-green to-coral-red',
    'from-soft-yellow to-kindness-green',
    'from-coral-red to-kindness-green',
    'from-warm-orange to-kindness-green',
  ]
  const index = name.charCodeAt(0) % gradients.length
  return gradients[index]
}

export default function StoryCard({ story, onInspire, onComment, onDeleted, canModerate = false }: StoryCardProps) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>(story.comments || [])
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [commentPending, setCommentPending] = useState(false)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const [passOnFeedback, setPassOnFeedback] = useState<string | null>(null)
  const [inspiredCount, setInspiredCount] = useState(
    story.reactions?.filter((r) => r.type === 'inspired').length || 0
  )
  const [hasInspired, setHasInspired] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isTogglingInspire, setIsTogglingInspire] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteRequested, setDeleteRequested] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [isReporting, setIsReporting] = useState(false)
  const [reportError, setReportError] = useState('')
  const [reportSent, setReportSent] = useState(false)
  const { t, language } = useLanguage()

  // Get current user session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null)
    })
  }, [])

  // Synchronize inspired state when story.reactions or currentUserId changes
  useEffect(() => {
    const reactions = story.reactions || []
    setInspiredCount(reactions.filter((r) => r.type === 'inspired').length)
    if (currentUserId) {
      setHasInspired(reactions.some((r) => r.type === 'inspired' && r.user_id === currentUserId))
    }
  }, [story.reactions, currentUserId])

  // Synchronize comments when story prop updates
  useEffect(() => {
    if (story.comments) {
      setComments(story.comments)
    }
  }, [story.comments])

  const categoryEmojis: { [key: string]: string } = {
    'good-deed': '❤️',
    'help-someone': '🤝',
    community: '🌱',
    give: '💚',
    creative: '🎨',
    fun: '😂',
    'learn-share': '🧠',
  }

  const getCategoryName = (cat?: string) => {
    if (!cat) return ''
    const key = `cat_${cat.replace(/-/g, '_')}`
    return t(key) || cat.replace('-', ' ')
  }

  const userName = story.is_anonymous ? t('anonymous') : story.users?.display_name || t('user')
  const userInitial = story.is_anonymous ? '?' : userName[0] || 'U'
  const gradient = getGradient(userName)
  const localizedChallenge = localizeChallenge(story.challenges, language)

  // Members no longer delete outright: they ask, and a moderator decides.
  // Moderators keep the immediate path, since they are the reviewer.
  const handleDelete = async () => {
    if (isDeleting) return
    setIsDeleting(true)
    setDeleteError('')

    try {
      if (canModerate) {
        const { error } = await supabase
          .from('stories')
          .update({ deleted_at: new Date().toISOString(), deleted_by: currentUserId })
          .eq('id', story.id)
          .is('deleted_at', null)

        if (error) throw error
        onDeleted?.(story.id)
      } else {
        const { data, error } = await supabase.rpc('request_story_deletion', {
          p_story_id: story.id,
          p_reason: deleteReason.trim() || null,
        })

        if (error) throw error

        if (data?.status === 'already_removed') {
          onDeleted?.(story.id)
        } else {
          setDeleteRequested(true)
        }
      }

      setConfirmDelete(false)
      setShowMenu(false)
      setDeleteReason('')
    } catch (err: any) {
      // Surface it: a silent failure here looks identical to "nothing happened",
      // which is exactly how this bug went unnoticed.
      console.error('Error deleting story:', err)
      setDeleteError(err?.message || t('auth_generic_error'))
    } finally {
      setIsDeleting(false)
    }
  }

  const isOwnStory = currentUserId !== null && story.user_id === currentUserId
  const canDelete = (isOwnStory || canModerate) && !deleteRequested
  // Reporting your own post makes no sense, and the database rejects it too.
  const canReport = currentUserId !== null && !isOwnStory

  const REPORT_REASONS = [
    { value: 'spam', label: t('report_reason_spam') },
    { value: 'abuse', label: t('report_reason_abuse') },
    { value: 'misinformation', label: t('report_reason_misinformation') },
    { value: 'inappropriate', label: t('report_reason_inappropriate') },
    { value: 'other', label: t('report_reason_other') },
  ]

  const handleReport = async () => {
    if (isReporting || !reportReason) return
    setIsReporting(true)
    setReportError('')

    try {
      // onConflict makes a repeat report a no-op rather than a unique
      // violation, so a double tap cannot surface an error.
      const { error } = await supabase.from('story_reports').upsert(
        {
          story_id: story.id,
          reporter_id: currentUserId,
          reason: reportReason,
          details: reportDetails.trim() || null,
        },
        { onConflict: 'story_id,reporter_id', ignoreDuplicates: true }
      )

      if (error) throw error

      setReportSent(true)
      setShowReport(false)
      setReportReason('')
      setReportDetails('')
    } catch (err: any) {
      console.error('Error reporting story:', err)
      setReportError(err?.message || t('auth_generic_error'))
    } finally {
      setIsReporting(false)
    }
  }

  const handlePostComment = async () => {
    const trimmed = commentText.trim()
    if (!trimmed || isSubmittingComment) return

    setIsSubmittingComment(true)
    setCommentError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session || !session.user) {
        setCommentError(t('sign_in_to_comment'))
        setIsSubmittingComment(false)
        return
      }

      const currentUser = session.user

      // Content check before anything is created. Comments are the easiest
      // place on the app to put something nasty under a stranger's post, so
      // they go through the same server-side check and the same signed token
      // as posts. Direct inserts into comments are revoked, so this is the only
      // way a comment gets made.
      const checkRes = await fetch('/api/moderate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ text: trimmed, photoUrl: null, contentType: 'comment' }),
      })
      const checkData = await checkRes.json()
      if (!checkRes.ok) {
        throw new Error(
          checkData?.error === 'moderation_not_configured'
            ? t('moderation_unavailable')
            : t('moderation_check_failed')
        )
      }

      const { data: commentData, error } = await supabase.rpc('submit_comment', {
        p_story_id: story.id,
        p_content: trimmed,
        p_moderation_token: checkData.token,
      })

      if (error) throw error

      // A held comment is not a failed comment. It exists and the author can
      // see it, so it is added to the list and marked, rather than being
      // treated as an error the person has to retry.
      if (commentData?.moderation_status === 'pending') {
        setComments((prev) => [
          ...prev,
          {
            id: `pending-${commentData.comment_id}`,
            content: trimmed,
            user_id: currentUser.id,
            created_at: new Date().toISOString(),
            isPending: true,
            users: {
              display_name:
                currentUser.user_metadata?.display_name ||
                currentUser.email?.split('@')[0] ||
                t('user'),
            },
          } as any,
        ])
        setCommentText('')
        setShowComments(true)
        setCommentPending(true)
        if (onComment) onComment()
        return
      }

      setComments((prev) => [
        ...prev,
        {
          id: commentData.comment_id,
          content: trimmed,
          user_id: currentUser.id,
          created_at: new Date().toISOString(),
          users: {
            display_name:
              currentUser.user_metadata?.display_name ||
              currentUser.email?.split('@')[0] ||
              t('user'),
          },
        } as any,
      ])
      setCommentText('')
      setShowComments(true)
      if (onComment) onComment()
    } catch (err: any) {
      console.error('Error posting comment:', err)
      setCommentError(err.message || 'Failed to post comment')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handlePostComment()
    }
  }

  const handleShare = async () => {
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/app/discover?story=${story.id}`
        : ''
    const shareTitle = story.title || t('brand_name')
    const shareText = `${story.content.slice(0, 100)}...`

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        })
        return
      } catch (err: any) {
        if (err.name === 'AbortError') return
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl)
        setShareFeedback(t('link_copied'))
        setTimeout(() => setShareFeedback(null), 2500)
      } catch (err) {
        console.error('Clipboard copy failed:', err)
      }
    }
  }

  const handlePassItOn = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const chainUrl = story.chain_id
      ? `${origin}/app/press?chain=${story.chain_id}`
      : `${origin}/app/press`

    const inviteMsg =
      language === 'ar'
        ? `🔥 قام شخص ما بعمل خير رائع على تطبيق "لا تضغط"! أمرر التحدي إليك الآن. اضغط على الزر وواصل السلسلة:\n${chainUrl}`
        : `🔥 Someone just completed an inspiring good deed on DON'T PRESS! I'm passing the challenge to you. Press the button and keep the chain going:\n${chainUrl}`

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: language === 'ar' ? 'مرر التحدي - لا تضغط' : "Pass It On - DON'T PRESS",
          text: inviteMsg,
          url: chainUrl,
        })
        return
      } catch (err: any) {
        if (err.name === 'AbortError') return
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(inviteMsg)
        setPassOnFeedback(t('pass_on_copied'))
        setTimeout(() => setPassOnFeedback(null), 3500)
      } catch (err) {
        console.error('Clipboard copy failed:', err)
      }
    }
  }

  const handleInspireClick = async () => {
    if (isTogglingInspire || !currentUserId) return

    const adding = !hasInspired
    setIsTogglingInspire(true)
    setHasInspired(adding)
    setInspiredCount((prev) => Math.max(0, prev + (adding ? 1 : -1)))

    try {
      if (adding) {
        const { error } = await supabase.from('reactions').insert({
          story_id: story.id,
          user_id: currentUserId,
          type: 'inspired',
        })
        if (error && error.code !== '23505') throw error // ignore duplicate
        onInspire?.(true) // trigger animation in parent
      } else {
        const { error } = await supabase
          .from('reactions')
          .delete()
          .eq('story_id', story.id)
          .eq('user_id', currentUserId)
          .eq('type', 'inspired')
        if (error) throw error
        onInspire?.(false)
      }
    } catch (err) {
      console.error('Error toggling inspire:', err)
      // rollback on error
      setHasInspired(!adding)
      setInspiredCount((prev) => Math.max(0, prev + (adding ? -1 : 1)))
    } finally {
      setIsTogglingInspire(false)
    }
  }

  return (
    <div className="card hover:shadow-xl transition-all relative">
      {/* Toast Feedback Notifications */}
      {(shareFeedback || passOnFeedback) && (
        <div className="absolute top-4 end-4 z-20 bg-warm-orange text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-fade-in">
          <Check size={14} />
          <span>{shareFeedback || passOnFeedback}</span>
        </div>
      )}

      {/* User Info */}
      <div className="flex items-center gap-3 mb-4">
        {!story.is_anonymous && story.users?.id ? (
          <Link
            href={`/app/profile/${story.users.id}`}
            className="flex items-center gap-3 group"
          >
            <div
              className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-lg shadow-lg transition-transform group-hover:scale-105`}
            >
              {userInitial}
            </div>
            <div className="flex-1">
              <div className="font-semibold group-hover:text-coral-red transition-colors">
                {userName}
              </div>
              <div className="text-sm text-warm-white/50 flex items-center gap-2">
                <span>{categoryEmojis[story.challenges?.category || ''] || '❤️'}</span>
                <span className="capitalize">{getCategoryName(story.challenges?.category)}</span>
              </div>
            </div>
          </Link>
        ) : (
          <>
            <div
              className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-lg shadow-lg`}
            >
              {userInitial}
            </div>
            <div className="flex-1">
              <div className="font-semibold">{userName}</div>
              <div className="text-sm text-warm-white/50 flex items-center gap-2">
                <span>{categoryEmojis[story.challenges?.category || ''] || '❤️'}</span>
                <span className="capitalize">{getCategoryName(story.challenges?.category)}</span>
              </div>
            </div>
          </>
        )}
        {story.chain_id && (
          <div className="text-xs bg-coral-red/20 text-coral-red px-3 py-1 rounded-full font-medium">
            🔥 {t('chain_label')} #{story.chain_id.slice(0, 6)}
          </div>
        )}

        {/* Owner / moderator / reporting controls */}
        {(canDelete || canReport || reportSent || deleteRequested) && (
          <div className="relative shrink-0">
            <button
              onClick={() => setShowMenu(!showMenu)}
              aria-label={t('post_options')}
              className="p-2 rounded-lg text-warm-white/50 hover:text-warm-white hover:bg-warm-white/5 transition"
            >
              <MoreHorizontal size={18} />
            </button>

            {showMenu && (
              <>
                {/* Click-away layer */}
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />

                <div className="absolute top-10 end-0 z-40 w-56 bg-primary-dark border border-warm-white/15 rounded-2xl p-1.5 shadow-2xl">
                  {!isOwnStory && canModerate && (
                    <div className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-warm-orange font-semibold border-b border-warm-white/10 mb-1">
                      <Shield size={11} />
                      {t('moderating')}
                    </div>
                  )}

                  {confirmDelete ? (
                    <div className="p-2 w-64">
                      <p className="text-xs text-warm-white/70 mb-2">
                        {isOwnStory && !canModerate
                          ? t('confirm_delete_own_request')
                          : isOwnStory
                          ? t('confirm_delete_own')
                          : t('confirm_delete_other')}
                      </p>

                      {deleteError && (
                        <p className="text-[11px] text-coral-red mb-2">{deleteError}</p>
                      )}

                      {isOwnStory && !canModerate && (
                        <input
                          type="text"
                          value={deleteReason}
                          onChange={(e) => setDeleteReason(e.target.value)}
                          maxLength={200}
                          placeholder={t('delete_reason_placeholder')}
                          className="w-full bg-warm-white/5 border border-warm-white/10 rounded-lg px-2.5 py-1.5 text-xs text-warm-white focus:outline-none focus:border-coral-red/50 mb-2"
                        />
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={handleDelete}
                          disabled={isDeleting}
                          className="flex-1 bg-coral-red text-white text-xs font-semibold py-2 rounded-xl hover:bg-coral-red/90 transition disabled:opacity-50"
                        >
                          {isDeleting
                            ? t('loading')
                            : isOwnStory && !canModerate
                            ? t('submit_delete_request')
                            : t('confirm_delete_yes')}
                        </button>
                        <button
                          onClick={() => {
                            setConfirmDelete(false)
                            setDeleteError('')
                          }}
                          className="flex-1 bg-warm-white/10 text-warm-white text-xs font-semibold py-2 rounded-xl hover:bg-warm-white/20 transition"
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {canDelete && (
                        <button
                          onClick={() => setConfirmDelete(true)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-coral-red hover:bg-coral-red/10 rounded-xl transition text-start"
                        >
                          <Trash2 size={15} />
                          {isOwnStory && !canModerate
                            ? t('request_delete_post')
                            : isOwnStory
                            ? t('delete_post')
                            : t('moderate_remove_post')}
                        </button>
                      )}

                      {canReport && !reportSent && (
                        <button
                          onClick={() => {
                            setShowReport(true)
                            setShowMenu(false)
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-warm-white/80 hover:bg-warm-white/10 rounded-xl transition text-start"
                        >
                          <Flag size={15} />
                          {t('report_post')}
                        </button>
                      )}

                      {reportSent && (
                        <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-kindness-green">
                          <Check size={15} />
                          {t('report_sent')}
                        </div>
                      )}

                      {deleteRequested && (
                        <div className="px-3 py-2.5">
                          <div className="flex items-center gap-2 text-sm text-soft-yellow">
                            <Loader2 size={14} className="animate-spin" />
                            {t('delete_request_pending')}
                          </div>
                          <p className="text-[11px] text-warm-white/50 mt-1 leading-relaxed">
                            {t('delete_request_pending_hint')}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Report form */}
      {showReport && canReport && (
        <div className="mb-4 p-4 rounded-2xl bg-warm-white/5 border border-warm-orange/30">
          <div className="flex items-center gap-2 mb-3">
            <Flag size={15} className="text-warm-orange" />
            <h3 className="font-semibold text-warm-white text-sm">{t('report_title')}</h3>
          </div>

          {reportError && (
            <div className="bg-coral-red/20 border border-coral-red text-coral-red px-3 py-2 rounded-xl mb-3 text-xs">
              {reportError}
            </div>
          )}

          <p className="text-xs text-warm-white/60 mb-3">{t('report_hint')}</p>

          <div className="space-y-2 mb-3">
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className="flex items-center gap-2 text-sm text-warm-white/85 cursor-pointer"
              >
                <input
                  type="radio"
                  name={`reason-${story.id}`}
                  value={r.value}
                  checked={reportReason === r.value}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-3.5 h-3.5 accent-warm-orange"
                />
                {r.label}
              </label>
            ))}
          </div>

          <textarea
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={t('report_details_placeholder')}
            className="w-full bg-warm-white/5 border border-warm-white/10 rounded-xl px-3 py-2 text-sm text-warm-white focus:outline-none focus:border-warm-orange/50 resize-none mb-3"
          />

          <div className="flex gap-2">
            <button
              onClick={handleReport}
              disabled={!reportReason || isReporting}
              className="flex-1 bg-warm-orange text-white text-xs font-semibold py-2 rounded-xl hover:bg-warm-orange/90 transition disabled:opacity-50"
            >
              {isReporting ? t('loading') : t('report_submit')}
            </button>
            <button
              onClick={() => {
                setShowReport(false)
                setReportError('')
              }}
              className="flex-1 bg-warm-white/10 text-warm-white text-xs font-semibold py-2 rounded-xl hover:bg-warm-white/20 transition"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Story Content */}
      <div className="mb-4">
        {story.title && <h3 className="text-xl font-semibold mb-2">{story.title}</h3>}
        <p className="text-warm-white/90 leading-relaxed whitespace-pre-wrap">{story.content}</p>
      </div>

      {/* Photo */}
      {story.photo_url && (
        <div className="mb-4 rounded-2xl overflow-hidden">
          <Image
            src={story.photo_url}
            alt="Story photo"
            width={800}
            height={600}
            className="w-full h-auto object-cover"
          />
        </div>
      )}

      {/* Challenge Info */}
      {story.challenges && (
        <div className="mb-4 p-4 bg-warm-white/5 rounded-xl border border-warm-white/10">
          <div className="text-sm text-warm-white/70 mb-1">{t('challenge_label')}</div>
          <div className="font-semibold">{localizedChallenge.title}</div>
          <div className="text-sm text-warm-white/60 mt-1">
            ⏱ {localizedChallenge.estimatedTime} • {localizedChallenge.difficulty}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-warm-white/10">
        <button
          onClick={handleInspireClick}
          disabled={isTogglingInspire}
          className={`flex items-center gap-2 transition group ${
            isTogglingInspire
              ? 'opacity-50 cursor-wait'
              : hasInspired
              ? 'text-kindness-green'
              : 'text-warm-white/70 hover:text-kindness-green'
          }`}
          title={t('inspire')}
        >
          <Heart
            size={20}
            className={hasInspired ? 'fill-kindness-green text-kindness-green' : 'group-hover:fill-kindness-green'}
          />
          <span className="text-sm font-semibold">
            {inspiredCount > 0 ? inspiredCount : t('inspire')}
          </span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-warm-white/70 hover:text-warm-white transition"
          title="Comments"
        >
          <MessageCircle size={20} />
          <span className="text-sm font-semibold">{comments.length}</span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-2 text-warm-white/70 hover:text-warm-orange transition ms-auto"
          title="Share"
        >
          <Share2 size={20} />
        </button>

        <button
          onClick={handlePassItOn}
          className="flex items-center gap-2 text-warm-white/70 hover:text-coral-red transition px-2.5 py-1 rounded-full hover:bg-coral-red/10"
          title={t('pass_it_on')}
        >
          <Send size={18} />
          <span className="text-sm font-semibold">{t('pass_it_on')}</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-warm-white/10">
          {/* Existing Comments */}
          {comments && comments.length > 0 && (
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-1">
              {comments.map((comment) => {
                const commentUserName = comment.users?.display_name || t('user')
                const commentGradient = getGradient(commentUserName)
                return (
                  <div key={comment.id} className="flex gap-3 items-start">
                    <div
                      className={`w-7 h-7 rounded-full bg-gradient-to-br ${commentGradient} flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5`}
                    >
                      {commentUserName[0] || 'U'}
                    </div>
                    <div className="flex-1 bg-warm-white/5 rounded-xl px-3 py-2 border border-warm-white/5">
                      <div className="text-xs font-semibold text-warm-white/90">
                        {commentUserName}
                      </div>
                      <div className="text-sm text-warm-white/80 whitespace-pre-wrap">
                        {comment.content}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add Comment Input */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder={t('add_comment_placeholder')}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSubmittingComment}
              className="flex-1 bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-2 text-sm text-warm-white placeholder-warm-white/40 focus:outline-none focus:border-coral-red/50 transition"
            />
            <button
              onClick={handlePostComment}
              disabled={isSubmittingComment || !commentText.trim()}
              className="bg-coral-red hover:bg-coral-red/90 disabled:opacity-50 text-white px-4 py-2 rounded-xl transition text-sm font-semibold flex items-center gap-1.5"
            >
              {isSubmittingComment ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{t('posting_comment')}</span>
                </>
              ) : (
                <span>{t('post_comment')}</span>
              )}
            </button>
          </div>

          {commentError && (
            <div className="text-xs text-coral-red mt-2 font-medium">
              {commentError}
            </div>
          )}

          {commentPending && !commentError && (
            <div className="text-xs text-warm-orange mt-2 font-medium">
              {t('comment_pending_notice')}
            </div>
          )}
        </div>
      )}

      {/* Time */}
      <div className="mt-4 text-xs text-warm-white/40">
        {new Date(story.created_at).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </div>
    </div>
  )
}
