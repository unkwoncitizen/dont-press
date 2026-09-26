'use client'

import { Heart, MessageCircle, Share2, Send } from 'lucide-react'
import { useState } from 'react'
import { Story } from '@/lib/supabase'
import Image from 'next/image'

interface StoryCardProps {
  story: Story
  onInspire?: () => void
  onComment?: () => void
}

export default function StoryCard({ story, onInspire, onComment }: StoryCardProps) {
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')

  const reactionCounts = {
    inspired: story.reactions?.filter(r => r.type === 'inspired').length || 0,
    total: story.reactions?.length || 0,
  }

  const categoryEmojis: { [key: string]: string } = {
    'good-deed': '❤️',
    'help-someone': '🤝',
    'community': '🌱',
    'give': '💚',
    'creative': '🎨',
    'fun': '😂',
    'learn-share': '🧠',
  }

  return (
    <div className="card hover:shadow-xl transition-all">
      {/* User Info */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-coral-red to-warm-orange flex items-center justify-center text-white font-bold">
          {story.is_anonymous ? '?' : (story.users?.display_name?.[0] || story.users?.email?.[0] || 'U')}
        </div>
        <div className="flex-1">
          <div className="font-semibold">
            {story.is_anonymous ? 'Anonymous' : (story.users?.display_name || 'User')}
          </div>
          <div className="text-sm text-warm-white/50 flex items-center gap-2">
            <span>{categoryEmojis[story.challenges?.category || ''] || '❤️'}</span>
            <span className="capitalize">{story.challenges?.category?.replace('-', ' ')}</span>
          </div>
        </div>
        {story.chain_id && (
          <div className="text-xs bg-coral-red/20 text-coral-red px-3 py-1 rounded-full">
            🔥 Chain #{story.chain_id.slice(0, 6)}
          </div>
        )}
      </div>

      {/* Story Content */}
      <div className="mb-4">
        {story.title && (
          <h3 className="text-xl font-semibold mb-2">{story.title}</h3>
        )}
        <p className="text-warm-white/90 leading-relaxed whitespace-pre-wrap">
          {story.content}
        </p>
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
          <div className="text-sm text-warm-white/70 mb-1">Challenge</div>
          <div className="font-semibold">{story.challenges.title}</div>
          <div className="text-sm text-warm-white/60 mt-1">
            ⏱ {story.challenges.estimated_time} • {story.challenges.difficulty}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-4 border-t border-warm-white/10">
        <button
          onClick={onInspire}
          className="flex items-center gap-2 text-warm-white/70 hover:text-kindness-green transition group"
        >
          <Heart size={20} className="group-hover:fill-kindness-green" />
          <span className="text-sm font-semibold">
            {reactionCounts.inspired > 0 ? reactionCounts.inspired : 'Inspire'}
          </span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-warm-white/70 hover:text-warm-white transition"
        >
          <MessageCircle size={20} />
          <span className="text-sm font-semibold">
            {story.comments?.length || 0}
          </span>
        </button>

        <button className="flex items-center gap-2 text-warm-white/70 hover:text-warm-white transition ml-auto">
          <Share2 size={20} />
        </button>

        <button className="flex items-center gap-2 text-warm-white/70 hover:text-coral-red transition">
          <Send size={20} />
          <span className="text-sm font-semibold">Pass it on</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-warm-white/10">
          {/* Existing Comments */}
          {story.comments && story.comments.length > 0 && (
            <div className="space-y-3 mb-4">
              {story.comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-warm-orange to-soft-yellow flex items-center justify-center text-white text-sm font-bold">
                    {comment.users?.display_name?.[0] || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">
                      {comment.users?.display_name || 'User'}
                    </div>
                    <div className="text-sm text-warm-white/80">
                      {comment.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Comment */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 bg-warm-white/5 border border-warm-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-coral-red/50"
            />
            <button
              onClick={onComment}
              className="bg-coral-red text-white px-4 py-2 rounded-xl hover:bg-coral-red/90 transition"
            >
              Post
            </button>
          </div>
        </div>
      )}

      {/* Time */}
      <div className="mt-4 text-xs text-warm-white/40">
        {new Date(story.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </div>
    </div>
  )
}
