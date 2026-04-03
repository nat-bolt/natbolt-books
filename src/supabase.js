import { createClient } from '@supabase/supabase-js';
import { auth as firebaseAuth } from './firebase';

const url  = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn(
    '[NatBolt] Supabase env vars missing. ' +
    'Copy .env.example → .env.local and fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.'
  );
}

// ── Supabase client — Firebase Third-Party Auth via accessToken factory ────────
//
// HOW THIS WORKS:
//   Instead of creating a Supabase session (signInWithIdToken / Edge Function),
//   we pass the Firebase ID token directly on every request using the
//   `accessToken` factory. Supabase validates it via Third-Party Auth (Firebase).
//
// REQUIRED SUPABASE DASHBOARD SETUP (one-time):
//   1. Authentication → Third-Party Auth → Add provider → Firebase
//      → Project ID: natbolt-book → Save
//   2. Run natbolt_schema_v5_auth_hook.sql to create the role hook function
//   3. Authentication → Hooks → "Customize Access Token (JWT Claims)" hook
//      → Hook type: PostgreSQL function
//      → Schema: books  |  Function: custom_access_token_hook → Save
//
// WHY THE HOOK IS NEEDED:
//   Firebase JWTs don't include a `role` claim. PostgREST needs role='authenticated'
//   to allow access to the `books` schema. The hook adds it automatically.
export const supabase = createClient(url, anon, {
  db: { schema: 'books' },
  accessToken: async () => {
    try {
      const user = firebaseAuth.currentUser;
      if (!user) return null;
      return await user.getIdToken();
    } catch (err) {
      console.error('[NatBolt] accessToken factory → ERROR:', err.message);
      return null;
    }
  },
});

// =============================================================================
// DATA MAPPERS  (Supabase snake_case → frontend camelCase)
// =============================================================================

export function mapShop(row) {
  if (!row) return null;
  return {
    id:             row.id,
    phone:          row.phone,
    shopName:       row.shop_name,
    ownerName:      row.owner_name,
    gstNumber:      row.gst_number,
    upiId:          row.upi_id,
    address:        row.address,
    city:           row.city           || null,
    pincode:        row.pincode        || null,
    shopCode:       row.shop_code      || null,
    mapsUrl:        row.maps_url       || null,
    qrCodeUrl:      row.qr_code_url    || null,
    shopPhotoUrl:   row.shop_photo_url || null,
    plan:           row.plan,
    planExpiry:     row.plan_expiry,
    billsThisMonth: row.bills_this_month,
    billCount:      row.bill_count,
    estimateCount:  row.estimate_count,
    deletedAt:      row.deleted_at     || null,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

export function mapCustomer(row) {
  if (!row) return null;
  return {
    id:        row.id,
    shopId:    row.shop_id,
    name:      row.name,
    phone:     row.phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapVehicle(row) {
  if (!row) return null;
  return {
    id:           row.id,
    shopId:       row.shop_id,
    customerId:   row.customer_id,
    vehicleNo:    row.vehicle_no,
    vehicleType:  row.vehicle_type,
    vehicleBrand: row.vehicle_brand,
    vehicleModel: row.vehicle_model,
    year:         row.year,
    color:        row.color,
    notes:        row.notes,
    createdAt:    row.created_at,
  };
}

export function mapBill(row) {
  if (!row) return null;
  return {
    id:                    row.id,
    shopId:                row.shop_id,
    customerId:            row.customer_id,
    type:                  row.type,
    status:                row.status,
    billNumber:            row.bill_number,
    estimateNumber:        row.estimate_number,
    vehicleNo:             row.vehicle_no,
    vehicleType:           row.vehicle_type,
    vehicleBrand:          row.vehicle_brand,
    vehicleModel:          row.vehicle_model,
    customerName:          row.customer_name,
    customerPhone:         row.customer_phone,
    items:                 row.items || [],
    partsSubtotal:         Number(row.parts_subtotal || 0),
    labourCharge:          Number(row.labour_charge  || 0),
    isGST:                 row.is_gst,
    cgst:                  Number(row.cgst           || 0),
    sgst:                  Number(row.sgst           || 0),
    grandTotal:            Number(row.grand_total    || 0),
    paymentMode:           row.payment_mode,
    paidAmount:            Number(row.paid_amount    || 0),
    balanceDue:            Number(row.balance_due    || 0),
    convertedFromEstimate: row.converted_from_estimate,
    createdAt:             row.created_at,
    updatedAt:             row.updated_at,
  };
}
