import { NextRequest, NextResponse } from 'next/server'

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const res = await fetch(`${BACKEND}/debates?${searchParams.toString()}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const res = await fetch(`${BACKEND}/debates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Inject server-side Groq key so it never goes to the client
      'X-Groq-Api-Key': process.env.GROQ_API_KEY ?? '',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}