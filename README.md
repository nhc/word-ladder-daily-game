# Word Ladder Game

A fun and challenging word puzzle game built with Next.js, React, and PixiJS.

![Word Ladder Game Screenshot](readme/screenshot.png)

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

- **🎯 Daily Puzzles**: Fresh, unique puzzles every day with intelligent generation system
- **🧠 Smart Validation**: Real-time dictionary validation using Free Dictionary API
- **💡 Advanced Hints**: AI-generated descriptive clues that help you learn new words
- **🔄 Duplicate Prevention**: Sophisticated system ensures no repeated puzzles for months
- **📱 Responsive Design**: Works perfectly on desktop and mobile devices
- **🎨 Interactive Graphics**: Beautiful PixiJS-powered letter interface with smooth animations
- **⚡ Fast Performance**: Optimized with caching, intelligent algorithms, and error handling
- **🎲 Three Difficulty Levels**: Easy, Hard, and Extra-Hard with appropriate vocabulary
- **🔍 Quality Assurance**: Smart word selection based on connectivity and linguistic patterns

## 🎲 Difficulty Levels

- **Easy**: Common, everyday words that most people know (5-letter words, 1-letter changes)
- **Hard**: Challenging vocabulary and less common words (5-letter words, 1-letter changes)
- **Extra-Hard**: Advanced puzzles with uncommon words (5-7 letter words, 2-3 letter changes)

## 🛠️ Technical Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Graphics**: PixiJS for interactive letter rendering
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS with shadcn/ui components
- **AI**: OpenAI GPT-4o for intelligent clue generation
- **Word Data**: 45,000+ filtered English words with smart selection algorithms
- **Validation**: Free Dictionary API for real-time word checking
- **Generation**: Deterministic algorithms with duplicate prevention

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
# Add your DATABASE_URL and OPEN_AI_API_KEY

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
OPEN_AI_API_KEY="your_openai_api_key_here"
```

## 🎯 Game Mechanics

### Word Validation

- **Real-time checking** against English dictionary
- **Cached results** for better performance
- **Graceful fallbacks** if API is unavailable

### Intelligent Puzzle Generation

Our advanced puzzle generation system combines deterministic algorithms with AI-powered clue creation:

#### **Smart Starting Word Selection**

- **Connectivity Analysis**: Prioritizes words with many valid transitions
- **Quality Scoring**: Evaluates words based on letter diversity, vowel balance, and linguistic patterns
- **Difficulty-Appropriate Vocabulary**: Easy puzzles use common words, hard puzzles use uncommon ones
- **Duplicate Prevention**: Checks against puzzles from the previous month to ensure uniqueness

#### **Deterministic Generation Strategy**

- **Reproducible Results**: Same date always generates the same puzzle
- **Seeded Randomness**: Uses date + difficulty + seed modifier for controlled variation
- **High Success Rate**: Intelligent word selection reduces failed generation attempts
- **Multiple Attempts**: Automatically tries different seeds if duplicates are detected

#### **AI-Enhanced Clue Quality**

- **Descriptive Clues**: GPT-4o generates rich, detailed clues that help players understand word meanings
- **Difficulty-Appropriate**: Easy clues are straightforward, hard clues require deeper vocabulary knowledge
- **Quality Validation**: AI verifies word meanings and provides context for uncommon words
- **Fallback System**: Graceful handling if AI clue generation fails

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

### Puzzle Generation Commands

Our intelligent puzzle generation system creates high-quality puzzles with automatic duplicate prevention and smart word selection.

#### **Single Day Generation**

```bash
# Default: tomorrow
pnpm puzzles:generate

# Specific date (YYYY-MM-DD)
pnpm puzzles:generate 2025-09-20

# Relative dates
pnpm puzzles:generate today
pnpm puzzles:generate tomorrow
```

#### **Week Generation (7 consecutive days)**

```bash
# Starting from today/tomorrow
pnpm puzzles:generate week today
pnpm puzzles:generate week tomorrow

# Starting from specific date
pnpm puzzles:generate week 2025-09-20
```

#### **Generation Strategies**

The system uses the **deterministic** strategy by default, which combines intelligent word selection with AI-generated clues:

```bash
# Use deterministic strategy (default)
pnpm puzzles:generate 2025-09-20 --strategy=deterministic

# Use legacy AI-only generation (fallback)
pnpm puzzles:generate 2025-09-20 --strategy=holistic

# Use legacy stepwise generation (extra-hard only)
pnpm puzzles:generate 2025-09-20 --strategy=stepwise
```

#### **Generation Features**

- **Automatic Duplicate Detection**: Checks against puzzles from the previous month
- **Smart Starting Words**: Uses connectivity analysis and quality scoring
- **Reproducible Results**: Same date/difficulty always generates the same puzzle
- **Graceful Retries**: Automatically tries different variations if duplicates are found
- **Existing Puzzle Skip**: Won't overwrite puzzles that already exist
- **Progress Logging**: Detailed output showing word selection and duplicate checking

### Technical Implementation

#### **Word Quality Scoring Algorithm**

Our starting word selection uses a sophisticated scoring system:

```typescript
// Scoring factors for word quality
const scoreStartingWord = (
  word: string,
  wordList: string[],
  difficulty: string
) => {
  let score = 0;

  // Connectivity (30-35%): How many valid next words exist
  score += analyzeWordConnectivity(word, wordList) * 0.35;

  // Difficulty Appropriateness (25%): Common vs uncommon words
  score += isDifficultyAppropriate(word, difficulty) * 25;

  // Letter Diversity (20%): Prefer words with varied letters
  score += (uniqueLetters / word.length) * 20;

  // Vowel Balance (10-15%): Optimal vowel/consonant ratios
  score += vowelBalanceScore(word) * 15;

  // Pattern Avoidance (10%): Avoid repetitive patterns
  score += hasNoRepeats(word) ? 10 : 0;

  return score;
};
```

#### **Duplicate Detection System**

- **Time Range**: Checks puzzles from the previous month
- **Exact Matches**: Prevents identical start words or sequences
- **Overlap Analysis**: Detects >50% word overlap between puzzles
- **Graceful Handling**: Automatically tries different seeds when duplicates found

#### **Data Flow**

1. **Word List Loading**: Filters 45,000+ words by length (5, 6, or 7 letters)
2. **Quality Scoring**: Ranks all words by connectivity and linguistic quality
3. **Smart Selection**: Takes top 30-40% of candidates, then shuffles deterministically
4. **Sequence Building**: Uses recursive backtracking to find valid 6-word sequences
5. **Duplicate Checking**: Validates against recent puzzles in database
6. **AI Clue Generation**: Creates descriptive clues using GPT-4o
7. **Database Storage**: Saves complete puzzle with metadata

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
├── data/              # Word lists and filtering
├── prisma/            # Database schema and migrations
└── scripts/           # Puzzle generation system
    └── autogenerate-puzzles.ts  # Main generation logic
```

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect your GitHub repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy automatically** on every push

### Environment Variables for Production

- `DATABASE_URL`: Your Neon PostgreSQL connection string
- `OPEN_AI_API_KEY`: Your OpenAI API key

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **Free Dictionary API** for real-time word validation
- **OpenAI GPT-4o** for intelligent clue generation and puzzle assistance
- **PixiJS** for beautiful interactive graphics and animations
- **Prisma** for excellent database ORM and type safety
- **shadcn/ui** for beautiful, accessible React components
- **Tailwind CSS** for rapid, responsive styling
- **Vercel** for seamless deployment and hosting platform

---

**Have fun playing Word Ladder! 🎮**
