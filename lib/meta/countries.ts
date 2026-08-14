// lib/meta/countries.ts
// Full country name -> ISO-3166-1 alpha-2 (lowercase), the format Meta requires
// for the `country` user_data field. Keys are taken verbatim from COUNTRY_TZ in
// lib/countries.ts, so every country a user can select maps to a code.
//
// An unmapped value (e.g. the selectable "Other", or NULL) returns undefined and
// the country field is simply omitted — we never send a guessed or wrong code.
// Note: 'xk' (Kosovo) is a user-assigned code, not official ISO; Meta may ignore it.
export const COUNTRY_ISO2: Record<string, string> = {
  'Afghanistan': 'af', 'Albania': 'al', 'Algeria': 'dz',
  'Andorra': 'ad', 'Angola': 'ao', 'Antigua and Barbuda': 'ag',
  'Argentina': 'ar', 'Armenia': 'am', 'Australia': 'au',
  'Austria': 'at', 'Azerbaijan': 'az', 'Bahamas': 'bs',
  'Bahrain': 'bh', 'Bangladesh': 'bd', 'Barbados': 'bb',
  'Belarus': 'by', 'Belgium': 'be', 'Belize': 'bz',
  'Benin': 'bj', 'Bhutan': 'bt', 'Bolivia': 'bo',
  'Bosnia and Herzegovina': 'ba', 'Botswana': 'bw', 'Brazil': 'br',
  'Brunei': 'bn', 'Bulgaria': 'bg', 'Burkina Faso': 'bf',
  'Burundi': 'bi', 'Cambodia': 'kh', 'Cameroon': 'cm',
  'Canada': 'ca', 'Cape Verde': 'cv', 'Central African Republic': 'cf',
  'Chad': 'td', 'Chile': 'cl', 'China': 'cn',
  'Colombia': 'co', 'Comoros': 'km', 'Congo (DRC)': 'cd',
  'Congo (Republic)': 'cg', 'Costa Rica': 'cr', 'Croatia': 'hr',
  'Cuba': 'cu', 'Cyprus': 'cy', 'Czech Republic': 'cz',
  'Denmark': 'dk', 'Djibouti': 'dj', 'Dominica': 'dm',
  'Dominican Republic': 'do', 'Ecuador': 'ec', 'Egypt': 'eg',
  'El Salvador': 'sv', 'Equatorial Guinea': 'gq', 'Eritrea': 'er',
  'Estonia': 'ee', 'Eswatini': 'sz', 'Ethiopia': 'et',
  'Fiji': 'fj', 'Finland': 'fi', 'France': 'fr',
  'Gabon': 'ga', 'Gambia': 'gm', 'Georgia': 'ge',
  'Germany': 'de', 'Ghana': 'gh', 'Greece': 'gr',
  'Grenada': 'gd', 'Guatemala': 'gt', 'Guinea': 'gn',
  'Guinea-Bissau': 'gw', 'Guyana': 'gy', 'Haiti': 'ht',
  'Honduras': 'hn', 'Hong Kong': 'hk', 'Hungary': 'hu',
  'Iceland': 'is', 'India': 'in', 'Indonesia': 'id',
  'Iran': 'ir', 'Iraq': 'iq', 'Ireland': 'ie',
  'Israel': 'il', 'Italy': 'it', 'Ivory Coast': 'ci',
  'Jamaica': 'jm', 'Japan': 'jp', 'Jordan': 'jo',
  'Kazakhstan': 'kz', 'Kenya': 'ke', 'Kosovo': 'xk',
  'Kuwait': 'kw', 'Kyrgyzstan': 'kg', 'Laos': 'la',
  'Latvia': 'lv', 'Lebanon': 'lb', 'Lesotho': 'ls',
  'Liberia': 'lr', 'Libya': 'ly', 'Liechtenstein': 'li',
  'Lithuania': 'lt', 'Luxembourg': 'lu', 'Macau': 'mo',
  'Madagascar': 'mg', 'Malawi': 'mw', 'Malaysia': 'my',
  'Maldives': 'mv', 'Mali': 'ml', 'Malta': 'mt',
  'Mauritania': 'mr', 'Mauritius': 'mu', 'Mexico': 'mx',
  'Moldova': 'md', 'Monaco': 'mc', 'Mongolia': 'mn',
  'Montenegro': 'me', 'Morocco': 'ma', 'Mozambique': 'mz',
  'Myanmar': 'mm', 'Namibia': 'na', 'Nepal': 'np',
  'Netherlands': 'nl', 'New Zealand': 'nz', 'Nicaragua': 'ni',
  'Niger': 'ne', 'Nigeria': 'ng', 'North Macedonia': 'mk',
  'Norway': 'no', 'Oman': 'om', 'Pakistan': 'pk',
  'Palestine': 'ps', 'Panama': 'pa', 'Papua New Guinea': 'pg',
  'Paraguay': 'py', 'Peru': 'pe', 'Philippines': 'ph',
  'Poland': 'pl', 'Portugal': 'pt', 'Qatar': 'qa',
  'Romania': 'ro', 'Russia': 'ru', 'Rwanda': 'rw',
  'Saint Lucia': 'lc', 'Samoa': 'ws', 'San Marino': 'sm',
  'Saudi Arabia': 'sa', 'Senegal': 'sn', 'Serbia': 'rs',
  'Seychelles': 'sc', 'Sierra Leone': 'sl', 'Singapore': 'sg',
  'Slovakia': 'sk', 'Slovenia': 'si', 'Somalia': 'so',
  'South Africa': 'za', 'South Korea': 'kr', 'South Sudan': 'ss',
  'Spain': 'es', 'Sri Lanka': 'lk', 'Sudan': 'sd',
  'Suriname': 'sr', 'Sweden': 'se', 'Switzerland': 'ch',
  'Syria': 'sy', 'Taiwan': 'tw', 'Tajikistan': 'tj',
  'Tanzania': 'tz', 'Thailand': 'th', 'Togo': 'tg',
  'Trinidad and Tobago': 'tt', 'Tunisia': 'tn', 'Turkey': 'tr',
  'Turkmenistan': 'tm', 'Uganda': 'ug', 'Ukraine': 'ua',
  'United Arab Emirates': 'ae', 'United Kingdom': 'gb', 'United States': 'us',
  'Uruguay': 'uy', 'Uzbekistan': 'uz', 'Venezuela': 've',
  'Vietnam': 'vn', 'Yemen': 'ye', 'Zambia': 'zm',
  'Zimbabwe': 'zw',
}

export function toIso2(name?: string | null): string | undefined {
  if (!name) return undefined
  return COUNTRY_ISO2[name.trim()]
}
