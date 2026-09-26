import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for our database
export interface User {
  id: string
  email: string
  created_at: string
  username?: string
  display_name?: string
  bio?: string
  avatar_url?: string
}

export interface Challenge {
  id: string
  title: string
  description: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
  estimated_time: string
  requires_other_person: boolean
  requires_money: boolean
  requires_location: boolean
  proof_type: string
  safety_level: string
  active: boolean
  created_at: string
}

export interface ChallengeAssignment {
  id: string
  user_id: string
  challenge_id: string
  status: 'pending' | 'accepted' | 'completed' | 'passed'
  assigned_at: string
  completed_at?: string
  passed_to_user_id?: string
  chain_id?: string
}

export interface Story {
  id: string
  user_id: string
  challenge_id: string
  assignment_id: string
  title?: string
  content: string
  photo_url?: string
  location?: string
  is_anonymous: boolean
  created_at: string
  chain_id?: string
  users?: User
  challenges?: Challenge
  reactions?: Reaction[]
  comments?: Comment[]
}

export interface Reaction {
  id: string
  story_id: string
  user_id: string
  type: 'inspired' | 'beautiful' | 'helpful' | 'smile' | 'respect'
  created_at: string
  users?: User
}

export interface Comment {
  id: string
  story_id: string
  user_id: string
  content: string
  created_at: string
  users?: User
}

export interface Chain {
  id: string
  started_by_user_id: string
  started_at: string
  length: number
}

export interface ChainNode {
  id: string
  chain_id: string
  user_id: string
  story_id?: string
  position: number
  created_at: string
}
