-- DON'T PRESS Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all profiles" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Challenge categories table
CREATE TABLE IF NOT EXISTS public.challenge_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Challenges table
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  estimated_time TEXT,
  requires_other_person BOOLEAN DEFAULT false,
  requires_money BOOLEAN DEFAULT false,
  requires_location BOOLEAN DEFAULT false,
  proof_type TEXT,
  safety_level TEXT DEFAULT 'safe',
  age_suitability INTEGER DEFAULT 18,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on challenges
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- Challenges policies
CREATE POLICY "Anyone can view active challenges" ON public.challenges FOR SELECT USING (active = true);

-- Challenge assignments table
CREATE TABLE IF NOT EXISTS public.challenge_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) NOT NULL,
  challenge_id UUID REFERENCES public.challenges(id) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'completed', 'passed')) DEFAULT 'pending',
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  passed_to_user_id UUID REFERENCES public.users(id),
  chain_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on challenge_assignments
ALTER TABLE public.challenge_assignments ENABLE ROW LEVEL SECURITY;

-- Challenge assignments policies
CREATE POLICY "Users can view own assignments" ON public.challenge_assignments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assignments" ON public.challenge_assignments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assignments" ON public.challenge_assignments FOR UPDATE USING (auth.uid() = user_id);

-- Stories table
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) NOT NULL,
  challenge_id UUID REFERENCES public.challenges(id) NOT NULL,
  assignment_id UUID REFERENCES public.challenge_assignments(id) NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  photo_url TEXT,
  location TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  chain_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on stories
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Stories policies
CREATE POLICY "Anyone can view stories" ON public.stories FOR SELECT USING (true);
CREATE POLICY "Users can insert own stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stories" ON public.stories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stories" ON public.stories FOR DELETE USING (auth.uid() = user_id);

-- Reactions table
CREATE TABLE IF NOT EXISTS public.reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  type TEXT CHECK (type IN ('inspired', 'beautiful', 'helpful', 'smile', 'respect')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(story_id, user_id, type)
);

-- Enable RLS on reactions
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Reactions policies
CREATE POLICY "Anyone can view reactions" ON public.reactions FOR SELECT USING (true);
CREATE POLICY "Users can insert reactions" ON public.reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON public.reactions FOR DELETE USING (auth.uid() = user_id);

-- Comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Comments policies
CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can insert comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- Chains table
CREATE TABLE IF NOT EXISTS public.chains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_by_user_id UUID REFERENCES public.users(id) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  length INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT true
);

-- Enable RLS on chains
ALTER TABLE public.chains ENABLE ROW LEVEL SECURITY;

-- Chains policies
CREATE POLICY "Anyone can view chains" ON public.chains FOR SELECT USING (true);
CREATE POLICY "Users can create chains" ON public.chains FOR INSERT WITH CHECK (auth.uid() = started_by_user_id);

-- Chain nodes table
CREATE TABLE IF NOT EXISTS public.chain_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain_id UUID REFERENCES public.chains(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  story_id UUID REFERENCES public.stories(id),
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on chain_nodes
ALTER TABLE public.chain_nodes ENABLE ROW LEVEL SECURITY;

-- Chain nodes policies
CREATE POLICY "Anyone can view chain nodes" ON public.chain_nodes FOR SELECT USING (true);
CREATE POLICY "Users can insert chain nodes" ON public.chain_nodes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Inspiration events table (tracks when someone was inspired by a story)
CREATE TABLE IF NOT EXISTS public.inspiration_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  inspired_user_id UUID REFERENCES public.users(id) NOT NULL,
  action_story_id UUID REFERENCES public.stories(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on inspiration_events
ALTER TABLE public.inspiration_events ENABLE ROW LEVEL SECURITY;

-- Inspiration events policies
CREATE POLICY "Anyone can view inspiration events" ON public.inspiration_events FOR SELECT USING (true);
CREATE POLICY "Users can insert inspiration events" ON public.inspiration_events FOR INSERT WITH CHECK (auth.uid() = inspired_user_id);

-- Create storage bucket for story photos
INSERT INTO storage.buckets (id, name, public) VALUES ('story-photos', 'story-photos', true);

-- Storage policies for story photos
CREATE POLICY "Anyone can view story photos" ON storage.objects FOR SELECT USING (bucket_id = 'story-photos');
CREATE POLICY "Users can upload story photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'story-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own story photos" ON storage.objects FOR UPDATE USING (bucket_id = 'story-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own story photos" ON storage.objects FOR DELETE USING (bucket_id = 'story-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert initial challenge categories
INSERT INTO public.challenge_categories (id, name, emoji, description) VALUES
  ('good-deed', 'Good Deed', '❤️', 'Small acts of kindness'),
  ('help-someone', 'Help Someone', '🤝', 'Practical help and support'),
  ('community', 'Community', '🌱', 'Actions that benefit your community'),
  ('give', 'Give', '💚', 'Donate time, money, or resources'),
  ('creative', 'Creative', '🎨', 'Create something kind'),
  ('fun', 'Fun', '😂', 'Bring joy and laughter'),
  ('learn-share', 'Learn & Share', '🧠', 'Share knowledge and wisdom')
ON CONFLICT (id) DO NOTHING;

-- Function to insert initial challenges
CREATE OR REPLACE FUNCTION insert_initial_challenges()
RETURNS void AS $$
BEGIN
  -- Good Deed challenges
  INSERT INTO public.challenges (title, description, category, difficulty, estimated_time, requires_other_person, requires_money, proof_type) VALUES
    ('Give a genuine compliment', 'Give someone a genuine, specific compliment today. Make it sincere and about something meaningful.', 'good-deed', 'easy', '5-10 minutes', true, false, 'story'),
    ('Thank someone from your past', 'Reach out to someone who helped you in the past and thank them. Tell them specifically what they did and how it impacted you.', 'good-deed', 'easy', '15-20 minutes', true, false, 'story'),
    ('Buy someone a small treat', 'Buy someone a coffee, snack, or small meal. It could be a friend, colleague, or even a stranger.', 'good-deed', 'easy', '10-15 minutes', true, true, 'photo'),
    ('Send an encouraging message', 'Send an encouraging message to someone who needs it. Think of someone going through a tough time.', 'good-deed', 'easy', '10 minutes', true, false, 'story'),
    ('Leave a generous tip', 'Leave a generous tip for someone in the service industry with a kind note.', 'good-deed', 'easy', '5 minutes', true, true, 'photo'),

    -- Help Someone challenges
    ('Help carry something heavy', 'Help someone carrying groceries, moving furniture, or struggling with a heavy load.', 'help-someone', 'easy', '10-15 minutes', true, false, 'story'),
    ('Teach someone a skill', 'Share your knowledge. Teach someone something you know how to do.', 'help-someone', 'medium', '30-60 minutes', true, false, 'story'),
    ('Help a neighbor with a task', 'Offer to help a neighbor with something practical - yard work, tech help, or a household task.', 'help-someone', 'medium', '30-60 minutes', true, false, 'story'),
    ('Give directions or assistance', 'Help someone who looks lost or confused. Give clear, patient directions or assistance.', 'help-someone', 'easy', '5-10 minutes', true, false, 'story'),

    -- Community challenges
    ('Pick up litter', 'Spend 15 minutes picking up litter in a public area. Bring a bag and gloves.', 'community', 'easy', '15-20 minutes', false, false, 'photo'),
    ('Donate useful items', 'Donate clothes, books, or items you no longer need to a local charity or shelter.', 'community', 'medium', '1-2 hours', false, false, 'photo'),
    ('Support a local business', 'Visit a local small business and make a purchase. Leave a positive review.', 'community', 'easy', '20-30 minutes', false, true, 'photo'),

    -- Give challenges
    ('Donate to a charity', 'Donate $5 or more to a charity of your choice. Research and find one that matters to you.', 'give', 'easy', '10 minutes', false, true, 'receipt'),
    ('Pay for someone behind you', 'Pay for the order of the person behind you in line at a coffee shop or drive-through.', 'give', 'easy', '5 minutes', true, true, 'story'),
    ('Give your time', 'Volunteer an hour of your time to help someone or an organization.', 'give', 'medium', '1-2 hours', false, false, 'story'),

    -- Creative challenges
    ('Create art for someone', 'Make a drawing, painting, or craft for someone. It doesn''t have to be perfect - it just has to be thoughtful.', 'creative', 'medium', '30-60 minutes', true, false, 'photo'),
    ('Write an encouraging note', 'Write a heartfelt, encouraging note and give it to someone or leave it somewhere for a stranger to find.', 'creative', 'easy', '15 minutes', false, false, 'photo'),
    ('Create something that makes someone smile', 'Make something creative - a funny video, a meme, a song, anything - specifically to brighten someone''s day.', 'creative', 'medium', '30-60 minutes', true, false, 'photo'),

    -- Fun challenges
    ('Make someone laugh', 'Tell a joke, share a funny story, or do something silly to make someone genuinely laugh today.', 'fun', 'easy', '5-10 minutes', true, false, 'story'),
    ('Organize a surprise gathering', 'Organize a small surprise gathering or activity for a friend or colleague. Keep it simple and fun.', 'fun', 'medium', '1-2 hours', true, false, 'photo'),
    ('Share something that made you smile', 'Share a funny video, meme, or story with someone who needs a laugh today.', 'fun', 'easy', '5 minutes', true, false, 'story'),

    -- Learn & Share challenges
    ('Learn and teach something new', 'Learn something new today and teach it to someone else. It could be a fact, skill, or insight.', 'learn-share', 'medium', '30-60 minutes', true, false, 'story'),
    ('Share a valuable resource', 'Share a book, article, video, or resource that changed your perspective with someone who might benefit.', 'learn-share', 'easy', '10-15 minutes', true, false, 'story'),
    ('Mentor someone', 'Offer to mentor someone in an area where you have experience. Have a meaningful conversation.', 'learn-share', 'medium', '30-60 minutes', true, false, 'story')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to insert challenges
SELECT insert_initial_challenges();
