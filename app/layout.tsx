import type { Metadata } from 'next'

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
      <body style={{ fontFamily: 'system-ui', padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        {children}
      </body>
    </html>
  )
}
