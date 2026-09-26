import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-dark via-primary-dark to-deep-green/20">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-50 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-2xl font-display font-bold text-coral-red">
            DON'T PRESS
          </div>
          <Link
            href="/auth"
            className="text-warm-white hover:text-coral-red transition font-semibold"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative min-h-screen flex flex-col items-center justify-center px-6">
        <div className="text-center mb-12 animate-float">
          <h1 className="text-6xl md:text-8xl font-display font-bold text-warm-white mb-4 tracking-tight">
            DON'T
          </h1>
          <h1 className="text-6xl md:text-8xl font-display font-bold text-warm-white mb-8 tracking-tight">
            PRESS
          </h1>
        </div>

        {/* The Button */}
        <Link href="/auth">
          <button className="press-button mb-8">
            PRESS
          </button>
        </Link>

        <p className="text-warm-white/60 text-lg mb-2">
          18,421 people pressed today
        </p>
        <p className="text-warm-white/40 text-sm max-w-md text-center">
          What happens after the press is up to you.
        </p>
      </div>

      {/* How It Works */}
      <div className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-display font-bold text-center text-warm-white mb-16">
          How it works
        </h2>

        <div className="grid md:grid-cols-5 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-coral-red/20 text-coral-red flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              1
            </div>
            <h3 className="text-xl font-semibold text-warm-white mb-2">Press</h3>
            <p className="text-warm-white/60 text-sm">
              Press the button and choose your challenge category
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-coral-red/20 text-coral-red flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              2
            </div>
            <h3 className="text-xl font-semibold text-warm-white mb-2">Discover</h3>
            <p className="text-warm-white/60 text-sm">
              Get a random safe challenge to complete
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-coral-red/20 text-coral-red flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              3
            </div>
            <h3 className="text-xl font-semibold text-warm-white mb-2">Do</h3>
            <p className="text-warm-white/60 text-sm">
              Complete your challenge in the real world
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-coral-red/20 text-coral-red flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              4
            </div>
            <h3 className="text-xl font-semibold text-warm-white mb-2">Share</h3>
            <p className="text-warm-white/60 text-sm">
              Tell your story and inspire others
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-coral-red/20 text-coral-red flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              5
            </div>
            <h3 className="text-xl font-semibold text-warm-white mb-2">Pass</h3>
            <p className="text-warm-white/60 text-sm">
              Pass it on and start a chain of kindness
            </p>
          </div>
        </div>
      </div>

      {/* Tagline */}
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-5xl md:text-6xl font-display font-bold text-warm-white mb-6 leading-tight">
          One press. One challenge. One good deed.
        </h2>
        <p className="text-xl text-warm-white/70 mb-12 max-w-2xl mx-auto">
          A social network where one small action can start a chain of good.
        </p>
        <Link
          href="/auth"
          className="inline-block bg-coral-red text-white px-12 py-4 rounded-full font-display font-bold text-xl hover:scale-105 transition-transform"
        >
          Start your first challenge
        </Link>
      </div>

      {/* Categories Preview */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-display font-bold text-center text-warm-white mb-16">
          Choose your path
        </h2>

        <div className="grid md:grid-cols-4 gap-6">
          {[
            { emoji: '❤️', name: 'Good Deed', desc: 'Small acts of kindness' },
            { emoji: '🤝', name: 'Help Someone', desc: 'Practical support' },
            { emoji: '🌱', name: 'Community', desc: 'Build together' },
            { emoji: '💚', name: 'Give', desc: 'Share what you have' },
            { emoji: '🎨', name: 'Creative', desc: 'Make something kind' },
            { emoji: '😂', name: 'Fun', desc: 'Bring joy' },
            { emoji: '🧠', name: 'Learn & Share', desc: 'Share knowledge' },
            { emoji: '🌍', name: 'Random', desc: 'Surprise me' },
          ].map((category) => (
            <div key={category.name} className="card text-center hover:scale-105 transition-transform">
              <div className="text-5xl mb-3">{category.emoji}</div>
              <h3 className="text-lg font-semibold text-warm-white mb-1">
                {category.name}
              </h3>
              <p className="text-sm text-warm-white/60">{category.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-warm-white/10 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-warm-white/50 text-sm mb-4">
            Do something good. Tell the story. Pass it on.
          </p>
          <p className="text-warm-white/30 text-xs">
            © 2026 Don't Press. A social network for kindness.
          </p>
        </div>
      </footer>
    </div>
  )
}
