'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Trash2, RotateCcw, FileText, MessageSquare, Home, Flag, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useIsAdmin } from '@/lib/useIsAdmin'
import Navigation from '@/components/Navigation'
import { useLanguage } from '@/lib/LanguageContext'

interface DelRequest {
  id: string
  story_id: string
  reason: string | null
  created_at: string
  content: string
  author?: string
  requester?: string
  requester_username?: string
  challenge?: string
}

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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [busyReport, setBusyReport] = useState<string | null>(null)
  const [delRequests, setDelRequests] = useState<DelRequest[]>([])
  const [tab, setTab] = useState<'live' | 'removed' | 'reported' | 'requests'>('live')
  const { isAdmin, checked } = useIsAdmin()
  const router = useRouter()
  const { t, language } = useLanguage()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.push('/auth')
    })
    return () => subscription.unsubscribe()
  }, [router])

  // One loader for the whole panel. It used to be four, and reports/requests
  // only fetched when their tab was opened, so every badge read 0 until you
  // clicked it. It also ignored query errors, so a failed query looked
  // identical to an empty queue.
  const loadAll = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    setLoadError(null)

    const base = `
        id, content, photo_url, created_at, deleted_at, user_id,
        users:user_id (id, username, display_name),
        challenges:challenge_id (title),
        comments (id)
      `

    const [liveRes, removedRes, reportsRes, requestsRes] = await Promise.all([
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

      supabase
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
        .limit(100),

      supabase
        .from('story_deletion_requests')
        .select(`
          id, story_id, reason, created_at,
          requester_id,
          stories:story_id (
            id, content, created_at, deleted_at,
            users:user_id (id, username, display_name)
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(100),
    ])

    // Report the first failure rather than quietly showing an empty queue.
    const failure = liveRes.error || removedRes.error || reportsRes.error || requestsRes.error
    if (failure) {
      console.error('Moderation panel query failed:', failure)
      setLoadError(failure.message)
    }

    if (liveRes.data) {
      setStories(
        (liveRes.data as unknown as ModStory[]).map((s) => ({
          ...s,
          author: s.users?.display_name || s.users?.username || t('user'),
          comment_count: Array.isArray(s.comments) ? s.comments.length : 0,
        }))
      )
    }
    if (removedRes.data) setDeleted(removedRes.data as unknown as ModStory[])

    // Group reports by post: one bad post with five reports is one item.
    if (reportsRes.data) {
      const grouped = new Map<string, Report>()
      for (const row of reportsRes.data as any[]) {
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
      // Array.from, not spread: the project targets es5, where spreading a
      // Map needs downlevelIteration.
      setReports(Array.from(grouped.values()))
    }

    if (requestsRes.data) {
      setDelRequests(
        (requestsRes.data as any[]).map((row) => {
          const story = Array.isArray(row.stories) ? row.stories[0] : row.stories
          return {
            id: row.id,
            story_id: row.story_id,
            reason: row.reason,
            created_at: row.created_at,
            content: story?.content || '',
            author: story?.users?.display_name || story?.users?.username || t('user'),
          }
        })
      )
    }

    setLoading(false)
  }, [isAdmin, t])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const resolveDeletion = async (requestId: string, approve: boolean) => {
    setBusyReport(requestId)
    // Remove from the queue immediately so the row does not linger.
    setDelRequests((prev) => prev.filter((r) => r.id !== requestId))
    try {
      const { error } = await supabase.rpc('resolve_deletion_request', {
        p_request_id: requestId,
        p_approve: approve,
      })
      if (error) throw error
      await loadAll()
    } catch (error) {
      console.error('Error resolving deletion request:', error)
      await loadAll()
    } finally {
      setBusyReport(null)
    }
  }

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
      await loadAll()
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

      await loadAll()
    } catch (error) {
      console.error('Error removing reported story:', error)
    } finally {
      setBusyReport(null)
    }
  }

  const remove = async (id: string) => {
    setBusyId(id)
    // Drop it from the list first. The previous version waited on a refetch,
    // which made the row sit there looking unresponsive for a second.
    setStories((prev) => prev.filter((s) => s.id !== id))
    try {
      const { error } = await supabase
        .from('stories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .is('deleted_at', null)
      if (error) throw error
      await loadAll()
    } catch (error) {
      console.error('Error removing story:', error)
      await loadAll()
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
      await loadAll()
    } catch (error) {
      console.error('Error restoring story:', error)
    } finally {
      setBusyId(null)
    }
  }

  // Permanent deletion is the one action here that cannot be undone, so it is
  // deliberately awkward: a typed confirmation naming the exact post, and the
  // delete itself goes through purge_story() rather than straight to PostgREST.
  // The database also refuses a bare DELETE now, so this is belt and braces on
  // top of a server-side gate rather than the only thing standing in the way.
  const [purgeTarget, setPurgeTarget] = useState<string | null>(null)
  const [purgeConfirm, setPurgeConfirm] = useState('')
  const [purgeError, setPurgeError] = useState('')

  const purge = async (id: string) => {
    if (purgeConfirm.trim() !== id) return
    setBusyId(id)
    setPurgeError('')
    try {
      const { error } = await supabase.rpc('purge_story', {
        p_story_id: id,
        p_confirm: purgeConfirm.trim(),
      })
      if (error) throw error
      setPurgeTarget(null)
      setPurgeConfirm('')
      await loadAll()
    } catch (error: any) {
      // Surfaced, not swallowed. A silent failure here looks identical to
      // "nothing happened", which is how the original purge bug hid.
      console.error('Error purging story:', error)
      setPurgeError(error?.message || 'Could not delete this post')
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
              onClick={() => setTab('requests')}
              className={`px-5 py-2.5 rounded-2xl font-semibold transition text-sm ${
                tab === 'requests' ? 'bg-coral-red text-white' : 'bg-warm-white/10 text-warm-white hover:bg-warm-white/20'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Trash2 size={15} />
                {t('tab_delete_requests')} ({delRequests.length})
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

          {loadError && (
            <div className="bg-coral-red/20 border border-coral-red text-coral-red px-4 py-3 rounded-xl mb-4 text-xs break-words">
              {t('admin_load_error')}: {loadError}
            </div>
          )}

          {/* Each tab renders from its own slice. The loading gate applies only
              to the two post lists, so a pending refresh never blanks the
              request queue. */}
          {tab === 'reported' ? (
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
          ) : tab === 'requests' ? (
            delRequests.length === 0 ? (
              <div className="card text-center py-12">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-warm-white/50 text-sm">{t('admin_no_delete_requests')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {delRequests.map((r) => (
                  <div key={r.id} className="card !p-4">
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <div className="text-sm min-w-0">
                        <span className="font-semibold text-warm-white">@{r.author}</span>
                        <span className="text-warm-white/40 text-xs ms-2">
                          {t('requested_by_author_at').replace('{when}', new Date(r.created_at).toLocaleString(
                            language === 'ar' ? 'ar-MA' : 'en-US',
                            { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
                          ))}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-warm-white/85 whitespace-pre-wrap break-words mb-2">
                      {r.content.length > 200 ? r.content.slice(0, 200) + '…' : r.content}
                    </p>

                    {r.reason && (
                      <p className="text-xs text-warm-white/60 bg-warm-white/5 rounded-lg px-3 py-2 mb-3">
                        <span className="text-warm-white/40">{t('reason_label')}: </span>
                        {r.reason}
                      </p>
                    )}

                    <div className="flex gap-2 pt-3 border-t border-warm-white/10 flex-wrap">
                      <button
                        onClick={() => resolveDeletion(r.id, true)}
                        disabled={busyReport === r.id}
                        className="bg-coral-red text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-coral-red/90 transition inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        {t('approve_and_remove')}
                      </button>
                      <button
                        onClick={() => resolveDeletion(r.id, false)}
                        disabled={busyReport === r.id}
                        className="btn-secondary text-xs !py-2 inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <X size={13} />
                        {t('reject_request')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : loading ? (
            <div className="card text-center py-12 text-warm-white/50">{t('loading')}</div>
          ) : list.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-5xl mb-4">{tab === 'live' ? '✨' : '🗑️'}</div>
              <p className="text-warm-white/50 text-sm">
                {tab === 'live' ? t('admin_nothing_to_review') : t('admin_nothing_removed')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {list.map((story) => (
                <div
                  key={story.id}
                  className={`card !p-3 flex items-center gap-3 ${story.deleted_at ? 'opacity-60' : ''}`}
                >
                  {/* No photo here on purpose: the queue only needs who, when
                      and a line of text, and images make it heavy to scan. */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-coral-red to-warm-orange flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(story.users?.username || story.users?.display_name || 'U')[0]?.toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-warm-white truncate">
                        @{story.users?.username || story.users?.display_name || t('user')}
                      </span>
                      {story.deleted_at && (
                        <span className="text-[10px] bg-coral-red/20 text-coral-red px-1.5 py-0.5 rounded-full font-semibold">
                          {t('removed_badge')}
                        </span>
                      )}
                      {typeof story.comment_count === 'number' && story.comment_count > 0 && (
                        <span className="text-[10px] text-warm-white/40 inline-flex items-center gap-0.5">
                          <MessageSquare size={10} />
                          {story.comment_count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-warm-white/60 truncate">
                      {story.content.length > 90 ? story.content.slice(0, 90) + '…' : story.content}
                    </p>
                    <div className="text-[11px] text-warm-white/35">
                      {new Date(story.created_at).toLocaleString(
                        language === 'ar' ? 'ar-MA' : 'en-US',
                        { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {story.deleted_at ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => restore(story.id)}
                          disabled={busyId === story.id}
                          title={t('restore_post')}
                          className="p-2 rounded-lg bg-warm-white/10 text-warm-white hover:bg-warm-white/20 transition disabled:opacity-50"
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setPurgeTarget(purgeTarget === story.id ? null : story.id)
                            setPurgeConfirm('')
                            setPurgeError('')
                          }}
                          disabled={busyId === story.id}
                          title={t('purge_permanently')}
                          className="p-2 rounded-lg text-coral-red/70 hover:bg-coral-red/10 transition disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => remove(story.id)}
                        disabled={busyId === story.id}
                        title={t('moderate_remove_post')}
                        className="p-2 rounded-lg bg-coral-red/15 text-coral-red hover:bg-coral-red/25 transition disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Permanent-delete confirmation. Requires the exact post id typed
              out, so it cannot be reached by a stray click. */}
          {purgeTarget && (
            <div className="card border-coral-red/40 bg-coral-red/5 mt-6">
              <h3 className="text-base font-display font-bold text-coral-red mb-2">
                {t('purge_permanently')}
              </h3>
              <p className="text-warm-white/60 text-sm mb-4">
                {t('confirm_purge')}
              </p>
              <label className="block text-warm-white/50 text-xs mb-2" htmlFor="purge-confirm">
                {t('purge_type_id')}
              </label>
              <input
                id="purge-confirm"
                type="text"
                value={purgeConfirm}
                onChange={(e) => setPurgeConfirm(e.target.value)}
                placeholder={purgeTarget}
                spellCheck={false}
                autoComplete="off"
                className="w-full px-3 py-2 rounded-lg bg-primary-dark/60 border border-coral-red/30 text-warm-white text-sm font-mono focus:outline-none focus:border-coral-red/60"
              />
              <p className="text-warm-white/40 text-xs mt-2 font-mono break-all">
                {purgeTarget}
              </p>
              {purgeError && (
                <p className="text-coral-red text-sm mt-3">{purgeError}</p>
              )}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => purge(purgeTarget)}
                  disabled={busyId === purgeTarget || purgeConfirm.trim() !== purgeTarget}
                  className="btn-primary text-sm inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 size={14} />
                  {t('purge_permanently')}
                </button>
                <button
                  onClick={() => {
                    setPurgeTarget(null)
                    setPurgeConfirm('')
                    setPurgeError('')
                  }}
                  className="btn-secondary text-sm"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
