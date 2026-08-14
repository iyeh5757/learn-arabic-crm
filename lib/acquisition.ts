// lib/acquisition.ts
// Options for students.acquisition_source — how a student first found us.
//
// The column is a plain nullable text with NO database constraint, so this list
// can be changed freely without a migration and a value can never reject a
// student write. Blank is always allowed and stored as NULL.
export const ACQUISITION_SOURCES = [
  { value: 'meta_ad',         label: 'Meta ad (Facebook / Instagram paid)' },
  { value: 'instagram',       label: 'Instagram (organic)' },
  { value: 'facebook',        label: 'Facebook (organic)' },
  { value: 'tiktok',          label: 'TikTok' },
  { value: 'youtube',         label: 'YouTube' },
  { value: 'whatsapp_direct', label: 'WhatsApp (direct)' },
  { value: 'referral',        label: 'Referral' },
  { value: 'website',         label: 'Website' },
  { value: 'other',           label: 'Other' },
]
