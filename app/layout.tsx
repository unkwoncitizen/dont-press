import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: "DON'T PRESS - One press. One challenge. One good deed.",
  description: 'A social network where one small action can start a chain of good. Press the button, get a challenge, do something good, tell your story, pass it on.',
  keywords: ['kindness', 'good deeds', 'social network', 'challenges', 'community'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
