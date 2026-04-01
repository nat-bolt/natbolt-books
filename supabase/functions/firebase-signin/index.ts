// =============================================================================
// NatBolt Billu — Supabase Edge Function: firebase-signin
//
// PURPOSE:
//   Bridges Firebase Phone Auth → Supabase Auth without requiring
//   "Third-Party Auth" to be configured in the Supabase Dashboard.
//
// HOW IT WORKS:
//   1. Frontend passes the Firebase ID token (from firebaseUser.getIdToken())
//   2. This function verifies it using Google's public tokeninfo endpoint
//   3. Extracts the phone number from the verified token
//   4. Creates (or updates) a matching Supabase user keyed by phone
//   5. Signs in as that user → returns a Supabase session to the frontend
//   6. Frontend calls supabase.auth.setSession(session) → RLS policies work ✓
//
// ENVIRONMENT VARIABLES (automatically injected by Supabase into all functions):
//   SUPABASE_URL              — your project URL
//   SUPABASE_SERVICE_ROLE_KEY — service role key (safe here, server-side only)
//   SUPABASE_JWT_SECRET       — used to derive a deterministic user password
//
// CUSTOM SECRETS (set in Supabase Dashboard → Project Settings → Edge Functions):
//   FIREBASE_PROJECT_ID       — your Firebase project ID (e.g. "natbolt-book-xxxxx")
//                               Used to validate the token audience.
// =============================================================================

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** SHA-256 hex of a string (used to derive a stable per-user password). */
async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Stable dummy email that maps a phone number to an auth.users row. */
function dummyEmail(phone: string): string {
  // Strip non-digits (so "+919876543210" → "919876543210@natbolt.phone.internal")
  return `${phone.replace(/\D/g, '')}@natbolt.phone.internal`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Parse request ────────────────────────────────────────────────────
    const { firebase_token } = await req.json();
    if (!firebase_token || typeof firebase_token !== 'string') {
      throw new Error('Missing or invalid firebase_token in request body.');
    }

    // ── 2. Verify the Firebase ID token via Google tokeninfo ────────────────
    // This is the simplest verification path — no JWKS needed for internal use.
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(firebase_token)}`
    );

    if (!tokenInfoRes.ok) {
      throw new Error('Firebase token verification request failed (Google API).');
    }

    const tokenInfo = await tokenInfoRes.json();

    if (tokenInfo.error) {
      throw new Error(`Invalid Firebase token: ${tokenInfo.error_description || tokenInfo.error}`);
    }

    // ── 3. Validate token audience matches our Firebase project ─────────────
    const expectedProjectId = Deno.env.get('FIREBASE_PROJECT_ID');
    if (expectedProjectId && tokenInfo.aud !== expectedProjectId) {
      throw new Error(
        `Token audience "${tokenInfo.aud}" does not match Firebase project "${expectedProjectId}".`
      );
    }

    // ── 4. Extract phone number ─────────────────────────────────────────────
    const phone: string = tokenInfo.phone_number;
    if (!phone) {
      throw new Error('Firebase token does not contain a phone_number claim.');
    }

    // ── 5. Derive stable credentials for this phone user ────────────────────
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET') ?? 'default_fallback_secret';
    const email     = dummyEmail(phone);
    // 32-char hex password: deterministic from (secret + phone), but unguessable externally
    const password  = (await sha256hex(`${jwtSecret}:${phone}`)).substring(0, 32);

    // ── 6. Admin client (service_role key — safe server-side) ───────────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── 7. Create Supabase user (idempotent) ─────────────────────────────────
    const { error: createErr } = await adminClient.auth.admin.createUser({
      email,
      phone,
      password,
      phone_confirm: true,
      email_confirm: true,
      user_metadata: {
        phone_number: phone, // checked by auth_phone() COALESCE fallback
        phone:        phone, // alternative path
      },
    });

    // "already been registered" / "already exists" = user exists, that's fine
    const alreadyExists =
      createErr &&
      (createErr.message.toLowerCase().includes('already been registered') ||
       createErr.message.toLowerCase().includes('already exists') ||
       createErr.message.toLowerCase().includes('duplicate'));

    if (createErr && !alreadyExists) {
      throw createErr;
    }

    // If user already existed, ensure their password & metadata are current
    // (handles the case where the JWT_SECRET changed, which would change the password)
    if (alreadyExists) {
      // Find the user by their dummy email
      const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers({
        perPage: 1000,
      });
      if (listErr) throw listErr;

      const existing = users.find((u) => u.email === email || u.phone === phone);

      if (existing) {
        await adminClient.auth.admin.updateUserById(existing.id, {
          password,
          phone,
          phone_confirm: true,
          email_confirm: true,
          user_metadata: { phone_number: phone, phone },
        });
      }
    }

    // ── 8. Sign in as the user → get a Supabase session ─────────────────────
    const { data: signInData, error: signInErr } = await adminClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInErr) throw signInErr;

    // ── 9. Return the session to the frontend ────────────────────────────────
    return new Response(
      JSON.stringify({ session: signInData.session }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[firebase-signin] Error:', message);

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
