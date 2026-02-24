// 50 common two-wheeler spare parts with trilingual names
export const PARTS_CATALOGUE = [
  { id: 'p01', name: 'Engine Oil (1L)',        nameHi: 'इंजन ऑयल (1L)',          nameTe: 'ఇంజన్ ఆయిల్ (1L)',          category: 'oil',         defaultPrice: 350 },
  { id: 'p02', name: 'Air Filter',              nameHi: 'एयर फिल्टर',             nameTe: 'ఎయిర్ ఫిల్టర్',             category: 'oil',         defaultPrice: 120 },
  { id: 'p03', name: 'Oil Filter',              nameHi: 'ऑयल फिल्टर',             nameTe: 'ఆయిల్ ఫిల్టర్',             category: 'oil',         defaultPrice: 80  },
  { id: 'p04', name: 'Spark Plug',              nameHi: 'स्पार्क प्लग',           nameTe: 'స్పార్క్ ప్లగ్',            category: 'engine',      defaultPrice: 90  },
  { id: 'p05', name: 'Brake Pads (Front)',       nameHi: 'ब्रेक पैड (आगे)',        nameTe: 'బ్రేక్ ప్యాడ్స్ (ముందు)',  category: 'brakes',      defaultPrice: 250 },
  { id: 'p06', name: 'Brake Pads (Rear)',        nameHi: 'ब्रेक पैड (पीछे)',       nameTe: 'బ్రేక్ ప్యాడ్స్ (వెనుక)',  category: 'brakes',      defaultPrice: 200 },
  { id: 'p07', name: 'Brake Shoe (Front)',       nameHi: 'ब्रेक शू (आगे)',         nameTe: 'బ్రేక్ షూ (ముందు)',         category: 'brakes',      defaultPrice: 180 },
  { id: 'p08', name: 'Brake Shoe (Rear)',        nameHi: 'ब्रेक शू (पीछे)',        nameTe: 'బ్రేక్ షూ (వెనుక)',         category: 'brakes',      defaultPrice: 160 },
  { id: 'p09', name: 'Chain Kit',               nameHi: 'चेन किट',               nameTe: 'చైన్ కిట్',                 category: 'engine',      defaultPrice: 750 },
  { id: 'p10', name: 'Clutch Plates',           nameHi: 'क्लच प्लेट्स',          nameTe: 'క్లచ్ ప్లేట్లు',            category: 'engine',      defaultPrice: 450 },
  { id: 'p11', name: 'Clutch Cable',            nameHi: 'क्लच केबल',             nameTe: 'క్లచ్ కేబుల్',              category: 'body',        defaultPrice: 80  },
  { id: 'p12', name: 'Throttle Cable',          nameHi: 'थ्रॉटल केबल',           nameTe: 'థ్రాటిల్ కేబుల్',           category: 'body',        defaultPrice: 70  },
  { id: 'p13', name: 'Brake Cable (Front)',      nameHi: 'ब्रेक केबल (आगे)',       nameTe: 'బ్రేక్ కేబుల్ (ముందు)',    category: 'body',        defaultPrice: 65  },
  { id: 'p14', name: 'Brake Cable (Rear)',       nameHi: 'ब्रेक केबल (पीछे)',      nameTe: 'బ్రేక్ కేబుల్ (వెనుక)',    category: 'body',        defaultPrice: 60  },
  { id: 'p15', name: 'Tyre Front (2.75-17)',    nameHi: 'टायर आगे (2.75-17)',     nameTe: 'టైర్ ముందు (2.75-17)',      category: 'tyres',       defaultPrice: 650 },
  { id: 'p16', name: 'Tyre Rear (3.00-17)',     nameHi: 'टायर पीछे (3.00-17)',    nameTe: 'టైర్ వెనుక (3.00-17)',      category: 'tyres',       defaultPrice: 750 },
  { id: 'p17', name: 'Tube Front',              nameHi: 'ट्यूब आगे',              nameTe: 'ట్యూబ్ ముందు',              category: 'tyres',       defaultPrice: 120 },
  { id: 'p18', name: 'Tube Rear',               nameHi: 'ट्यूब पीछे',             nameTe: 'ట్యూబ్ వెనుక',              category: 'tyres',       defaultPrice: 140 },
  { id: 'p19', name: 'Battery (12V)',           nameHi: 'बैटरी (12V)',            nameTe: 'బ్యాటరీ (12V)',              category: 'electricals', defaultPrice: 1200},
  { id: 'p20', name: 'Headlight Bulb',          nameHi: 'हेडलाइट बल्ब',          nameTe: 'హెడ్‌లైట్ బల్బ్',           category: 'electricals', defaultPrice: 80  },
  { id: 'p21', name: 'Indicator Bulb',          nameHi: 'इंडिकेटर बल्ब',         nameTe: 'ఇండికేటర్ బల్బ్',           category: 'electricals', defaultPrice: 20  },
  { id: 'p22', name: 'Tail Light Bulb',         nameHi: 'टेल लाइट बल्ब',         nameTe: 'టెయిల్ లైట్ బల్బ్',         category: 'electricals', defaultPrice: 30  },
  { id: 'p23', name: 'Horn',                    nameHi: 'हॉर्न',                  nameTe: 'హార్న్',                     category: 'electricals', defaultPrice: 150 },
  { id: 'p24', name: 'Mirror Left',             nameHi: 'मिरर (बायां)',           nameTe: 'అద్దం (ఎడమ)',               category: 'body',        defaultPrice: 90  },
  { id: 'p25', name: 'Mirror Right',            nameHi: 'मिरर (दायां)',           nameTe: 'అద్దం (కుడి)',               category: 'body',        defaultPrice: 90  },
  { id: 'p26', name: 'Handle Grip Pair',        nameHi: 'हैंडल ग्रिप (जोड़ी)',   nameTe: 'హ్యాండిల్ గ్రిప్ జత',       category: 'body',        defaultPrice: 80  },
  { id: 'p27', name: 'Kick Starter',            nameHi: 'किक स्टार्टर',          nameTe: 'కిక్ స్టార్టర్',             category: 'engine',      defaultPrice: 350 },
  { id: 'p28', name: 'Front Fork Oil Seal',     nameHi: 'फ्रंट फोर्क ऑयल सील',  nameTe: 'ఫ్రంట్ ఫోర్క్ ఆయిల్ సీల్', category: 'engine',      defaultPrice: 200 },
  { id: 'p29', name: 'Carburetor Kit',          nameHi: 'कार्बोरेटर किट',        nameTe: 'కార్బ్యురేటర్ కిట్',         category: 'engine',      defaultPrice: 550 },
  { id: 'p30', name: 'Carburetor Jet',          nameHi: 'कार्बोरेटर जेट',        nameTe: 'కార్బ్యురేటర్ జెట్',         category: 'engine',      defaultPrice: 80  },
  { id: 'p31', name: 'Self Starter Motor',      nameHi: 'सेल्फ स्टार्टर मोटर',  nameTe: 'సెల్ఫ్ స్టార్టర్ మోటర్',    category: 'electricals', defaultPrice: 1500},
  { id: 'p32', name: 'CDI Unit',               nameHi: 'CDI यूनिट',             nameTe: 'CDI యూనిట్',                 category: 'electricals', defaultPrice: 800 },
  { id: 'p33', name: 'Ignition Coil',          nameHi: 'इग्निशन कॉयल',          nameTe: 'ఇగ్నిషన్ కాయిల్',           category: 'electricals', defaultPrice: 450 },
  { id: 'p34', name: 'Regulator Rectifier',    nameHi: 'रेगुलेटर रेक्टिफायर',   nameTe: 'రెగ్యులేటర్ రెక్టిఫయర్',    category: 'electricals', defaultPrice: 350 },
  { id: 'p35', name: 'Fuel Filter',            nameHi: 'ईंधन फिल्टर',           nameTe: 'ఫ్యూయల్ ఫిల్టర్',            category: 'oil',         defaultPrice: 60  },
  { id: 'p36', name: 'Engine Gasket Set',      nameHi: 'इंजन गैस्केट सेट',      nameTe: 'ఇంజన్ గాస్కెట్ సెట్',        category: 'engine',      defaultPrice: 250 },
  { id: 'p37', name: 'Piston Ring Set',        nameHi: 'पिस्टन रिंग सेट',       nameTe: 'పిస్టన్ రింగ్ సెట్',          category: 'engine',      defaultPrice: 400 },
  { id: 'p38', name: 'Piston',                 nameHi: 'पिस्टन',                 nameTe: 'పిస్టన్',                     category: 'engine',      defaultPrice: 600 },
  { id: 'p39', name: 'Valve Inlet',            nameHi: 'इनलेट वाल्व',            nameTe: 'ఇన్‌లెట్ వాల్వ్',             category: 'engine',      defaultPrice: 180 },
  { id: 'p40', name: 'Valve Exhaust',          nameHi: 'एग्जॉस्ट वाल्व',        nameTe: 'ఎగ్జాస్ట్ వాల్వ్',            category: 'engine',      defaultPrice: 180 },
  { id: 'p41', name: 'Spoke Set',              nameHi: 'स्पोक सेट',              nameTe: 'స్పోక్ సెట్',                 category: 'body',        defaultPrice: 300 },
  { id: 'p42', name: 'Wheel Bearing Set',      nameHi: 'व्हील बियरिंग सेट',     nameTe: 'వీల్ బేరింగ్ సెట్',           category: 'engine',      defaultPrice: 250 },
  { id: 'p43', name: 'Rear Shock Absorber',    nameHi: 'रियर शॉक एब्जॉर्बर',   nameTe: 'రియర్ షాక్ అబ్జార్బర్',      category: 'body',        defaultPrice: 900 },
  { id: 'p44', name: 'Exhaust Silencer',       nameHi: 'एग्जॉस्ट साइलेंसर',    nameTe: 'ఎగ్జాస్ట్ సైలెన్సర్',        category: 'body',        defaultPrice: 1100},
  { id: 'p45', name: 'Speedometer Cable',      nameHi: 'स्पीडोमीटर केबल',       nameTe: 'స్పీడోమీటర్ కేబుల్',          category: 'body',        defaultPrice: 90  },
  { id: 'p46', name: 'Side Stand Spring',      nameHi: 'साइड स्टैंड स्प्रिंग',  nameTe: 'సైడ్ స్టాండ్ స్ప్రింగ్',     category: 'body',        defaultPrice: 40  },
  { id: 'p47', name: 'Centre Stand Spring',    nameHi: 'सेंटर स्टैंड स्प्रिंग', nameTe: 'సెంటర్ స్టాండ్ స్ప్రింగ్',   category: 'body',        defaultPrice: 50  },
  { id: 'p48', name: 'Number Plate Light',     nameHi: 'नंबर प्लेट लाइट',       nameTe: 'నంబర్ ప్లేట్ లైట్',           category: 'electricals', defaultPrice: 45  },
  { id: 'p49', name: 'Fuel Tank Cap',          nameHi: 'ईंधन टैंक कैप',         nameTe: 'ఫ్యూయల్ ట్యాంక్ క్యాప్',     category: 'body',        defaultPrice: 120 },
  { id: 'p50', name: 'Swing Arm Bush Set',     nameHi: 'स्विंग आर्म बुश सेट',   nameTe: 'స్వింగ్ ఆర్మ్ బుష్ సెట్',    category: 'engine',      defaultPrice: 200 },
];

export const CATEGORIES = ['all', 'oil', 'brakes', 'tyres', 'electricals', 'engine', 'body', 'other'];

export function getPartName(part, lang) {
  if (lang === 'hi') return part.nameHi || part.name;
  if (lang === 'te') return part.nameTe || part.name;
  return part.name;
}

// DEFAULT_PARTS maps defaultPrice → price for use in PartsCatalogue seeding
export const DEFAULT_PARTS = PARTS_CATALOGUE.map((p) => ({
  ...p,
  price: p.defaultPrice,
}));
