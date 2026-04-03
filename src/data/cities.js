// Indian Cities for shop registration
// Matches cities in books.city_codes table

export const INDIAN_CITIES = [
  // Karnataka
  { name: 'Bangalore', state: 'Karnataka', code: 'BLR' },
  { name: 'Bengaluru', state: 'Karnataka', code: 'BLR' },
  { name: 'Mysore', state: 'Karnataka', code: 'MYS' },
  { name: 'Mysuru', state: 'Karnataka', code: 'MYS' },
  { name: 'Mangalore', state: 'Karnataka', code: 'MNG' },
  { name: 'Hubli', state: 'Karnataka', code: 'HBL' },
  { name: 'Belgaum', state: 'Karnataka', code: 'BLG' },

  // Maharashtra
  { name: 'Mumbai', state: 'Maharashtra', code: 'MUM' },
  { name: 'Pune', state: 'Maharashtra', code: 'PUN' },
  { name: 'Nagpur', state: 'Maharashtra', code: 'NAG' },
  { name: 'Nashik', state: 'Maharashtra', code: 'NSK' },
  { name: 'Aurangabad', state: 'Maharashtra', code: 'AUR' },
  { name: 'Thane', state: 'Maharashtra', code: 'THN' },

  // Delhi NCR
  { name: 'Delhi', state: 'Delhi', code: 'DEL' },
  { name: 'New Delhi', state: 'Delhi', code: 'DEL' },
  { name: 'Gurugram', state: 'Haryana', code: 'GGN' },
  { name: 'Gurgaon', state: 'Haryana', code: 'GGN' },
  { name: 'Noida', state: 'Uttar Pradesh', code: 'NDA' },
  { name: 'Faridabad', state: 'Haryana', code: 'FBD' },
  { name: 'Ghaziabad', state: 'Uttar Pradesh', code: 'GZB' },

  // Tamil Nadu
  { name: 'Chennai', state: 'Tamil Nadu', code: 'CHN' },
  { name: 'Coimbatore', state: 'Tamil Nadu', code: 'COI' },
  { name: 'Madurai', state: 'Tamil Nadu', code: 'MDU' },
  { name: 'Tiruchirappalli', state: 'Tamil Nadu', code: 'TCH' },
  { name: 'Trichy', state: 'Tamil Nadu', code: 'TCH' },
  { name: 'Salem', state: 'Tamil Nadu', code: 'SLM' },

  // Telangana & Andhra Pradesh
  { name: 'Hyderabad', state: 'Telangana', code: 'HYD' },
  { name: 'Secunderabad', state: 'Telangana', code: 'HYD' },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', code: 'VSK' },
  { name: 'Vizag', state: 'Andhra Pradesh', code: 'VSK' },
  { name: 'Vijayawada', state: 'Andhra Pradesh', code: 'VJA' },
  { name: 'Guntur', state: 'Andhra Pradesh', code: 'GNT' },

  // West Bengal
  { name: 'Kolkata', state: 'West Bengal', code: 'KOL' },
  { name: 'Calcutta', state: 'West Bengal', code: 'KOL' },

  // Gujarat
  { name: 'Ahmedabad', state: 'Gujarat', code: 'AMD' },
  { name: 'Surat', state: 'Gujarat', code: 'SRT' },
  { name: 'Vadodara', state: 'Gujarat', code: 'VAD' },
  { name: 'Rajkot', state: 'Gujarat', code: 'RJT' },

  // Rajasthan
  { name: 'Jaipur', state: 'Rajasthan', code: 'JAI' },
  { name: 'Jodhpur', state: 'Rajasthan', code: 'JOD' },
  { name: 'Udaipur', state: 'Rajasthan', code: 'UDR' },

  // Punjab & Chandigarh
  { name: 'Chandigarh', state: 'Chandigarh', code: 'CHD' },
  { name: 'Ludhiana', state: 'Punjab', code: 'LDH' },
  { name: 'Amritsar', state: 'Punjab', code: 'ASR' },

  // Kerala
  { name: 'Kochi', state: 'Kerala', code: 'KOC' },
  { name: 'Cochin', state: 'Kerala', code: 'KOC' },
  { name: 'Thiruvananthapuram', state: 'Kerala', code: 'TVM' },
  { name: 'Trivandrum', state: 'Kerala', code: 'TVM' },
  { name: 'Kozhikode', state: 'Kerala', code: 'CLT' },
  { name: 'Calicut', state: 'Kerala', code: 'CLT' },

  // Madhya Pradesh
  { name: 'Indore', state: 'Madhya Pradesh', code: 'IDR' },
  { name: 'Bhopal', state: 'Madhya Pradesh', code: 'BPL' },

  // Uttar Pradesh
  { name: 'Lucknow', state: 'Uttar Pradesh', code: 'LKO' },
  { name: 'Kanpur', state: 'Uttar Pradesh', code: 'KNP' },
  { name: 'Agra', state: 'Uttar Pradesh', code: 'AGR' },
  { name: 'Varanasi', state: 'Uttar Pradesh', code: 'VNS' },

  // Bihar
  { name: 'Patna', state: 'Bihar', code: 'PAT' },

  // Odisha
  { name: 'Bhubaneswar', state: 'Odisha', code: 'BBS' },

  // Assam
  { name: 'Guwahati', state: 'Assam', code: 'GUW' },
];

// Get unique cities (remove duplicates like Bangalore/Bengaluru)
export const UNIQUE_CITIES = INDIAN_CITIES.reduce((acc, city) => {
  if (!acc.find(c => c.code === city.code && c.name === city.name)) {
    acc.push(city);
  }
  return acc;
}, []).sort((a, b) => a.name.localeCompare(b.name));

// Group cities by state
export const CITIES_BY_STATE = INDIAN_CITIES.reduce((acc, city) => {
  if (!acc[city.state]) {
    acc[city.state] = [];
  }
  if (!acc[city.state].find(c => c.name === city.name)) {
    acc[city.state].push(city);
  }
  return acc;
}, {});
