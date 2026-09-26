'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Home, Compass, Zap, Link2, User, LogOut } from 'lucide-react'

export default function Navigation() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (!user) return null

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-primary-dark/80 backdrop-blur-xl border-b border-warm-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/app" className="text-2xl font-display font-bold text-coral-red">
            DON'T PRESS
          </Link>

          <div className="flex items-center gap-8">
            <Link href="/app" className="text-warm-white/70 hover:text-warm-white transition">
              Home
            </Link>
            <Link href="/app/discover" className="text-warm-white/70 hover:text-warm-white transition">
              Discover
            </Link>
            <Link href="/app/chains" className="text-warm-white/70 hover:text-warm-white transition">
              Chains
            </Link>
            <Link href="/app/profile" className="text-warm-white/70 hover:text-warm-white transition">
              Profile
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/app/press"
              className="bg-coral-red text-white px-8 py-3 rounded-full font-display font-bold text-lg hover:scale-105 transition-transform"
            >
              PRESS
            </Link>
            <button
              onClick={handleSignOut}
              className="text-warm-white/70 hover:text-warm-white transition"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-primary-dark/95 backdrop-blur-xl border-t border-warm-white/10">
        <div className="flex items-center justify-around px-4 py-3">
          <Link href="/app" className="flex flex-col items-center gap-1 text-warm-white/70 hover:text-warm-white transition">
            <Home size={24} />
            <span className="text-xs">Home</span>
          </Link>

          <Link href="/app/discover" className="flex flex-col items-center gap-1 text-warm-white/70 hover:text-warm-white transition">
            <Compass size={24} />
            <span className="text-xs">Discover</span>
          </Link>

          <Link
            href="/app/press"
            className="flex flex-col items-center gap-1 -mt-6"
          >
            <div className="bg-coral-red text-white p-4 rounded-full shadow-lg shadow-coral-red/50">
              <Zap size={32} />
            </div>
          </Link>

          <Link href="/app/chains" className="flex flex-col items-center gap-1 text-warm-white/70 hover:text-warm-white transition">
            <Link2 size={24} />
            <span className="text-xs">Chains</span>
          </Link>

          <Link href="/app/profile" className="flex flex-col items-center gap-1 text-warm-white/70 hover:text-warm-white transition">
            <User size={24} />
            <span className="text-xs">Profile</span>
          </Link>
        </div>
      </nav>
    </>
  )
}
