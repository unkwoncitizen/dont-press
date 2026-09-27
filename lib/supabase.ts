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
  active: boolean
  // Goal-chain fields (see supabase-chains.sql)
  kind: 'goal' | 'story'
  title?: string
  description?: string
  category?: string
  goal_amount?: number
  unit?: string
  current_amount: number
  visibility: 'public' | 'private'
  status: 'active' | 'completed'
  image_url?: string
  completed_at?: string
  users?: User
  chain_contributions?: ChainContribution[]
}

export interface ChainContribution {
  id: string
  chain_id: string
  user_id: string
  amount: number
  message?: string
  image_url?: string
  created_at: string
  users?: User
}

// Returned by the create_goal_chain / contribute_to_chain RPC functions.
export interface ChainMutationResult {
  chain_id: string
  current_amount: number
  goal_amount: number
  amount_added?: number
  remaining?: number
  status: 'active' | 'completed'
  just_completed?: boolean
}


export interface ChainNode {
  id: string
  chain_id: string
  user_id: string
  story_id?: string
  position: number
  created_at: string
}
