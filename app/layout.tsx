
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Word Ladder - Daily Word Puzzles',
  description: 'Challenge yourself with daily word ladder puzzles. Transform one word into another by changing one letter at a time.',
  keywords: ['word games', 'puzzles', 'vocabulary', 'brain training', 'word ladder'],
  authors: [{ name: 'Word Ladder Game' }],
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider enableSystem={false} defaultTheme="system">
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
