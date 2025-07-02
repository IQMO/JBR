import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Jabbr Trading Bot Platform',
  description: 'Real-time trading bot platform with WebSocket-first architecture',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
} 