'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Whether the signed-in user can moderate other people's content.
 *
 * The `role` column is not readable by the client, so the UI cannot decide this
 * locally. It asks the database instead. This only controls what buttons are
 * rendered: every action is still authorised by RLS, so hiding the UI is a
 * convenience rather than the security boundary.
 */
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const { data, error } = await supabase.rpc('get_my_role')
        if (error) throw error
        if (!cancelled) {
          setIsAdmin(data === 'admin' || data === 'moderator')
        }
      } catch (error) {
        console.error('Error checking role:', error)
      } finally {
        if (!cancelled) setChecked(true)
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [])

  return { isAdmin, checked }
}
