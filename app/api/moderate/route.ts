import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// Server-side content check.
//
// This route exists so the moderation verdict comes from somewhere the user
// cannot edit. It is the only place the OpenAI key lives, and it is the only
// thing that can produce the signed token that submit_story() in
// supabase-content-moderation.sql insists on. The browser never sees the key
// and never decides the verdict.
//
// Fails closed. If the key or the shared secret is missing, the request is
// refused rather than waved through, because a moderation system that
// silently approves everything when misconfigured is worse than no moderation
// system: it looks like it is working.

// Never runs longer than this, so a hung upstream call cannot hold a request
// open and become a way to exhaust the function's concurrency.
export const maxDuration = 20

const OPENAI_URL = 'https://api.openai.com/v1/moderations'
const MODEL = 'omni-moderation-latest'

// Tokens are short-lived on purpose: one verdict authorises one post, and a
// captured token cannot be replayed indefinitely.
const TOKEN_TTL_SECONDS = 300

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // Identify the caller first. The token is only used to read the user id;
  // every write still goes through RLS or a database function. An
  // unauthenticated call cannot obtain a token, so it cannot obtain a verdict.
  //
  // Authentication is deliberately checked before the configuration check, so
  // an anonymous caller learns nothing about how this service is set up.
  const authHeader = request.headers.get('authorization') || ''
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!accessToken) {
    return json({ error: 'not_signed_in' }, 401)
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: 'moderation_not_configured' }, 503)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
  if (userError || !userData?.user) {
    return json({ error: 'not_signed_in' }, 401)
  }
  const userId = userData.user.id

  let body: { text?: unknown; photoUrl?: unknown; contentType?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }

  // What kind of content is being checked. Part of the signed payload, so a
  // token issued for a post cannot be spent on a comment. Defaults to 'story'
  // so a caller that omits it still gets the original behaviour rather than an
  // unsigned token.
  const contentType = body.contentType === 'comment' ? 'comment' : 'story'

  // Bound the text we send. The classifier only needs enough to judge, and this
  // keeps a very long comment from becoming an unbounded cost.
  const MAX_TEXT_CHARS = contentType === 'comment' ? 2000 : 4000

  const text = typeof body.text === 'string' ? body.text.slice(0, MAX_TEXT_CHARS) : ''
  const photoUrl = typeof body.photoUrl === 'string' ? body.photoUrl : null

  if (!text.trim() && !photoUrl) {
    return json({ error: 'nothing_to_check' }, 400)
  }

  // Only our own storage is accepted as an image source, and this runs before
  // the provider call. Without it the endpoint would fetch any URL a caller
  // supplies, which turns it into a server-side request forgery primitive
  // against anything the function can reach.
  if (photoUrl) {
    let parsed: URL
    try {
      parsed = new URL(photoUrl)
    } catch {
      return json({ error: 'bad_photo_url' }, 400)
    }
    const expectedHost = new URL(supabaseUrl).hostname
    const isOurs =
      parsed.protocol === 'https:' &&
      (parsed.hostname === expectedHost || parsed.hostname.endsWith('.supabase.co'))
    if (!isOurs) {
      return json({ error: 'bad_photo_url' }, 400)
    }
  }

  // Config gate last of the cheap checks, so the auth and URL guards above are
  // the ones that decide a malformed request.
  const openaiKey = process.env.OPENAI_API_KEY
  const secret = process.env.MODERATION_SECRET
  if (!openaiKey || !secret) {
    console.error('[moderate] not configured:', {
      openai: !!openaiKey,
      secret: !!secret,
    })
    return json({ error: 'moderation_not_configured' }, 503)
  }

  const input: Record<string, unknown>[] = []
  if (text.trim()) input.push({ type: 'text', text })
  if (photoUrl) input.push({ type: 'image_url', image_url: { url: photoUrl } })

  let flagged = false
  let categories: string[] = []
  let providerRaw: unknown = null

  try {
    const upstream = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({ model: MODEL, input }),
      signal: AbortSignal.timeout(15000),
    })

    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 300)
      console.error('[moderate] provider error', upstream.status, detail)
      // Refuse rather than approve. An outage must not quietly turn into
      // "everything is fine".
      return json({ error: 'check_failed' }, 502)
    }

    const payload: any = await upstream.json()
    const result = payload?.results?.[0]
    providerRaw = result ?? null
    flagged = result?.flagged === true
    categories = Object.entries(result?.categories || {})
      .filter(([, hit]) => hit === true)
      .map(([name]) => name)
  } catch (err) {
    console.error('[moderate] provider unreachable', err)
    return json({ error: 'check_failed' }, 502)
  }

  // Sign the verdict. submit_story() / submit_comment() recompute this from a
  // secret the client has never seen, and reject the content if it does not
  // match, so a client cannot talk its way to flagged=false. The content type
  // is inside the signature, so a token minted for a post cannot be spent on a
  // comment.
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  const flagPart = flagged ? 'true' : 'false'
  const signature = createHmac('sha256', secret)
    .update(`${userId}|${contentType}|${flagPart}|${expiresAt}`)
    .digest('hex')

  const token = `${flagPart}.${expiresAt}.${signature}`

  return json({
    flagged,
    categories,
    token,
    // A short, non-scolding explanation. The author is told their post is
    // waiting for review; the reasoning is for the moderator, not for them.
    message: flagged
      ? 'Your post is waiting for a quick review before it appears.'
      : null,
  })
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
