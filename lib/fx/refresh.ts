// lib/fx/refresh.ts
// Daily refresh of the locally cached FX rates used by the payment triggers.
//
// Safety contract:
//  - A failed / timed-out / malformed fetch writes NOTHING. Existing rates kept.
//  - Rates are never nulled or zeroed; only finite positive numbers are written.
//  - Only currencies already present in fx_rates are updated (never inserted).
//  - Every attempt is recorded in fx_refresh_log so a dead refresh is visible.
import { createAdminClient } from '@/lib/supabase/admin'

const SOURCE = 'https://api.exchangerate-api.com/v4/latest/USD'  // same source as supervisor.ts

export type FxRefreshResult = {
  ok: boolean
  outcome: string          // updated | fetch_failed | malformed | no_valid_rates
  updated: number
  skipped: string[]
  error?: string
}

export async function refreshFxRates(): Promise<FxRefreshResult> {
  const admin = createAdminClient()

  const record = async (r: FxRefreshResult) => {
    try {
      await admin.from('fx_refresh_log').insert({
        outcome: r.outcome,
        updated: r.updated,
        skipped: r.skipped.length ? r.skipped : null,
        error:   r.error ?? null,
      })
    } catch (e: any) {
      console.error('[FX] log write failed:', e?.message)   // logging must never throw
    }
  }

  // 1. Fetch — any failure aborts before a single write.
  let payload: any = null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(SOURCE, { signal: controller.signal, cache: 'no-store' })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    payload = await res.json()
  } catch (e: any) {
    const r: FxRefreshResult = {
      ok: false, outcome: 'fetch_failed', updated: 0, skipped: [],
      error: e?.name === 'AbortError' ? 'timed out after 8s' : (e?.message ?? 'network error'),
    }
    console.error('[FX] refresh failed, keeping existing rates:', r.error)
    await record(r)
    return r
  }

  const rates = payload?.rates
  if (!rates || typeof rates !== 'object') {
    const r: FxRefreshResult = {
      ok: false, outcome: 'malformed', updated: 0, skipped: [],
      error: 'response had no usable rates object',
    }
    console.error('[FX]', r.error)
    await record(r)
    return r
  }

  // 2. Validate everything BEFORE writing anything.
  const { data: existing, error: readErr } = await admin.from('fx_rates').select('currency')
  if (readErr || !existing?.length) {
    const r: FxRefreshResult = {
      ok: false, outcome: 'fetch_failed', updated: 0, skipped: [],
      error: readErr?.message ?? 'fx_rates unreadable',
    }
    console.error('[FX]', r.error)
    await record(r)
    return r
  }

  const valid: { currency: string; rate: number }[] = []
  const skipped: string[] = []
  for (const { currency } of existing as { currency: string }[]) {
    const raw = currency === 'USD' ? 1 : Number(rates[currency])
    if (Number.isFinite(raw) && raw > 0) valid.push({ currency, rate: raw })
    else skipped.push(currency)
  }

  // Nothing usable => treat as malformed and leave every rate untouched.
  if (valid.length === 0) {
    const r: FxRefreshResult = {
      ok: false, outcome: 'no_valid_rates', updated: 0, skipped,
      error: 'no currency returned a valid positive rate',
    }
    console.error('[FX]', r.error)
    await record(r)
    return r
  }

  // 3. Write only the validated rows; rate + fetched_at always together.
  const now = new Date().toISOString()
  let updated = 0
  for (const v of valid) {
    const { error } = await admin.from('fx_rates')
      .update({ rate_per_usd: v.rate, fetched_at: now })
      .eq('currency', v.currency)
    if (error) skipped.push(v.currency)
    else updated++
  }

  const r: FxRefreshResult = {
    ok: updated > 0,
    outcome: updated > 0 ? 'updated' : 'no_valid_rates',
    updated, skipped,
  }
  await record(r)
  return r
}
