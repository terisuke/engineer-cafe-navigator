import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Sans_JP } from 'next/font/google'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

const notoSansJP = Noto_Sans_JP({ 
  subsets: ['latin'],
  variable: '--font-noto-jp',
  weight: ['300', '400', '500', '700']
})

export const metadata: Metadata = {
  title: 'Engineer Cafe Navigator',
  description: '福岡市エンジニアカフェの音声AIエージェントシステム',
  keywords: ['エンジニアカフェ', 'Engineer Cafe', 'AI', '音声案内', 'Fukuoka'],
  authors: [{ name: 'Engineer Cafe Team' }],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3B82F6',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className={`${inter.variable} ${notoSansJP.variable}`}>
      <head>
        <link rel="icon" href="/assets/images/favicon.ico" />
        <script defer src="https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js" integrity="sha384-hkdWrJct7B7QgkF6qkHOd8QKEb2Kqmq3R6gOTbKhvEcxBFo8wD2EbGm9CbPZhqnW" crossOrigin="anonymous"></script>
      </head>
      <body className="font-sans antialiased min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {children}
      </body>
    </html>
  )
}
