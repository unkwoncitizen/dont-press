'use client'

import { Heart, MessageCircle, Share2, Send, Check, Loader2 } from 'lucide-react'
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

export default function StoryCard({ story, onInspire, onComment }: StoryCardProps) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>(story.comments || [])
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const [passOnFeedback, setPassOnFeedback] = useState<string | null>(null)
  const [inspiredCount, setInspiredCount] = useState(
    story.reactions?.filter((r) => r.type === 'inspired').length || 0
  )
  const [hasInspired, setHasInspired] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isTogglingInspire, setIsTogglingInspire] = useState(false)
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

      // Insert comment into Supabase
      const { data: newCommentData, error } = await supabase
        .from('comments')
        .insert({
          story_id: story.id,
          user_id: currentUser.id,
          content: trimmed,
        })
        .select(`
          id,
          content,
          user_id,
          created_at,
          users:user_id (id, display_name)
        `)
        .single()

      if (error) {
        console.error('Insert with select error:', error)
        // Attempt insert without join if foreign key relation was strict
        const { error: simpleErr } = await supabase.from('comments').insert({
          story_id: story.id,
          user_id: currentUser.id,
          content: trimmed,
        })
        if (simpleErr) throw simpleErr
      }

      // Optimistically add comment to UI
      const newCommentObj = newCommentData || {
        id: `local-${Date.now()}`,
        content: trimmed,
        user_id: currentUser.id,
        created_at: new Date().toISOString(),
        users: {
          display_name:
            currentUser.user_metadata?.display_name ||
            currentUser.email?.split('@')[0] ||
            t('user'),
        },
      }

      setComments((prev) => [...prev, newCommentObj])
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
      </div>

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
