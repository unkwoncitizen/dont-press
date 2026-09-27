'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Trash2, RotateCcw, Users, FileText, MessageSquare, Home, Flag, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useIsAdmin } from '@/lib/useIsAdmin'
import Navigation from '@/components/Navigation'
import { useLanguage } from '@/lib/LanguageContext'

interface Report {
  story_id: string
  content: string
  photo_url: string | null
  created_at: string
  already_removed: boolean
  author: string
  count: number
  reasons: string[]
  report_ids: string[]
}

interface ModStory {
  id: string
  content: string
  photo_url: string | null
  created_at: string
  deleted_at: string | null
  user_id: string
  // PostgREST infers embedded relations as arrays, which does not line up with
  // the single-object fields here.
  users?: { id: string; username?: string; display_name?: string }
  comments?: { id: string }[]
  author?: string
  comment_count?: number
}

export default function AdminPage() {
  const [stories, setStories] = useState<ModStory[]>([])
  const [deleted, setDeleted] = useState<ModStory[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [busyReport, setBusyReport] = useState<string | null>(null)
  const [tab, setTab] = useState<'live' | 'removed' | 'reported'>('live')
  const { isAdmin, checked } = useIsAdmin()
  const router = useRouter()
  const { t, language } = useLanguage()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.push('/auth')
    })
    return () => subscription.unsubscribe()
  }, [router])

  const load = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)

    try {
      const base = `
        id, content, photo_url, created_at, deleted_at, user_id,
        users:user_id (id, username, display_name),
        challenges:challenge_id (title),
        comments (id)
      `

      const [liveRes, removedRes] = await Promise.all([
        supabase
          .from('stories')
          .select(base)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(50),

        supabase
          .from('stories')
          .select(base)
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false })
          .limit(50),
      ])

      if (liveRes.data) {
        setStories(
          (liveRes.data as unknown as ModStory[]).map((s) => ({
            ...s,
            author: s.users?.display_name || s.users?.username || t('user'),
            comment_count: Array.isArray(s.comments) ? s.comments.length : 0,
          }))
        )
      }
      if (removedRes.data) {
        setDeleted(removedRes.data as unknown as ModStory[])
      }
    } catch (error) {
      console.error('Error loading moderation queue:', error)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, t])

  // Reports are grouped by post so one bad post with five reports reads as one
  // item, not five.
  const loadReports = useCallback(async () => {
    if (!isAdmin) return
    try {
      const { data, error } = await supabase
        .from('story_reports')
        .select(`
          id, story_id, reason, details, status, created_at,
          reporter_id,
          stories:story_id (
            id, content, photo_url, created_at, deleted_at,
            users:user_id (id, username, display_name)
          )
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      const grouped = new Map<string, Report>()
      for (const row of (data || []) as any[]) {
        const story = Array.isArray(row.stories) ? row.stories[0] : row.stories
        if (!story) continue

        const existing = grouped.get(row.story_id)
        if (existing) {
          existing.count += 1
          continue
        }
        grouped.set(row.story_id, {
          story_id: row.story_id,
          content: story.content,
          photo_url: story.photo_url,
          created_at: story.created_at,
          already_removed: story.deleted_at !== null,
          author: story.users?.display_name || story.users?.username || t('user'),
          count: 1,
          reasons: [row.reason],
          report_ids: [row.id],
        })
      }
      // Array.from rather than spread: the project targets es5, where spreading
      // a Map/Set needs downlevelIteration.
      setReports(Array.from(grouped.values()))
    } catch (error) {
      console.error('Error loading reports:', error)
    }
  }, [isAdmin, t])

  useEffect(() => {
    if (tab === 'reported') loadReports()
  }, [tab, loadReports])

  // Resolving a report without removing the post: the report is marked
  // dismissed so it stops counting but the content stays.
  const resolveReports = async (ids: string[], status: 'dismissed' | 'actioned') => {
    if (ids.length === 0) return
    setBusyReport(ids[0])
    try {
      const { error } = await supabase
        .from('story_reports')
        .update({ status, resolved_at: new Date().toISOString() })
        .in('id', ids)
      if (error) throw error
      await loadReports()
    } catch (error) {
      console.error('Error resolving reports:', error)
    } finally {
      setBusyReport(null)
    }
  }

  const removeAndResolve = async (storyId: string, reportIds: string[]) => {
    setBusyReport(storyId)
    try {
      const { error: delErr } = await supabase
        .from('stories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', storyId)
        .is('deleted_at', null)
      if (delErr) throw delErr

      const { error: repErr } = await supabase
        .from('story_reports')
        .update({ status: 'actioned', resolved_at: new Date().toISOString() })
        .in('id', reportIds)
      if (repErr) throw repErr

      await Promise.all([load(), loadReports()])
    } catch (error) {
      console.error('Error removing reported story:', error)
    } finally {
      setBusyReport(null)
    }
  }

  const remove = async (id: string) => {
    setBusyId(id)
    try {
      const { error } = await supabase
        .from('stories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .is('deleted_at', null)
      if (error) throw error
      await load()
    } catch (error) {
      console.error('Error removing story:', error)
    } finally {
      setBusyId(null)
    }
  }

  const restore = async (id: string) => {
    setBusyId(id)
    try {
      const { error } = await supabase
        .from('stories')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', id)
      if (error) throw error
      await load()
    } catch (error) {
      console.error('Error restoring story:', error)
    } finally {
      setBusyId(null)
    }
  }

  const purge = async (id: string) => {
    if (!confirm(t('confirm_purge'))) return
    setBusyId(id)
    try {
      const { error } = await supabase.from('stories').delete().eq('id', id)
      if (error) throw error
      await load()
    } catch (error) {
      console.error('Error purging story:', error)
    } finally {
      setBusyId(null)
    }
  }

  if (!checked) {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center">
        <div className="text-warm-white/50">{t('loading')}</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-dark via-primary-dark to-deep-green/20 flex items-center justify-center px-6">
        <Navigation />
        <div className="card text-center max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-display font-bold text-warm-white mb-2">
            {t('admin_only')}
          </h1>
          <p className="text-warm-white/60 text-sm mb-6">{t('admin_only_hint')}</p>
          <Link href="/app" className="btn-primary inline-block">
            {t('nav_home')}
          </Link>
        </div>
      </div>
    )
  }

  const list = tab === 'live' ? stories : deleted

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark via-primary-dark to-deep-green/20 pb-24 md:pb-8">
      <Navigation />

      <main className="pt-20 md:pt-24 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <Link href="/app" className="flex items-center gap-2 text-warm-white/70 hover:text-warm-white transition">
              <Home size={18} />
              <span className="text-sm">{t('nav_home')}</span>
            </Link>
          </div>

          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 text-warm-orange font-semibold text-sm mb-3">
              <Shield size={16} />
              {t('admin_panel')}
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-warm-white mb-2">
              {t('moderation_title')}
            </h1>
            <p className="text-warm-white/60">{t('moderation_subtitle')}</p>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setTab('live')}
              className={`px-5 py-2.5 rounded-2xl font-semibold transition text-sm ${
                tab === 'live' ? 'bg-coral-red text-white' : 'bg-warm-white/10 text-warm-white hover:bg-warm-white/20'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <FileText size={15} />
                {t('tab_live_posts')} ({stories.length})
              </span>
            </button>
            <button
              onClick={() => setTab('removed')}
              className={`px-5 py-2.5 rounded-2xl font-semibold transition text-sm ${
                tab === 'removed' ? 'bg-coral-red text-white' : 'bg-warm-white/10 text-warm-white hover:bg-warm-white/20'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Trash2 size={15} />
                {t('tab_removed_posts')} ({deleted.length})
              </span>
            </button>
            <button
              onClick={() => setTab('reported')}
              className={`px-5 py-2.5 rounded-2xl font-semibold transition text-sm ${
                tab === 'reported' ? 'bg-coral-red text-white' : 'bg-warm-white/10 text-warm-white hover:bg-warm-white/20'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Flag size={15} />
                {t('tab_reported')} ({reports.length})
              </span>
            </button>
          </div>

          {loading && tab !== 'reported' ? (
            <div className="card text-center py-12 text-warm-white/50">{t('loading')}</div>
          ) : tab === 'reported' ? (
            reports.length === 0 ? (
              <div className="card text-center py-12">
                <div className="text-5xl mb-4">✨</div>
                <p className="text-warm-white/50 text-sm">{t('admin_nothing_reported')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((r) => (
                  <div key={r.story_id} className="card">
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-warm-white">
                          @{r.author}
                        </span>
                        {r.already_removed && (
                          <span className="text-[10px] bg-coral-red/20 text-coral-red px-2 py-0.5 rounded-full font-semibold">
                            {t('removed_badge')}
                          </span>
                        )}
                      </div>
                      <span className="bg-warm-orange/20 text-warm-orange text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                        {r.count} × {t('report_count_label')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {Array.from(new Set(r.reasons)).map((reason) => (
                        <span
                          key={reason}
                          className="text-[11px] bg-warm-white/10 text-warm-white/80 px-2 py-0.5 rounded-full"
                        >
                          {t(`report_reason_${reason}`)}
                        </span>
                      ))}
                    </div>

                    <p className="text-sm text-warm-white/85 whitespace-pre-wrap break-words mb-3">
                      {r.content.length > 250 ? r.content.slice(0, 250) + '…' : r.content}
                    </p>

                    <div className="text-xs text-warm-white/40 mb-3">
                      {new Date(r.created_at).toLocaleString(
                        language === 'ar' ? 'ar-MA' : 'en-US',
                        { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
                      )}
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-warm-white/10 flex-wrap">
                      {!r.already_removed && (
                        <button
                          onClick={() => removeAndResolve(r.story_id, r.report_ids)}
                          disabled={busyReport === r.story_id}
                          className="bg-coral-red/20 text-coral-red text-xs font-semibold px-4 py-2 rounded-xl hover:bg-coral-red/30 transition inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Trash2 size={13} />
                          {t('moderate_remove_post')}
                        </button>
                      )}
                      <button
                        onClick={() => resolveReports(r.report_ids, 'dismissed')}
                        disabled={busyReport === r.report_ids[0]}
                        className="btn-secondary text-xs !py-2 inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Check size={13} />
                        {t('report_dismiss')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : list.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-5xl mb-4">{tab === 'live' ? '✨' : '🗑️'}</div>
              <p className="text-warm-white/50 text-sm">
                {tab === 'live' ? t('admin_nothing_to_review') : t('admin_nothing_removed')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {list.map((story) => (
                <div
                  key={story.id}
                  className={`card ${story.deleted_at ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Users size={13} className="text-warm-white/40" />
                        <span className="text-sm font-semibold text-warm-white">
                          @{story.users?.username || story.users?.display_name || t('user')}
                        </span>
                        {story.deleted_at && (
                          <span className="text-[10px] bg-coral-red/20 text-coral-red px-2 py-0.5 rounded-full font-semibold">
                            {t('removed_badge')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-warm-white/40">
                        {new Date(story.created_at).toLocaleString(
                          language === 'ar' ? 'ar-MA' : 'en-US',
                          { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
                        )}
                        {typeof story.comment_count === 'number' && (
                          <span className="ms-3 inline-flex items-center gap-1">
                            <MessageSquare size={11} />
                            {story.comment_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-warm-white/85 whitespace-pre-wrap break-words mb-3">
                    {story.content.length > 300 ? story.content.slice(0, 300) + '…' : story.content}
                  </p>

                  {story.photo_url && (
                    <div className="rounded-xl overflow-hidden mb-3 max-w-xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={story.photo_url} alt="" className="w-full h-32 object-cover" />
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-warm-white/10 flex-wrap">
                    {story.deleted_at ? (
                      <>
                        <button
                          onClick={() => restore(story.id)}
                          disabled={busyId === story.id}
                          className="btn-secondary text-xs !py-2 inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <RotateCcw size={13} />
                          {t('restore_post')}
                        </button>
                        <button
                          onClick={() => purge(story.id)}
                          disabled={busyId === story.id}
                          className="text-xs text-coral-red hover:underline font-semibold px-3 py-2 disabled:opacity-50"
                        >
                          {t('purge_permanently')}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => remove(story.id)}
                        disabled={busyId === story.id}
                        className="text-xs bg-coral-red/20 text-coral-red px-4 py-2 rounded-xl font-semibold hover:bg-coral-red/30 transition inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        {t('moderate_remove_post')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
