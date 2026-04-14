export const ADDRESS_LINE_LIMIT = 40;

function sanitize(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function splitByWords(text, limit = ADDRESS_LINE_LIMIT) {
  const clean = sanitize(text);
  if (!clean) return ['', ''];
  if (clean.length <= limit) return [clean, ''];

  const breakAt = clean.lastIndexOf(' ', limit);
  const index = breakAt > 0 ? breakAt : limit;
  return [clean.slice(0, index).trim(), clean.slice(index).trim().slice(0, limit)];
}

export function splitAddressForForm(address = '') {
  const rawLines = String(address)
    .replace(/\r/g, '')
    .split('\n')
    .map(sanitize)
    .filter(Boolean);

  if (rawLines.length >= 2) {
    return [
      rawLines[0].slice(0, ADDRESS_LINE_LIMIT),
      rawLines[1].slice(0, ADDRESS_LINE_LIMIT),
    ];
  }

  if (rawLines.length === 1) {
    const raw = rawLines[0];
    const commaParts = raw.split(',').map(sanitize).filter(Boolean);
    if (commaParts.length >= 2) {
      const midpoint = Math.ceil(commaParts.length / 2);
      const line1 = commaParts.slice(0, midpoint).join(', ').slice(0, ADDRESS_LINE_LIMIT);
      const line2 = commaParts.slice(midpoint).join(', ').slice(0, ADDRESS_LINE_LIMIT);
      return [line1, line2];
    }
    return splitByWords(raw, ADDRESS_LINE_LIMIT);
  }

  return ['', ''];
}

export function joinAddressLines(line1 = '', line2 = '') {
  const first = sanitize(line1).slice(0, ADDRESS_LINE_LIMIT);
  const second = sanitize(line2).slice(0, ADDRESS_LINE_LIMIT);
  return [first, second].filter(Boolean).join('\n');
}

export function getAddressLines(address = '') {
  const [line1, line2] = splitAddressForForm(address);
  return [line1, line2].filter(Boolean);
}
