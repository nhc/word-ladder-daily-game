
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const difficulty = searchParams.get('difficulty') || 'easy'
    
    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0]

    // Try to get existing puzzle for today
    let puzzle = await prisma.dailyPuzzle.findFirst({
      where: {
        date: today,
        difficulty
      }
    })

    // If no puzzle exists, generate one
    if (!puzzle) {
      const generateResponse = await fetch(`${request.nextUrl.origin}/api/generate-puzzle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: today,
          difficulty
        })
      })

      if (!generateResponse.ok) {
        throw new Error('Failed to generate puzzle')
      }

      puzzle = await generateResponse.json()
    }

    return NextResponse.json(puzzle)
  } catch (error) {
    console.error('Error fetching daily puzzle:', error)
    return NextResponse.json({ error: 'Failed to fetch daily puzzle' }, { status: 500 })
  }
}
