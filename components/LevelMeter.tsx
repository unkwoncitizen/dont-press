'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/LanguageContext'

interface ProfileStats {
  completed: number
  level: number
  level_min: number
  level_max: number
  next_threshold: number | null
  progress: number
}

const LEVEL_META = [
  { emoji: '🌱', en: 'Newcomer', ar: 'مبتدئ' },
  { emoji: '👣', en: 'First Steps', ar: 'الخطوة الأولى' },
  { emoji: '🤝', en: 'Kind Starter', ar: 'بداية طيبة' },
  { emoji: '💚', en: 'Good Neighbor', ar: 'جار طيب' },
  { emoji: '🏮', en: 'Beacon of Good', ar: 'منارة للخير' },
  { emoji: '⛓️', en: 'Chain Builder', ar: 'باني السلسلة' },
  { emoji: '✨', en: 'Inspiration', ar: 'إلهام' },
  { emoji: '🌟', en: 'Guiding Light', ar: 'نور يرشد' },
  { emoji: '👑', en: 'Legend', ar: 'أسطورة' },
]

interface LevelMeterProps {
  userId: string
  compact?: boolean
}

export default function LevelMeter({ userId, compact = false }: LevelMeterProps) {
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { t, isArabic } = useLanguage()

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!userId) {
        setLoading(false)
        return
      }
      try {
        // Aggregates come from a SECURITY DEFINER function because
        // challenge_assignments RLS only lets a user read their own rows.
        const { data, error } = await supabase.rpc('get_profile_stats', {
          p_user_id: userId,
        })
        if (error) throw error
        if (!cancelled && data) setStats(data as ProfileStats)
      } catch (error) {
        console.error('Error loading profile stats:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-warm-white/40 text-sm">
        <Loader2 size={14} className="animate-spin" />
      </div>
    )
  }

  if (!stats) return null

  const level = Math.min(stats.level, LEVEL_META.length - 1)
  const meta = LEVEL_META[level]
  const isMax = stats.next_threshold === null || stats.next_threshold === undefined
  const name = isArabic ? meta.ar : meta.en

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-lg">{meta.emoji}</span>
        <span className="font-semibold text-warm-white">
          {t('level_label')} {level}
        </span>
        <span className="text-warm-white/50">{name}</span>
      </div>
    )
  }

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-warm-white/10 to-warm-white/5 border border-warm-white/15">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-coral-red to-warm-orange flex items-center justify-center text-2xl shadow-lg shrink-0">
          {meta.emoji}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-warm-white/50 font-semibold">
            {t('level_label')} {level}
            <span className="text-warm-white/30"> · {t('level_of')} {LEVEL_META.length - 1}</span>
          </div>
          <div className="font-display font-bold text-warm-white text-lg leading-tight">
            {name}
          </div>
        </div>
      </div>

      <div className="flex items-baseline justify-between text-xs text-warm-white/60 mb-1.5">
        <span>
          {stats.completed} {t('level_challenges_done')}
        </span>
        {isMax ? (
          <span className="text-soft-yellow font-semibold">{t('level_max_reached')}</span>
        ) : (
          <span>
            {t('level_next_at')} {stats.next_threshold}
          </span>
        )}
      </div>

      <div
        className="w-full h-2.5 rounded-full bg-warm-white/10 overflow-hidden"
        role="progressbar"
        aria-valuenow={stats.progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-coral-red via-warm-orange to-soft-yellow transition-all duration-700"
          style={{ width: `${Math.max(3, stats.progress)}%` }}
        />
      </div>
    </div>
  )
}
