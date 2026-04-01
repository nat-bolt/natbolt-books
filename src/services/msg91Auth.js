// MSG91 OTP Authentication Service
// Replaces Firebase Phone Auth with simpler MSG91 API

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[MSG91 Auth] Missing Supabase credentials in environment')
}

const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`

/**
 * Send OTP to phone number via MSG91
 * @param {string} phone - Phone number in format: +91XXXXXXXXXX
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function sendOTP(phone) {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ phone })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || `Failed to send OTP (${response.status})`)
    }

    return data
  } catch (error) {
    console.error('[MSG91 Auth] sendOTP error:', error)
    throw new Error(error.message || 'Failed to send OTP. Please try again.')
  }
}

/**
 * Verify OTP entered by user
 * @param {string} phone - Phone number in format: +91XXXXXXXXXX
 * @param {string} otp - 6-digit OTP
 * @returns {Promise<{success: boolean, phone: string, isAdmin: boolean, shop: object|null}>}
 */
export async function verifyOTP(phone, otp) {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ phone, otp })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || `Failed to verify OTP (${response.status})`)
    }

    return data
  } catch (error) {
    console.error('[MSG91 Auth] verifyOTP error:', error)
    throw new Error(error.message || 'Invalid OTP. Please try again.')
  }
}
