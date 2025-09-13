
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Network, Clock, Lightbulb, Trophy, Zap } from 'lucide-react'

interface MainMenuProps {
  onStartGame: (difficulty: 'easy' | 'hard') => void
}

export default function MainMenu({ onStartGame }: MainMenuProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'hard' | null>(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <Card className="text-center border-2 border-primary/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center justify-center gap-3">
              <Network className="h-10 w-10 text-blue-600" />
              Word Ladder
            </CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Daily word puzzles that challenge your vocabulary
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Game Description */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Clock className="h-5 w-5" />
              How to Play
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                  1
                </div>
                <div>
                  <h4 className="font-semibold">Start with a word</h4>
                  <p className="text-sm text-muted-foreground">Begin with a 5-letter word</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                  2
                </div>
                <div>
                  <h4 className="font-semibold">Change one letter</h4>
                  <p className="text-sm text-muted-foreground">Follow the clue to transform the word</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                  3
                </div>
                <div>
                  <h4 className="font-semibold">Complete the ladder</h4>
                  <p className="text-sm text-muted-foreground">Make 5 transformations to finish</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                  4
                </div>
                <div>
                  <h4 className="font-semibold">New puzzle daily</h4>
                  <p className="text-sm text-muted-foreground">Fresh challenges every day</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Difficulty Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Choose Your Challenge</CardTitle>
            <CardDescription>
              Select a difficulty level to start today's puzzle
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedDifficulty === 'easy' 
                    ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20' 
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedDifficulty('easy')}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-green-600" />
                    Easy Mode
                    <Badge variant="secondary">Recommended</Badge>
                  </CardTitle>
                  <CardDescription>
                    Common words and straightforward clues. Perfect for beginners!
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Everyday vocabulary</li>
                    <li>• Clear, direct clues</li>
                    <li>• Great for learning</li>
                  </ul>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedDifficulty === 'hard' 
                    ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-900/20' 
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedDifficulty('hard')}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-red-600" />
                    Hard Mode
                    <Badge variant="destructive">Challenge</Badge>
                  </CardTitle>
                  <CardDescription>
                    Advanced vocabulary and trickier clues. For word masters!
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Complex vocabulary</li>
                    <li>• Challenging clues</li>
                    <li>• Test your limits</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {selectedDifficulty && (
              <div className="flex justify-center pt-4">
                <Button 
                  size="lg" 
                  onClick={() => onStartGame(selectedDifficulty)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <Trophy className="h-5 w-5 mr-2" />
                  Start {selectedDifficulty === 'easy' ? 'Easy' : 'Hard'} Puzzle
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="text-center">
            <CardContent className="pt-6">
              <Clock className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <h3 className="font-semibold">Daily Puzzles</h3>
              <p className="text-xs text-muted-foreground">New challenge every day</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <Lightbulb className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
              <h3 className="font-semibold">Smart Hints</h3>
              <p className="text-xs text-muted-foreground">Get help when you need it</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <Zap className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <h3 className="font-semibold">Two Difficulties</h3>
              <p className="text-xs text-muted-foreground">Easy and hard modes</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
