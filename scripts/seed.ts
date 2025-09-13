
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // Sample puzzle data for testing
  const today = new Date().toISOString().split('T')[0]
  
  // Easy puzzle sample
  const easyPuzzle = {
    date: today,
    difficulty: 'easy',
    startWord: 'HOUSE',
    wordSequence: ['HOUSE', 'HORSE', 'WORSE', 'WORSE', 'WORLD', 'WOULD'],
    clues: [
      'An animal you can ride',
      'Not better, but...',
      'More terrible than before', 
      'The Earth and everything in it',
      'Past tense of will'
    ]
  }

  // Hard puzzle sample  
  const hardPuzzle = {
    date: today,
    difficulty: 'hard',
    startWord: 'BRAIN',
    wordSequence: ['BRAIN', 'GRAIN', 'GRAIL', 'TRAIL', 'TRIAL', 'TIDAL'],
    clues: [
      'What wheat becomes when processed',
      'Holy cup sought by knights',
      'Path through the forest',
      'Court proceeding or test',
      'Related to ocean waves'
    ]
  }

  try {
    // Check if puzzles already exist for today
    const existingEasy = await prisma.dailyPuzzle.findFirst({
      where: { date: today, difficulty: 'easy' }
    })

    const existingHard = await prisma.dailyPuzzle.findFirst({
      where: { date: today, difficulty: 'hard' }
    })

    if (!existingEasy) {
      await prisma.dailyPuzzle.create({
        data: easyPuzzle
      })
      console.log('✅ Created easy puzzle for today')
    } else {
      console.log('ℹ️ Easy puzzle already exists for today')
    }

    if (!existingHard) {
      await prisma.dailyPuzzle.create({
        data: hardPuzzle
      })
      console.log('✅ Created hard puzzle for today')
    } else {
      console.log('ℹ️ Hard puzzle already exists for today')
    }

    console.log('🎉 Database seed completed successfully!')

  } catch (error) {
    console.error('❌ Error seeding database:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
