import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/components/Providers'

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
    <html lang="en">
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
