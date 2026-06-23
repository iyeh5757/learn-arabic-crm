// lib/countries.ts
// Single source of truth for countries used across student forms and the
// reminder timezone logic. COUNTRIES is derived from COUNTRY_TZ so every
// selectable country always has a timezone (keeps the reminder feature aligned).

export const COUNTRY_TZ: Record<string, string> = {
  'Afghanistan': 'Asia/Kabul', 'Albania': 'Europe/Tirane', 'Algeria': 'Africa/Algiers',
  'Andorra': 'Europe/Andorra', 'Angola': 'Africa/Luanda', 'Antigua and Barbuda': 'America/Antigua',
  'Argentina': 'America/Argentina/Buenos_Aires', 'Armenia': 'Asia/Yerevan', 'Australia': 'Australia/Sydney',
  'Austria': 'Europe/Vienna', 'Azerbaijan': 'Asia/Baku', 'Bahamas': 'America/Nassau', 'Bahrain': 'Asia/Bahrain',
  'Bangladesh': 'Asia/Dhaka', 'Barbados': 'America/Barbados', 'Belarus': 'Europe/Minsk', 'Belgium': 'Europe/Brussels',
  'Belize': 'America/Belize', 'Benin': 'Africa/Porto-Novo', 'Bhutan': 'Asia/Thimphu', 'Bolivia': 'America/La_Paz',
  'Bosnia and Herzegovina': 'Europe/Sarajevo', 'Botswana': 'Africa/Gaborone', 'Brazil': 'America/Sao_Paulo',
  'Brunei': 'Asia/Brunei', 'Bulgaria': 'Europe/Sofia', 'Burkina Faso': 'Africa/Ouagadougou', 'Burundi': 'Africa/Bujumbura',
  'Cambodia': 'Asia/Phnom_Penh', 'Cameroon': 'Africa/Douala', 'Canada': 'America/Toronto', 'Cape Verde': 'Atlantic/Cape_Verde',
  'Central African Republic': 'Africa/Bangui', 'Chad': 'Africa/Ndjamena', 'Chile': 'America/Santiago', 'China': 'Asia/Shanghai',
  'Colombia': 'America/Bogota', 'Comoros': 'Indian/Comoro', 'Congo (DRC)': 'Africa/Kinshasa', 'Congo (Republic)': 'Africa/Brazzaville',
  'Costa Rica': 'America/Costa_Rica', 'Croatia': 'Europe/Zagreb', 'Cuba': 'America/Havana', 'Cyprus': 'Asia/Nicosia',
  'Czech Republic': 'Europe/Prague', 'Denmark': 'Europe/Copenhagen', 'Djibouti': 'Africa/Djibouti', 'Dominica': 'America/Dominica',
  'Dominican Republic': 'America/Santo_Domingo', 'Ecuador': 'America/Guayaquil', 'Egypt': 'Africa/Cairo',
  'El Salvador': 'America/El_Salvador', 'Equatorial Guinea': 'Africa/Malabo', 'Eritrea': 'Africa/Asmara',
  'Estonia': 'Europe/Tallinn', 'Eswatini': 'Africa/Mbabane', 'Ethiopia': 'Africa/Addis_Ababa', 'Fiji': 'Pacific/Fiji',
  'Finland': 'Europe/Helsinki', 'France': 'Europe/Paris', 'Gabon': 'Africa/Libreville', 'Gambia': 'Africa/Banjul',
  'Georgia': 'Asia/Tbilisi', 'Germany': 'Europe/Berlin', 'Ghana': 'Africa/Accra', 'Greece': 'Europe/Athens',
  'Grenada': 'America/Grenada', 'Guatemala': 'America/Guatemala', 'Guinea': 'Africa/Conakry', 'Guinea-Bissau': 'Africa/Bissau',
  'Guyana': 'America/Guyana', 'Haiti': 'America/Port-au-Prince', 'Honduras': 'America/Tegucigalpa', 'Hong Kong': 'Asia/Hong_Kong',
  'Hungary': 'Europe/Budapest', 'Iceland': 'Atlantic/Reykjavik', 'India': 'Asia/Kolkata', 'Indonesia': 'Asia/Jakarta',
  'Iran': 'Asia/Tehran', 'Iraq': 'Asia/Baghdad', 'Ireland': 'Europe/Dublin', 'Israel': 'Asia/Jerusalem',
  'Italy': 'Europe/Rome', 'Ivory Coast': 'Africa/Abidjan', 'Jamaica': 'America/Jamaica', 'Japan': 'Asia/Tokyo',
  'Jordan': 'Asia/Amman', 'Kazakhstan': 'Asia/Almaty', 'Kenya': 'Africa/Nairobi', 'Kosovo': 'Europe/Belgrade',
  'Kuwait': 'Asia/Kuwait', 'Kyrgyzstan': 'Asia/Bishkek', 'Laos': 'Asia/Vientiane', 'Latvia': 'Europe/Riga',
  'Lebanon': 'Asia/Beirut', 'Lesotho': 'Africa/Maseru', 'Liberia': 'Africa/Monrovia', 'Libya': 'Africa/Tripoli',
  'Liechtenstein': 'Europe/Vaduz', 'Lithuania': 'Europe/Vilnius', 'Luxembourg': 'Europe/Luxembourg', 'Macau': 'Asia/Macau',
  'Madagascar': 'Indian/Antananarivo', 'Malawi': 'Africa/Blantyre', 'Malaysia': 'Asia/Kuala_Lumpur', 'Maldives': 'Indian/Maldives',
  'Mali': 'Africa/Bamako', 'Malta': 'Europe/Malta', 'Mauritania': 'Africa/Nouakchott', 'Mauritius': 'Indian/Mauritius',
  'Mexico': 'America/Mexico_City', 'Moldova': 'Europe/Chisinau', 'Monaco': 'Europe/Monaco', 'Mongolia': 'Asia/Ulaanbaatar',
  'Montenegro': 'Europe/Podgorica', 'Morocco': 'Africa/Casablanca', 'Mozambique': 'Africa/Maputo', 'Myanmar': 'Asia/Yangon',
  'Namibia': 'Africa/Windhoek', 'Nepal': 'Asia/Kathmandu', 'Netherlands': 'Europe/Amsterdam', 'New Zealand': 'Pacific/Auckland',
  'Nicaragua': 'America/Managua', 'Niger': 'Africa/Niamey', 'Nigeria': 'Africa/Lagos', 'North Macedonia': 'Europe/Skopje',
  'Norway': 'Europe/Oslo', 'Oman': 'Asia/Muscat', 'Pakistan': 'Asia/Karachi', 'Palestine': 'Asia/Gaza',
  'Panama': 'America/Panama', 'Papua New Guinea': 'Pacific/Port_Moresby', 'Paraguay': 'America/Asuncion', 'Peru': 'America/Lima',
  'Philippines': 'Asia/Manila', 'Poland': 'Europe/Warsaw', 'Portugal': 'Europe/Lisbon', 'Qatar': 'Asia/Qatar',
  'Romania': 'Europe/Bucharest', 'Russia': 'Europe/Moscow', 'Rwanda': 'Africa/Kigali', 'Saint Lucia': 'America/St_Lucia',
  'Samoa': 'Pacific/Apia', 'San Marino': 'Europe/San_Marino', 'Saudi Arabia': 'Asia/Riyadh', 'Senegal': 'Africa/Dakar',
  'Serbia': 'Europe/Belgrade', 'Seychelles': 'Indian/Mahe', 'Sierra Leone': 'Africa/Freetown', 'Singapore': 'Asia/Singapore',
  'Slovakia': 'Europe/Bratislava', 'Slovenia': 'Europe/Ljubljana', 'Somalia': 'Africa/Mogadishu', 'South Africa': 'Africa/Johannesburg',
  'South Korea': 'Asia/Seoul', 'South Sudan': 'Africa/Juba', 'Spain': 'Europe/Madrid', 'Sri Lanka': 'Asia/Colombo',
  'Sudan': 'Africa/Khartoum', 'Suriname': 'America/Paramaribo', 'Sweden': 'Europe/Stockholm', 'Switzerland': 'Europe/Zurich',
  'Syria': 'Asia/Damascus', 'Taiwan': 'Asia/Taipei', 'Tajikistan': 'Asia/Dushanbe', 'Tanzania': 'Africa/Dar_es_Salaam',
  'Thailand': 'Asia/Bangkok', 'Togo': 'Africa/Lome', 'Trinidad and Tobago': 'America/Port_of_Spain', 'Tunisia': 'Africa/Tunis',
  'Turkey': 'Europe/Istanbul', 'Turkmenistan': 'Asia/Ashgabat', 'Uganda': 'Africa/Kampala', 'Ukraine': 'Europe/Kiev',
  'United Arab Emirates': 'Asia/Dubai', 'United Kingdom': 'Europe/London', 'United States': 'America/New_York',
  'Uruguay': 'America/Montevideo', 'Uzbekistan': 'Asia/Tashkent', 'Venezuela': 'America/Caracas', 'Vietnam': 'Asia/Ho_Chi_Minh',
  'Yemen': 'Asia/Aden', 'Zambia': 'Africa/Lusaka', 'Zimbabwe': 'Africa/Harare',
}

// Dropdown list — every entry is guaranteed to have a timezone above.
export const COUNTRIES: string[] = [...Object.keys(COUNTRY_TZ).sort(), 'Other']

// Country → default billing currency (only the currencies the system supports).
// Anything not listed defaults to USD.
export const COUNTRY_CURRENCY: Record<string, string> = {
  'Egypt': 'EGP',
  'United Arab Emirates': 'AED', 'Saudi Arabia': 'AED', 'Kuwait': 'AED', 'Qatar': 'AED', 'Bahrain': 'AED', 'Oman': 'AED',
  'United Kingdom': 'GBP',
  'Germany': 'EUR', 'France': 'EUR', 'Netherlands': 'EUR', 'Belgium': 'EUR', 'Switzerland': 'EUR', 'Austria': 'EUR',
  'Luxembourg': 'EUR', 'Ireland': 'EUR', 'Italy': 'EUR', 'Spain': 'EUR', 'Portugal': 'EUR', 'Greece': 'EUR',
  'Finland': 'EUR', 'Estonia': 'EUR', 'Malta': 'EUR', 'Cyprus': 'EUR', 'Slovakia': 'EUR', 'Slovenia': 'EUR',
  'United States': 'USD', 'Canada': 'USD', 'Australia': 'USD',
}
