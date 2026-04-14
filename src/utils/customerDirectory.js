import { supabase, mapCustomer, mapVehicle } from '../supabase';

function sanitizeSearch(value = '') {
  return String(value).replace(/[(),\\]/g, '').trim();
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchSharedDirectory({ shopId, query }) {
  const safe = sanitizeSearch(query);
  if (safe.length < 3) return [];

  const phoneQuery = supabase
    .from('customers')
    .select('*')
    .or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`)
    .limit(12);

  const vehicleQuery = supabase
    .from('vehicles')
    .select('*')
    .ilike('vehicle_no', `%${safe.toUpperCase()}%`)
    .limit(12);

  const [{ data: customerRows = [] }, { data: vehicleRows = [] }] = await Promise.all([
    phoneQuery,
    vehicleQuery,
  ]);

  const vehicleCustomerIds = uniqueBy(vehicleRows.map((row) => row.customer_id).filter(Boolean), (id) => id);
  let vehicleCustomers = [];
  if (vehicleCustomerIds.length > 0) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .in('id', vehicleCustomerIds);
    vehicleCustomers = data || [];
  }

  const customerMap = new Map([
    ...customerRows.map((row) => [row.id, row]),
    ...vehicleCustomers.map((row) => [row.id, row]),
  ]);

  const directResults = customerRows.map((row) => ({
    kind: 'customer',
    isLocal: row.shop_id === shopId,
    customer: mapCustomer(row),
    vehicle: null,
  }));

  const vehicleResults = vehicleRows
    .map((row) => {
      const customerRow = customerMap.get(row.customer_id);
      if (!customerRow) return null;
      return {
        kind: 'vehicle',
        isLocal: customerRow.shop_id === shopId,
        customer: mapCustomer(customerRow),
        vehicle: mapVehicle(row),
      };
    })
    .filter(Boolean);

  return uniqueBy(
    [...directResults, ...vehicleResults].sort((a, b) => Number(b.isLocal) - Number(a.isLocal)),
    (item) => `${item.customer.id}:${item.vehicle?.id || 'none'}:${item.kind}`
  );
}

export async function importCustomerIntoShop({ shopId, entry }) {
  const phone = entry.customer?.phone?.trim();
  const name = entry.customer?.name?.trim();
  const vehicleNo = entry.vehicle?.vehicleNo?.trim().toUpperCase();

  let localCustomerRow = null;
  if (phone) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('shop_id', shopId)
      .eq('phone', phone)
      .limit(1);
    localCustomerRow = data?.[0] || null;
  }

  if (!localCustomerRow) {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        shop_id: shopId,
        name: name || 'Customer',
        phone: phone || '',
      })
      .select()
      .single();
    if (error) throw error;
    localCustomerRow = data;
  }

  let localVehicle = null;
  if (vehicleNo) {
    const { data: existingVehicleRows } = await supabase
      .from('vehicles')
      .select('*')
      .eq('shop_id', shopId)
      .eq('vehicle_no', vehicleNo)
      .limit(1);

    if (existingVehicleRows?.[0]) {
      localVehicle = mapVehicle(existingVehicleRows[0]);
    } else {
      const { data, error } = await supabase
        .from('vehicles')
        .insert({
          shop_id: shopId,
          customer_id: localCustomerRow.id,
          vehicle_no: vehicleNo,
          vehicle_type: entry.vehicle?.vehicleType || null,
          vehicle_brand: entry.vehicle?.vehicleBrand || null,
          vehicle_model: entry.vehicle?.vehicleModel || null,
        })
        .select()
        .single();
      if (error) throw error;
      localVehicle = mapVehicle(data);
    }
  }

  return {
    customer: mapCustomer(localCustomerRow),
    vehicle: localVehicle,
  };
}
