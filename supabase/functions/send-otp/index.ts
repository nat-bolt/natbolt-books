import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const MSG91_AUTH_KEY = Deno.env.get('MSG91_AUTH_KEY')!
const MSG91_TEMPLATE_ID = Deno.env.get('MSG91_TEMPLATE_ID') // DLT template ID (optional)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  try {
    // Parse request body
    const body = await req.text()
    const { phone } = JSON.parse(body || '{}')

    // Validate phone number (Indian format: +91 followed by 10 digits)
    if (!phone || !/^\+91[6-9]\d{9}$/.test(phone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format. Expected: +91XXXXXXXXXX' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Extract phone without country code for MSG91
    const phoneNumber = phone.slice(3) // Remove '+91'

    console.log(`[MSG91] Sending OTP to ${phoneNumber}`)

    // Send OTP via MSG91 SendOTP API
    // Docs: https://docs.msg91.com/p/tf9GTextN/e/WUaa-n4SF/MSG91
    const response = await fetch(
      `https://control.msg91.com/api/v5/otp`,
      {
        method: 'POST',
        headers: {
          'authkey': MSG91_AUTH_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          mobile: phoneNumber,
          template_id: MSG91_TEMPLATE_ID, // DLT template (required for India)
          otp_length: 6,
          otp_expiry: 5 // 5 minutes
        })
      }
    )

    const data = await response.json()
    console.log(`[MSG91] API Response Status: ${response.status}`)
    console.log(`[MSG91] API Response Data:`, JSON.stringify(data))

    if (response.ok && data.type === 'success') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'OTP sent successfully',
          request_id: data.request_id
        }),
        { headers: corsHeaders }
      )
    } else {
      const errorMsg = data.message || data.error || `MSG91 API error (${response.status})`
      console.error(`[MSG91] Send OTP failed:`, errorMsg)
      throw new Error(errorMsg)
    }
  } catch (error) {
    console.error('[MSG91] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    )
  }
})
