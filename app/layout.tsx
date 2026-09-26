import type { Metadata } from 'next'
import { Inter, Space_Grotesk, Cairo } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
})

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  weight: ['400', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: "DON'T PRESS - One press. One challenge. One good deed.",
  description: 'A social network where one small action can start a chain of good. Press the button, get a challenge, do something good, tell your story, pass it on.',
  keywords: ['kindness', 'good deeds', 'social network', 'challenges', 'community', 'خير', 'إحسان', 'تحديات'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${cairo.variable}`}>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
