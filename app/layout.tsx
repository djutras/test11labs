import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Test ElevenLabs + Claude',
  description: 'Test voice AI integration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="bg-gray-900 text-gray-100 font-sans min-h-screen">
        <div className="max-w-6xl mx-auto p-4">
          {children}
        </div>
      </body>
    </html>
  )
}
