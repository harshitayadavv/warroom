// LOCATION: frontend/app/layout.tsx

import type { Metadata } from 'next'
import './globals.css'
import { NavBar } from './NavBar'

export const metadata: Metadata = {
  title: 'WARROOM — Multi-Agent Debate Arena',
  description: 'A sophisticated multi-agent strategic debate system powered by LangGraph & Groq',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NavBar />
        <main style={{ paddingTop: '52px' }}>{children}</main>
      </body>
    </html>
  )
}