'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Check, Heart, MessageCircle, Link2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/LanguageContext'

interface Notification {
  id: string
  type: 'comment' | 'reaction' | 'chain_contribution'
  story_id: string | null
  chain_id: string | null
  preview: string | null
  read_at: string | null
  created_at: string
  actor?: { username?: string; display_name?: string } | null
}

const POLL_MS = 30000

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { t, language } = useLanguage()

  // The unread count is the only thing that has to be instant, so it comes from
  // a function returning a number rather than downloading rows to count them.
  const loadUnread = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_unread_notification_count')
    if (!error && typeof data === 'number') setUnread(data)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id, type, story_id, chain_id, preview, read_at, created_at,
        users:actor_id (id, username, display_name)
      `)
      .order('created_at', { ascending: false })
      .limit(20)
    if (!error && data) {
      setItems(data as unknown as Notification[])
      setUnread(data.filter((n) => !n.read_at).length)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadUnread()
    const id = setInterval(loadUnread, POLL_MS)
    return () => clearInterval(id)
  }, [loadUnread])

  // Close on outside click. Without this the dropdown covers the page and stays
  // open, which on mobile means it is impossible to dismiss.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next) await loadAll()
  }

  const openItem = async (n: Notification) => {
    if (!n.read_at) {
      // Best effort: a failed mark-as-read must not stop the navigation, it
      // just leaves a badge that clears on the next poll.
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      setUnread((u) => Math.max(0, u - 1))
    }
    setOpen(false)
    if (n.story_id) router.push('/app')
    else if (n.chain_id) router.push(`/app/chains/${n.chain_id}`)
  }

  const markAll = async () => {
    await supabase.rpc('mark_all_notifications_read')
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })))
    setUnread(0)
  }

  const icon = (type: Notification['type']) => {
    if (type === 'reaction') return <Heart size={13} className="text-coral-red shrink-0" />
    if (type === 'chain_contribution') return <Link2 size={13} className="text-warm-orange shrink-0" />
    return <MessageCircle size={13} className="text-warm-white/60 shrink-0" />
  }

  const who = (n: Notification) =>
    n.actor?.display_name || (n.actor?.username ? `@${n.actor.username}` : t('user'))

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label={t('notifications')}
        title={t('notifications')}
        className="text-warm-white/70 hover:text-warm-white transition p-2 rounded-xl hover:bg-warm-white/5 relative"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-coral-red text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] card !p-0 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-warm-white/10">
            <span className="text-sm font-semibold text-warm-white">{t('notifications')}</span>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="text-xs text-warm-white/60 hover:text-warm-white transition inline-flex items-center gap-1"
              >
                <Check size={12} />
                {t('mark_all_read')}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-warm-white/50 text-center">{t('loading')}</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-warm-white/50 text-center">{t('no_notifications')}</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-warm-white/5 transition flex gap-2.5 items-start ${
                    n.read_at ? 'opacity-60' : ''
                  }`}
                >
                  <span className="mt-0.5">{icon(n.type)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="text-xs text-warm-white">
                      <span className="font-semibold">{who(n)}</span>{' '}
                      {n.type === 'reaction'
                        ? t('notif_reacted')
                        : n.type === 'chain_contribution'
                        ? t('notif_contributed')
                        : t('notif_commented')}
                    </span>
                    {n.preview && (
                      <span className="block text-xs text-warm-white/50 truncate mt-0.5">
                        {n.preview}
                      </span>
                    )}
                    <span className="block text-[11px] text-warm-white/30 mt-0.5">
                      {new Date(n.created_at).toLocaleString(
                        language === 'ar' ? 'ar-MA' : 'en-US',
                        { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
                      )}
                    </span>
                  </span>
                  {!n.read_at && <span className="w-2 h-2 rounded-full bg-coral-red mt-1.5 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
