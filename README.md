# DON'T PRESS 🔴

A social network where one small action can start a chain of good.

**Tagline:** *You pressed it. Now do something worth passing on.*

---

## 🎯 What is Don't Press?

Don't Press is a social platform centered around real-world good deeds, kindness, challenges, and human connection. The central concept is a mysterious button that users naturally want to press. When they do, they receive a random safe challenge to complete in the real world, share their story, and pass it on—creating chains of positive actions.

### Core Philosophy
**Do something good. Tell the story. Pass it on.**

### The Experience Loop
PRESS → CHOOSE → DISCOVER → DO → SHARE → PASS → INSPIRE → REPEAT

---

## ✨ Key Features (MVP)

### 🔴 The Button
- Mysterious, iconic "DON'T PRESS" button
- Full-screen press experience with animations
- Category selection after pressing

### 🎯 Challenge System
- 8 challenge categories: Good Deed, Help Someone, Community, Give, Creative, Fun, Learn & Share, Random
- 25+ curated, safe challenges
- Random challenge assignment by category
- Accept, Pass, or Donate options
- Challenge metadata (difficulty, time, requirements)

### 📖 Story Sharing
- Photo upload (optional)
- Text-based storytelling
- Anonymous posting option
- Beautiful story cards with reactions
- Comments and engagement

### 🔥 Chain System
- Track challenge chains
- See how actions connect
- Chain visualization
- Position tracking

### ❤️ Reactions & Engagement
- "Inspired" reaction (primary)
- Multiple reaction types (Beautiful, Helpful, Smile, Respect)
- Comments
- Share functionality
- Pass it on feature

### 👤 User Profiles
- Personal stats dashboard
- Story history
- Chain participation
- Impact metrics

### 🔍 Discovery
- Most Inspiring stories
- Recent stories
- Active chains
- Category browsing

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Fonts:** Inter, Space Grotesk
- **Icons:** Lucide React

### Backend & Database
- **Backend:** Supabase
- **Database:** PostgreSQL
- **Authentication:** Supabase Auth (Email, Google, Apple)
- **Storage:** Supabase Storage
- **Real-time:** Supabase Realtime

### Deployment
- **Frontend:** Vercel (recommended)
- **Backend:** Supabase Cloud

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- A Supabase account ([supabase.com](https://supabase.com))
- Git

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd dont-press
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Supabase

#### Create a New Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to initialize

#### Run the Database Schema
1. Go to the SQL Editor in your Supabase dashboard
2. Copy the entire contents of `supabase-schema.sql`
3. Paste and run it in the SQL Editor
4. This will create all tables, policies, and initial data

#### Set Up Storage
The schema automatically creates the `story-photos` storage bucket. Verify it exists in:
- Supabase Dashboard → Storage → Buckets

#### Enable Authentication Providers
1. Go to Authentication → Providers
2. Enable **Email** (enabled by default)
3. Enable **Google** (optional):
   - Add your Google OAuth credentials
   - Set redirect URL: `http://localhost:3000/app`
4. Enable **Apple** (optional)

### 4. Configure Environment Variables

Create `.env.local` in the root directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Get these values from:
- Supabase Dashboard → Settings → API

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
dont-press/
├── app/
│   ├── app/              # Main application pages (authenticated)
│   │   ├── page.tsx      # Feed/Home
│   │   ├── press/        # Press button experience
│   │   ├── complete/     # Challenge completion
│   │   ├── profile/      # User profile
│   │   ├── discover/     # Discovery page
│   │   └── chains/       # Chains page
│   ├── auth/             # Authentication pages
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Landing page
│   └── globals.css       # Global styles
├── components/
│   ├── Navigation.tsx    # Main navigation
│   └── StoryCard.tsx     # Story display component
├── lib/
│   ├── supabase.ts       # Supabase client & types
│   └── challenges-data.ts # Challenge definitions
├── public/               # Static assets
├── supabase-schema.sql   # Database schema
├── .env.example          # Environment variables template
├── .env.local            # Your local environment (create this)
├── next.config.js        # Next.js configuration
├── tailwind.config.js    # Tailwind configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies
```

---

## 🎨 Design System

### Colors
- **Primary Dark:** `#101113` - Main background
- **Warm White:** `#FAF8F3` - Text and surfaces
- **Coral Red:** `#FF5A5F` - Primary action color (the button)
- **Warm Orange:** `#FF9F43` - Secondary highlights
- **Kindness Green:** `#45C486` - Completed actions
- **Soft Yellow:** `#FFD166` - Inspiring stories
- **Deep Green:** `#183D35` - Background accent

### Typography
- **Body:** Inter (300-800 weights)
- **Display:** Space Grotesk (500-700 weights)

### Key Components
- **Press Button:** Large, glowing, animated
- **Cards:** Rounded (3xl), subtle backdrop blur
- **Buttons:** Rounded (2xl), hover scale effects
- **Navigation:** Bottom bar (mobile), Top bar (desktop)

---

## 🔒 Security & Safety

### Challenge Safety
- All challenges are pre-curated and reviewed
- No dangerous, illegal, or humiliating challenges
- Clear safety warnings
- Age verification (18+)

### Privacy
- Optional anonymous posting
- Profile visibility controls
- No required personal information
- Privacy-first photo guidelines
- Never require photographing strangers

### Moderation
- Row Level Security (RLS) enabled on all tables
- User-based data access policies
- Report functionality (to be built)
- Content moderation system (to be built)

---

## 🗺️ Roadmap

### ✅ MVP (Current)
- [x] Landing page
- [x] Authentication (Email, Google)
- [x] Press button experience
- [x] Challenge system
- [x] Story posting
- [x] Social feed
- [x] Reactions & comments
- [x] User profiles
- [x] Basic chains
- [x] Discovery page

### 🚧 Version 2 (Planned)
- [ ] Pass challenge to another user
- [ ] Inspiration chain tracking
- [ ] Donation integration
- [ ] Badge system
- [ ] Featured stories
- [ ] Notifications
- [ ] Advanced search
- [ ] Better chain visualization
- [ ] Social sharing cards
- [ ] Admin dashboard

### 🔮 Version 3 (Future)
- [ ] Native mobile apps (iOS, Android)
- [ ] Location-based challenges
- [ ] Organization/charity integration
- [ ] Group challenges
- [ ] Community programs
- [ ] Verified charities
- [ ] Analytics dashboard

---

## 📝 Database Schema Overview

### Core Tables
- **users** - User profiles (extends Supabase auth)
- **challenges** - Challenge library
- **challenge_categories** - Challenge categories
- **challenge_assignments** - User challenge assignments
- **stories** - Completed challenge stories
- **reactions** - Story reactions (inspired, beautiful, etc.)
- **comments** - Story comments
- **chains** - Challenge chains
- **chain_nodes** - Individual chain participants
- **inspiration_events** - Inspiration tracking

### Storage
- **story-photos** - User-uploaded photos

---

## 🧪 Testing

### Manual Testing Checklist
1. **Authentication**
   - [ ] Sign up with email
   - [ ] Sign in with email
   - [ ] Sign in with Google
   - [ ] Sign out

2. **Press Flow**
   - [ ] Press the button
   - [ ] Select a category
   - [ ] View random challenge
   - [ ] Accept challenge
   - [ ] Pass challenge

3. **Complete Challenge**
   - [ ] Write story
   - [ ] Upload photo
   - [ ] Post anonymously
   - [ ] Submit story

4. **Social Features**
   - [ ] View feed
   - [ ] React to story
   - [ ] Comment on story
   - [ ] View profile
   - [ ] View chains

---

## 🐛 Known Issues & Limitations

### Current Limitations
- No mobile apps yet (web only)
- No push notifications
- No real-time updates (requires refresh)
- Passing challenges to users not fully implemented
- No donation integration yet
- Basic chain visualization
- No admin dashboard

### To Fix
- Add proper error handling
- Improve loading states
- Add form validation
- Optimize image uploads
- Add image compression

---

## 🤝 Contributing

This is an MVP. Contributions welcome!

### Development Guidelines
1. Follow the existing code style
2. Use TypeScript strictly
3. Write meaningful commit messages
4. Test your changes locally
5. Update documentation as needed

---

## 📄 License

[Add your license here]

---

## 🙏 Credits

**Concept:** Social network for real-world kindness and good deeds  
**Design Inspiration:** Modern web aesthetics, human-centered design  
**Philosophy:** Real-world action over passive scrolling

---

## 📞 Support

For questions or issues:
- Create an issue in this repository
- Email: [your-email]

---

## 🌟 Key Differentiators

Unlike other kindness platforms:
- **The Button:** Mysterious, game-like entry point
- **Random Challenges:** Surprise element keeps it fresh
- **Pass It On:** Challenges can be passed to others
- **Chains:** Visible connections between actions
- **Inspiration Tracking:** See how your story inspired others
- **Stories Over Metrics:** Emphasis on narrative, not vanity metrics
- **Real-world Focus:** Get people offline and doing good

---

**Remember:** The goal is not to build another platform that keeps people scrolling. The goal is to build a platform that makes people close the app and do something in the real world.

---

*You pressed it. Now do something worth passing on.* ❤️
