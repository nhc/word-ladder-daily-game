# Word Ladder Game

A fun and challenging word puzzle game built with Next.js, React, and PixiJS.

<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" alt="Word Ladder Game Screenshot" width="600">

## 🎮 How to Play

**Objective:** Transform one word into another by changing one letter at a time.

### Game Rules

1. **Start with a 5-letter word** (e.g., "PLANT")
2. **Change one letter** to form a new valid English word
3. **Continue the chain** until you reach the target word
4. **Each step must be a real English word**
5. **Use hints** if you get stuck (limited uses)

### Example Game

```
PLANT → PLANE → PLATE → SLATE → SLANT
```

## ✨ Features

- **🎯 Daily Puzzles**: Fresh puzzles every day with different difficulty levels
- **🧠 Smart Validation**: Real-time dictionary validation using Free Dictionary API
- **💡 Hints System**: Get help when you're stuck
- **📱 Responsive Design**: Works on desktop and mobile
- **🎨 Interactive Graphics**: Beautiful PixiJS-powered letter interface
- **⚡ Fast Performance**: Optimized with caching and error handling

## 🎲 Difficulty Levels

- **Easy**: Common, everyday words that most people know
- **Hard**: Challenging vocabulary, proper nouns, or less common words

## 🛠️ Technical Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Graphics**: PixiJS for interactive letter rendering
- **Database**: PostgreSQL (Neon) with Prisma ORM
- **Styling**: Tailwind CSS
- **AI**: Abacus.ai for puzzle generation
- **Validation**: Free Dictionary API for word checking

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd word_ladder_game/app

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Add your DATABASE_URL and ABACUSAI_API_KEY

# Set up the database
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Start development server
pnpm dev
```

### Environment Variables

```env
DATABASE_URL="postgresql://username:password@host:port/database"
ABACUSAI_API_KEY="your_api_key_here"
```

## 🎯 Game Mechanics

### Word Validation

- **Real-time checking** against English dictionary
- **Cached results** for better performance
- **Graceful fallbacks** if API is unavailable

### Puzzle Generation

- **AI-powered** puzzle creation using Abacus.ai
- **Validation checks** to ensure valid word ladders
- **Retry mechanism** for quality assurance
- **Daily caching** to avoid regeneration

### Hint System

- **Visual highlighting** of the letter to change
- **Limited uses** to maintain challenge
- **Smart positioning** based on game progress

## 📱 User Interface

### Desktop

- **Interactive letter tiles** with hover effects
- **Modal letter picker** for easy letter selection
- **Progress tracking** and statistics
- **Responsive layout** for different screen sizes

### Mobile

- **Touch-friendly** letter selection
- **Optimized spacing** for smaller screens
- **Swipe gestures** for navigation

## 🎨 Visual Design

- **Modern dark theme** with blue accents
- **Smooth animations** and transitions
- **Clear typography** for readability
- **Consistent spacing** and layout

## 🏆 Scoring System

- **Completion time** tracking
- **Hint usage** penalties
- **Daily streaks** and achievements
- **Leaderboards** (future feature)

## 🔧 Development

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm db:generate  # Generate Prisma client
pnpm db:migrate   # Run database migrations
pnpm db:deploy    # Deploy migrations to production
pnpm db:seed      # Seed database with sample data
```

### Project Structure

```
app/
├── components/          # React components
│   ├── ui/            # Reusable UI components
│   ├── word-ladder-game.tsx
│   └── pixi-game.tsx
├── app/
│   ├── api/           # API routes
│   │   ├── daily-puzzle/
│   │   ├── generate-puzzle/
│   │   └── validate-word/
│   └── page.tsx       # Main page
├── lib/               # Utilities and database
├── prisma/            # Database schema and migrations
└── scripts/           # Database seeding scripts
```

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect your GitHub repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy automatically** on every push

### Environment Variables for Production

- `DATABASE_URL`: Your Neon PostgreSQL connection string
- `ABACUSAI_API_KEY`: Your Abacus.ai API key

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **Free Dictionary API** for word validation
- **Abacus.ai** for puzzle generation
- **PixiJS** for interactive graphics
- **Neon** for PostgreSQL hosting
- **Vercel** for deployment platform

---

**Have fun playing Word Ladder! 🎮**
