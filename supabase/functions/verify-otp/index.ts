import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MSG91_AUTH_KEY = Deno.env.get('MSG91_AUTH_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, otp } = await req.json()

    // Validate inputs
    if (!phone || !/^\+91[6-9]\d{9}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (!otp || !/^\d{6}$/.test(otp)) {
      return new Response(
        JSON.stringify({ error: 'Invalid OTP format' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Extract phone without country code for MSG91
    const phoneNumber = phone.slice(3)

    console.log(`[MSG91] Verifying OTP for ${phoneNumber}`)

    // Verify OTP with MSG91
    const response = await fetch(
      `https://control.msg91.com/api/v5/otp/verify?mobile=${phoneNumber}&otp=${otp}`,
      {
        method: 'GET',
        headers: { 'authkey': MSG91_AUTH_KEY }
      }
    )

    const data = await response.json()
    console.log(`[MSG91] Verify response:`, data)

    if (data.type !== 'success') {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired OTP' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // OTP verified successfully! Now check user in database
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Check if user is admin
    const { data: adminData } = await supabase
      .from('books.admins')
      .select('phone')
      .eq('phone', phone)
      .maybeSingle()

    const isAdmin = !!adminData

    // Get shop data if not admin
    let shopData = null
    if (!isAdmin) {
      const { data: shop } = await supabase
        .from('books.shops')
        .select('*')
        .eq('phone', phone)
        .maybeSingle()

      shopData = shop
    }

    console.log(`[AUTH] User ${phone}: isAdmin=${isAdmin}, hasShop=${!!shopData}`)

    return new Response(
      JSON.stringify({
        success: true,
        phone,
        isAdmin,
        shop: shopData,
        message: 'OTP verified successfully'
      }),
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('[MSG91] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    )
  }
})
