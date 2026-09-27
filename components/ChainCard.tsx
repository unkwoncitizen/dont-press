'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lock, Users, Image as ImageIcon } from 'lucide-react'
import { Chain } from '@/lib/supabase'
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

interface ChainCardProps {
  chain: Chain
  /** Shown on discovery cards where continuing is the primary action. */
  showContinue?: boolean
}

export function getChainProgress(chain: Chain) {
  const goal = chain.goal_amount ?? 0
  const current = chain.current_amount ?? 0
  const percent = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0
  return { goal, current, percent, remaining: Math.max(0, goal - current) }
}

export default function ChainCard({ chain, showContinue = false }: ChainCardProps) {
  const { t, language } = useLanguage()
  const [imgFailed, setImgFailed] = useState(false)

  const { goal, current, percent, remaining } = getChainProgress(chain)
  const isCompleted = chain.status === 'completed'
  const unit = chain.unit || ''
  const creatorName = chain.users?.display_name || t('user')

  const emoji = categoryEmojis[chain.category || ''] || '🔥'

  return (
    <div className="card relative overflow-hidden hover:shadow-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-coral-red/5 via-warm-orange/5 to-transparent pointer-events-none" />

      <div className="relative">
        {/* Cover image */}
        {chain.image_url && !imgFailed && (
          <div className="mb-4 rounded-2xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={chain.image_url}
              alt={chain.title || ''}
              onError={() => setImgFailed(true)}
              className="w-full h-36 object-cover"
            />
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-coral-red to-warm-orange flex items-center justify-center text-2xl shrink-0 shadow-lg">
              {emoji}
            </div>
            <div className="min-w-0">
              <Link href={`/app/chains/${chain.id}`} className="group">
                <h3 className="font-display font-bold text-warm-white text-lg leading-tight group-hover:text-coral-red transition-colors break-words">
                  {emoji} {chain.title || t('chain_number') + chain.id.slice(0, 6)}
                </h3>
              </Link>
              <div className="text-xs text-warm-white/50 mt-1 flex items-center gap-2 flex-wrap">
                <span>
                  {t('started_by')}{' '}
                  <span className="text-warm-white/80 font-semibold">@{creatorName}</span>
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

          {/* Status badge */}
          <div
            className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap ${
              isCompleted
                ? 'bg-kindness-green/20 text-kindness-green'
                : 'bg-coral-red/20 text-coral-red'
            }`}
          >
            {isCompleted ? t('chain_completed_badge') : t('chain_active_badge')}
          </div>
        </div>

        {/* Description */}
        {chain.description && (
          <p className="text-warm-white/70 text-sm leading-relaxed mb-4 line-clamp-2">
            {chain.description}
          </p>
        )}

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-baseline justify-between mb-2">
            <div className="font-display font-bold text-warm-white">
              <span className="text-2xl">{current}</span>
              <span className="text-warm-white/50 text-base"> / {goal}</span>
              <span className="text-sm text-warm-white/60 ms-1">{unit}</span>
            </div>
            <div className="text-sm font-bold text-warm-white/70">{percent}%</div>
          </div>

          <div
            className="w-full h-3 rounded-full bg-warm-white/10 overflow-hidden"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isCompleted
                  ? 'bg-gradient-to-r from-kindness-green to-soft-yellow'
                  : 'bg-gradient-to-r from-coral-red to-warm-orange'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="flex items-center justify-between mt-2 text-xs text-warm-white/50">
            {isCompleted ? (
              <span className="text-kindness-green font-semibold">
                🎉 {t('chain_goal_reached')}
              </span>
            ) : (
              <span>
                {remaining} {unit} {t('chain_remaining')}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users size={12} />
              {chain.length || 1}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-warm-white/10">
          <Link href={`/app/chains/${chain.id}`} className="btn-primary text-sm !py-2.5">
            {isCompleted ? t('view_chain') : t('view_chain')}
          </Link>

          {showContinue && !isCompleted && (
            <Link
              href={`/app/chains/${chain.id}?contribute=1`}
              className="btn-secondary text-sm !py-2.5 inline-flex items-center gap-2"
            >
              {t('continue_the_chain')}
            </Link>
          )}

          {isCompleted && (
            <Link
              href={`/app/chains/new?from=${chain.id}`}
              className="btn-secondary text-sm !py-2.5 inline-flex items-center gap-2"
            >
              {t('start_similar_chain')}
            </Link>
          )}

          {chain.image_url && imgFailed && (
            <span className="ms-auto inline-flex items-center gap-1 text-xs text-warm-white/40">
              <ImageIcon size={12} />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
