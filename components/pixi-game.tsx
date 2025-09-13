
'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import * as PIXI from 'pixi.js'

interface PixiGameProps {
  currentWord: string
  onLetterClick: (letterIndex: number, newLetter: string) => void
}

interface PixiGameRef {
  highlightLetter: (index: number) => void
}

const PixiGame = forwardRef<PixiGameRef, PixiGameProps>(({ currentWord, onLetterClick }, ref) => {
  const canvasRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const letterSpritesRef = useRef<PIXI.Container[]>([])
  const highlightRef = useRef<PIXI.Graphics | null>(null)

  useImperativeHandle(ref, () => ({
    highlightLetter: (index: number) => {
      if (highlightRef.current && letterSpritesRef.current[index]) {
        const letterContainer = letterSpritesRef.current[index]
        highlightRef.current.clear()
        highlightRef.current.beginFill(0xFFD700, 0.3) // Gold highlight
        highlightRef.current.drawRoundedRect(
          letterContainer.x - 5,
          letterContainer.y - 5,
          letterContainer.width + 10,
          letterContainer.height + 10,
          10
        )
        highlightRef.current.endFill()

        // Remove highlight after 2 seconds
        setTimeout(() => {
          if (highlightRef.current) {
            highlightRef.current.clear()
          }
        }, 2000)
      }
    }
  }))

  useEffect(() => {
    if (!canvasRef.current || appRef.current) return

    // Initialize PIXI Application
    const initializeApp = async () => {
      const app = new PIXI.Application()
      
      await app.init({
        width: 600,
        height: 400,
        backgroundColor: 0x2c3e50,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
      })

      canvasRef.current!.appendChild(app.canvas)
      appRef.current = app

      // Create highlight graphics
      const highlight = new PIXI.Graphics()
      app.stage.addChild(highlight)
      highlightRef.current = highlight
    }

    initializeApp().catch(console.error)

    // Cleanup function
    return () => {
      if (appRef.current) {
        appRef.current.destroy(true)
        appRef.current = null
      }
      if (canvasRef.current && canvasRef.current.firstChild) {
        canvasRef.current.removeChild(canvasRef.current.firstChild)
      }
    }
  }, [])

  useEffect(() => {
    if (!appRef.current || !currentWord) return

    const app = appRef.current

    // Clear existing letter sprites
    letterSpritesRef.current.forEach(sprite => {
      app.stage.removeChild(sprite)
    })
    letterSpritesRef.current = []

    // Create letter sprites
    const letters = currentWord.split('')
    const letterWidth = 80
    const letterHeight = 80
    const spacing = 20
    const startX = (app.screen.width - (letters.length * letterWidth + (letters.length - 1) * spacing)) / 2
    const startY = (app.screen.height - letterHeight) / 2

    letters.forEach((letter, index) => {
      const container = new PIXI.Container()
      
      // Background
      const bg = new PIXI.Graphics()
      bg.beginFill(0x3498db)
      bg.lineStyle(3, 0x2980b9)
      bg.drawRoundedRect(0, 0, letterWidth, letterHeight, 15)
      bg.endFill()
      bg.interactive = true
      bg.cursor = 'pointer'
      container.addChild(bg)

      // Letter text
      const text = new PIXI.Text(letter, {
        fontFamily: 'Arial, sans-serif',
        fontSize: 36,
        fontWeight: 'bold',
        fill: 0xFFFFFF,
        align: 'center'
      })
      text.anchor.set(0.5)
      text.x = letterWidth / 2
      text.y = letterHeight / 2
      container.addChild(text)

      // Position container
      container.x = startX + index * (letterWidth + spacing)
      container.y = startY

      // Click handler - open letter selection
      container.interactive = true
      container.cursor = 'pointer'
      container.on('pointerdown', () => {
        showLetterPicker(index, container.x + letterWidth / 2, container.y - 20)
      })

      app.stage.addChild(container)
      letterSpritesRef.current.push(container)
    })

    // Letter picker function
    function showLetterPicker(letterIndex: number, x: number, y: number) {
      // Remove existing picker
      const existingPicker = app.stage.getChildByName('letterPicker')
      if (existingPicker) {
        app.stage.removeChild(existingPicker)
      }

      const picker = new PIXI.Container()
      picker.name = 'letterPicker'

      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
      const cols = 6
      const rows = Math.ceil(alphabet.length / cols)
      const buttonSize = 30
      const buttonSpacing = 5
      const pickerWidth = cols * (buttonSize + buttonSpacing) - buttonSpacing
      const pickerHeight = rows * (buttonSize + buttonSpacing) - buttonSpacing

      // Background
      const pickerBg = new PIXI.Graphics()
      pickerBg.beginFill(0x34495e, 0.95)
      pickerBg.lineStyle(2, 0x95a5a6)
      pickerBg.drawRoundedRect(-10, -10, pickerWidth + 20, pickerHeight + 20, 10)
      pickerBg.endFill()
      picker.addChild(pickerBg)

      alphabet.forEach((letter, i) => {
        const row = Math.floor(i / cols)
        const col = i % cols
        
        const buttonContainer = new PIXI.Container()
        
        // Button background
        const buttonBg = new PIXI.Graphics()
        buttonBg.beginFill(0x27ae60)
        buttonBg.lineStyle(1, 0x229954)
        buttonBg.drawRoundedRect(0, 0, buttonSize, buttonSize, 5)
        buttonBg.endFill()
        buttonBg.interactive = true
        buttonBg.cursor = 'pointer'
        buttonContainer.addChild(buttonBg)

        // Button text
        const buttonText = new PIXI.Text(letter, {
          fontFamily: 'Arial, sans-serif',
          fontSize: 16,
          fontWeight: 'bold',
          fill: 0xFFFFFF,
          align: 'center'
        })
        buttonText.anchor.set(0.5)
        buttonText.x = buttonSize / 2
        buttonText.y = buttonSize / 2
        buttonContainer.addChild(buttonText)

        buttonContainer.x = col * (buttonSize + buttonSpacing)
        buttonContainer.y = row * (buttonSize + buttonSpacing)

        // Click handler
        buttonContainer.interactive = true
        buttonContainer.cursor = 'pointer'
        buttonContainer.on('pointerdown', () => {
          onLetterClick(letterIndex, letter)
          app.stage.removeChild(picker)
        })

        picker.addChild(buttonContainer)
      })

      // Position picker
      picker.x = Math.max(10, Math.min(x - pickerWidth / 2, app.screen.width - pickerWidth - 10))
      picker.y = Math.max(10, y - pickerHeight - 10)

      app.stage.addChild(picker)

      // Close picker when clicking outside
      const closeHandler = () => {
        app.stage.removeChild(picker)
        app.stage.off('pointerdown', closeHandler)
      }
      
      setTimeout(() => {
        app.stage.on('pointerdown', closeHandler)
      }, 100)
    }

  }, [currentWord, onLetterClick])

  return (
    <div 
      ref={canvasRef} 
      className="flex justify-center items-center w-full"
      style={{ minHeight: '400px' }}
    />
  )
})

PixiGame.displayName = 'PixiGame'

export default PixiGame
