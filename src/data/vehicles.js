// =============================================================================
// NatBolt Book — Static vehicle reference data
//
// Kept as a JS file (not DB) because:
//   • Reference data — same for every shop, never changes at runtime
//   • ~15KB bundled (negligible)
//   • Analytics still works — bills snapshot vehicle_brand/model as TEXT
//
// Usage:
//   import { VEHICLE_TYPES, getBrandsForType, getModelsForBrand } from '../data/vehicles';
// =============================================================================

export const VEHICLE_TYPES = [
  { value: 'bike',     label: 'Bike' },
  { value: 'scooter',  label: 'Scooter' },
  { value: 'moped',    label: 'Moped' },
  { value: 'electric', label: 'Electric' },
  { value: 'auto',     label: 'Auto' },
  { value: 'car',      label: 'Car' },
  { value: 'truck',    label: 'Truck' },
  { value: 'other',    label: 'Other' },
];

// Brands grouped by vehicle type (alphabetically sorted)
export const VEHICLE_BRANDS = {
  bike: [
    'Bajaj', 'Hero', 'Honda', 'Kawasaki', 'KTM',
    'Royal Enfield', 'Suzuki', 'TVS', 'Yamaha',
  ],
  scooter: [
    'Hero', 'Honda', 'Piaggio', 'Suzuki', 'TVS', 'Yamaha',
  ],
  moped: ['Bajaj', 'Hero', 'TVS'],
  electric: [
    'Ather', 'Bajaj', 'Hero Electric', 'Okinawa',
    'Ola Electric', 'Pure EV', 'TVS',
  ],
  auto: ['Bajaj', 'Mahindra', 'Piaggio', 'TVS'],
  car: [
    'Ford', 'Honda', 'Hyundai', 'Kia', 'Mahindra',
    'Maruti Suzuki', 'MG', 'Nissan', 'Renault',
    'Skoda', 'Tata', 'Toyota', 'Volkswagen',
  ],
  truck: ['Ashok Leyland', 'Bharat Benz', 'Eicher', 'Mahindra', 'Tata'],
  other: [],
};

// Models grouped by brand (alphabetically sorted within each brand)
export const VEHICLE_MODELS = {
  // ── Two-wheelers ──────────────────────────────────────────────────────────
  'Bajaj': [
    'Avenger 220', 'CT100', 'Platina', 'Pulsar 125',
    'Pulsar 150', 'Pulsar 220F', 'Pulsar NS200',
  ],
  'Hero': [
    'Destini 125', 'Glamour', 'HF Deluxe', 'Maestro Edge',
    'Passion Pro', 'Pleasure Plus', 'Splendor Plus', 'Xtreme 160R',
  ],
  'Honda': [
    'Activa 125', 'Activa 6G', 'CB Hornet 160R', 'CB Shine',
    'CB Unicorn', 'Dream Neo', 'Grazia 125', 'Livo',
  ],
  'Kawasaki': ['Ninja 300', 'Ninja 400', 'Versys 650', 'Z400'],
  'KTM': [
    'Adventure 390', 'Duke 125', 'Duke 200',
    'Duke 390', 'RC 200', 'RC 390',
  ],
  'Royal Enfield': [
    'Bullet 350', 'Classic 350', 'Classic 500',
    'Himalayan', 'Hunter 350', 'Meteor 350', 'Thunderbird 350',
  ],
  'Suzuki': ['Access 125', 'Avenis 125', 'Burgman Street', 'Gixxer 150', 'Gixxer 250'],
  'TVS': [
    'Apache RR 310', 'Apache RTR 160', 'Apache RTR 200',
    'Jupiter', 'Ntorq 125', 'Sport', 'XL100', 'iQube',
  ],
  'Yamaha': ['Fascino 125', 'FZ V3', 'FZ-S V3', 'FZ25', 'MT-15', 'R15 V4', 'Ray ZR 125'],
  'Piaggio': ['Ape Auto', 'Vespa 125', 'Vespa 150'],

  // ── Electric two-wheelers ─────────────────────────────────────────────────
  'Ather': ['450 Plus', '450S', '450X', 'Rizta'],
  'Hero Electric': ['Nyx', 'Optima', 'Photon'],
  'Okinawa': ['Dual', 'Praise Pro', 'Ridge+', 'R30'],
  'Ola Electric': ['S1', 'S1 Air', 'S1 Pro'],
  'Pure EV': ['ePluto 7G', 'eTryst 350', 'Etrance Neo'],

  // ── Autos ─────────────────────────────────────────────────────────────────
  // Bajaj + Mahindra + TVS + Piaggio — models handled by brand shared above

  // ── Cars ──────────────────────────────────────────────────────────────────
  'Ford': ['EcoSport', 'Endeavour', 'Figo', 'Freestyle'],
  'Hyundai': [
    'Alcazar', 'Aura', 'Creta', 'Grand i10 Nios',
    'i10', 'i20', 'Tucson', 'Venue', 'Verna',
  ],
  'Kia': ['Carens', 'Carnival', 'Seltos', 'Sonet'],
  'Mahindra': [
    'Bolero', 'Scorpio', 'Scorpio-N', 'Thar',
    'XUV300', 'XUV400', 'XUV700', 'Xylo',
  ],
  'Maruti Suzuki': [
    'Alto', 'Alto K10', 'Baleno', 'Brezza',
    'Celerio', 'Dzire', 'Ertiga', 'Fronx',
    'Grand Vitara', 'S-Presso', 'Swift', 'WagonR',
  ],
  'MG': ['Astor', 'Comet EV', 'Gloster', 'Hector', 'ZS EV'],
  'Nissan': ['Kicks', 'Magnite', 'Terrano'],
  'Renault': ['Duster', 'Kiger', 'Kwid', 'Triber'],
  'Skoda': ['Kushaq', 'Octavia', 'Rapid', 'Slavia', 'Superb'],
  'Tata': [
    'Ace', 'Altroz', 'Harrier', 'Nexon',
    'Nexon EV', 'Punch', 'Safari', 'Tigor', 'Tiago',
  ],
  'Toyota': [
    'Camry', 'Fortuner', 'Glanza', 'Hilux',
    'Innova Crysta', 'Innova HyCross', 'Urban Cruiser Hyryder',
  ],
  'Volkswagen': ['Polo', 'Taigun', 'Tiguan', 'Vento', 'Virtus'],

  // ── Trucks ────────────────────────────────────────────────────────────────
  'Ashok Leyland': ['Boss 1616', 'Captain 3718', 'Dost', 'Dost Strong', 'Partner'],
  'Bharat Benz': ['1214R', '1617R', '2523R', '3128R'],
  'Eicher': ['Pro 2049', 'Pro 3015', 'Pro 6028', 'Pro 8031'],
};

/**
 * Returns an array of brand names for the given vehicle type.
 * Falls back to an empty array for 'other' or unknown types.
 */
export function getBrandsForType(type) {
  return VEHICLE_BRANDS[type] || [];
}

/**
 * Returns an array of model names for the given brand.
 * Returns an empty array if no models are defined.
 */
export function getModelsForBrand(brand) {
  return VEHICLE_MODELS[brand] || [];
}
