# 🚀 DON'T PRESS - Complete Setup Guide

This guide will walk you through setting up the entire Don't Press application from scratch.

---

## ⏱️ Estimated Setup Time: 30-45 minutes

---

## 📋 Prerequisites Checklist

Before you begin, ensure you have:

- [ ] **Node.js 18+** installed ([nodejs.org](https://nodejs.org))
- [ ] **npm** (comes with Node.js)
- [ ] A **Supabase account** ([supabase.com](https://supabase.com))
- [ ] A **Vercel account** for deployment (optional, [vercel.com](https://vercel.com))
- [ ] **Git** installed
- [ ] A code editor (VS Code recommended)

---

## 🎯 Part 1: Local Development Setup

### Step 1: Install Dependencies

```bash
cd dont-press
npm install
```

This installs:
- Next.js 14
- React 18
- Supabase client
- Tailwind CSS
- TypeScript
- Lucide React (icons)
- Framer Motion (animations)

### Step 2: Verify Installation

```bash
npm run dev
```

You should see:
```
✓ Ready in X ms
○ Local: http://localhost:3000
```

Press `Ctrl+C` to stop (we need to configure Supabase first).

---

## 🗄️ Part 2: Supabase Setup

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Fill in:
   - **Name:** `dont-press` (or your choice)
   - **Database Password:** Create a strong password (save this!)
   - **Region:** Choose closest to you
   - **Pricing Plan:** Free tier is fine for MVP
4. Click **"Create new project"**
5. Wait 2-3 minutes for setup to complete

### Step 2: Run Database Schema

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New Query"**
3. Open the file `supabase-schema.sql` from your project
4. Copy **ALL** the SQL code
5. Paste it into the Supabase SQL Editor
6. Click **"Run"** (or press `Ctrl+Enter`)

You should see:
```
Success. No rows returned
```

**What this does:**
- Creates all database tables (users, challenges, stories, reactions, comments, chains)
- Sets up Row Level Security (RLS) policies
- Creates storage bucket for photos
- Inserts 25+ initial challenges
- Sets up user profile creation trigger

### Step 3: Verify Database Tables

1. Go to **Table Editor** (left sidebar)
2. You should see these tables:
   - users
   - challenges
   - challenge_categories
   - challenge_assignments
   - stories
   - reactions
   - comments
   - chains
   - chain_nodes
   - inspiration_events

3. Click on **challenges** table
4. You should see ~25 challenges already loaded

### Step 4: Verify Storage Bucket

1. Go to **Storage** (left sidebar)
2. You should see a bucket named **`story-photos`**
3. The bucket should be **Public**

### Step 5: Enable Authentication Providers

#### Enable Email Authentication (Already enabled)
1. Go to **Authentication** → **Providers**
2. **Email** should be enabled by default
3. Confirm email is enabled

#### Enable Google Authentication (Optional but Recommended)
1. In **Authentication** → **Providers**, find **Google**
2. Toggle it **ON**
3. You need Google OAuth credentials:

**Getting Google OAuth Credentials:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Go to **APIs & Services** → **Credentials**
4. Click **"Create Credentials"** → **"OAuth client ID"**
5. Choose **"Web application"**
6. Add authorized redirect URIs:
   - `https://your-project-ref.supabase.co/auth/v1/callback`
   - (Get your exact URL from Supabase Auth settings)
7. Copy **Client ID** and **Client Secret**
8. Paste them into Supabase Google provider settings
9. Click **Save**

#### Enable Apple Authentication (Optional)
Similar process but requires Apple Developer account.

### Step 6: Get API Credentials

1. Go to **Settings** → **API** (left sidebar)
2. Find these two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)
3. **Keep this page open** - you'll need these in the next step

---

## 🔐 Part 3: Environment Configuration

### Step 1: Create Environment File

In your project root, create `.env.local`:

```bash
# Copy .env.example to .env.local
cp .env.example .env.local
```

### Step 2: Add Your Supabase Credentials

Edit `.env.local` and replace with your values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**⚠️ Important:**
- Replace `your-project-ref` with your actual Supabase project reference
- Replace `your-anon-key-here` with your actual anon key
- Don't commit this file to Git (it's in .gitignore)

### Step 3: Verify Configuration

Your `.env.local` should look something like:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG0iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY5...
```

---

## 🏃 Part 4: Run the Application

### Step 1: Start Development Server

```bash
npm run dev
```

### Step 2: Open in Browser

Go to [http://localhost:3000](http://localhost:3000)

You should see:
- The landing page
- "DON'T PRESS" heading
- The glowing red PRESS button
- How it works section

### Step 3: Test Authentication

1. Click **"Sign In"** (top right)
2. Click **"Sign Up"** (at bottom)
3. Enter an email and password
4. Click **"Sign Up"**
5. Check your email for confirmation link
6. Click the confirmation link
7. You'll be redirected to the app

### Step 4: Test Core Features

#### Press the Button
1. Click the big red **PRESS** button
2. Choose a category (e.g., "Good Deed")
3. You should see a random challenge
4. Click **ACCEPT**

#### Complete a Challenge
1. Write a story about completing the challenge
2. Optionally upload a photo
3. Click **"Publish Your Story"**
4. You should be redirected to the feed

#### View Feed
1. You should see your story in the feed
2. Try reacting to it
3. Try commenting on it

#### Check Profile
1. Click **Profile** (bottom navigation on mobile, top on desktop)
2. You should see your stats
3. You should see your posted story

---

## 🎨 Part 5: Customization (Optional)

### Change Branding

Edit `app/page.tsx` and other pages to change:
- App name
- Tagline
- Colors
- Text

### Modify Challenges

Edit `lib/challenges-data.ts` or add challenges directly in Supabase:
1. Go to Supabase **Table Editor**
2. Open **challenges** table
3. Click **"Insert row"**
4. Fill in challenge details
5. Save

### Adjust Colors

Edit `tailwind.config.js`:
```javascript
colors: {
  'primary-dark': '#YOUR_COLOR',
  'coral-red': '#YOUR_COLOR',
  // ... etc
}
```

---

## 🚀 Part 6: Deployment to Production

### Deploy to Vercel (Recommended)

#### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-repo-url
git push -u origin main
```

#### Step 2: Connect to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click **"New Project"**
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`

#### Step 3: Add Environment Variables
In Vercel project settings, add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### Step 4: Deploy
Click **"Deploy"**

Wait 2-3 minutes for deployment.

#### Step 5: Update Supabase Auth Settings
1. Go to Supabase **Authentication** → **URL Configuration**
2. Add your Vercel URL to **Redirect URLs**:
   - `https://your-app.vercel.app/app`
   - `https://your-app.vercel.app/auth`

---

## 🐛 Troubleshooting

### Issue: "Failed to connect to Supabase"
**Solution:**
- Check your `.env.local` file exists
- Verify the URL and keys are correct
- Restart the dev server (`npm run dev`)

### Issue: "Row Level Security policy violation"
**Solution:**
- Ensure you ran the entire `supabase-schema.sql`
- Check RLS policies in Supabase **Authentication** → **Policies**

### Issue: "Challenge not loading"
**Solution:**
- Check if challenges exist: Go to Supabase → **Table Editor** → **challenges**
- If empty, run `SELECT insert_initial_challenges();` in SQL Editor

### Issue: "Photo upload failed"
**Solution:**
- Check storage bucket exists: Supabase → **Storage** → **story-photos**
- Verify storage policies are set correctly

### Issue: "Google login not working"
**Solution:**
- Verify Google OAuth credentials are correct
- Check redirect URI matches exactly
- Make sure Google provider is enabled in Supabase

### Issue: Port 3000 already in use
**Solution:**
```bash
# Use a different port
npm run dev -- -p 3001
```

---

## ✅ Setup Verification Checklist

Before considering setup complete, verify:

- [ ] Dev server runs without errors
- [ ] Landing page loads correctly
- [ ] Can create an account
- [ ] Can sign in
- [ ] Can press the button
- [ ] Can see random challenge
- [ ] Can complete challenge
- [ ] Can post story
- [ ] Story appears in feed
- [ ] Can react to stories
- [ ] Can comment on stories
- [ ] Profile page works
- [ ] Stats are calculated
- [ ] Photo upload works

---

## 📚 Next Steps

After successful setup:

1. **Read the README.md** - Understand the full project
2. **Review the code** - Familiarize yourself with the structure
3. **Test thoroughly** - Create multiple accounts, test all features
4. **Customize** - Make it your own
5. **Deploy** - Share with real users
6. **Iterate** - Gather feedback and improve

---

## 🆘 Getting Help

If you encounter issues:

1. Check this guide again
2. Review error messages carefully
3. Check Supabase logs (Dashboard → Logs)
4. Check browser console for errors
5. Create an issue in the repository

---

## 🎉 Congratulations!

You now have a fully functional Don't Press application running!

**What you've built:**
- A complete social network
- Real-time challenge system
- Story sharing platform
- Chain tracking system
- User profiles and stats
- Photo uploads
- Reactions and comments

**Now go make the world a little bit kinder.** ❤️

---

*Remember: The goal is to get people offline and doing good in the real world.*
