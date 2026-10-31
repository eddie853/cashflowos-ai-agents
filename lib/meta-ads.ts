import 'server-only'
import { supabase, supabaseConfigured } from './supabase'

// 👉 Meta Ads → Cash Out. Once a day (from the daily cron) we ask Meta how much the
// ad account spent on each of the last 7 days and file each day as ONE cash_out row:
//   "Meta Ads — 2026-10-30"  ·  amount = that day's spend  ·  status 'paid'
// It's a sync of spend Meta already charged — no money moves here. Re-running is
// SAFE: a day already filed is only corrected if Meta's number changed, never doubled.
//
// Needs two env values (missing either ⇒ the sync quietly skips):
//   META_AD_ACCOUNT_ID — the ad account id, e.g. act_1234567890 (or just the digits)
//   META_ACCESS_TOKEN  — a System User token with the ads_read permission (SECRET)

const GRAPH = 'https://graph.facebook.com/v26.0'

type DaySpend = { date: string; spend: number }

export type MetaSyncResult =
  | { ok: true; skipped: true }
  | { ok: true; currency: string; filed: number; updated: number }
  | { ok: false; error: string }

const accountId = () => {
  const raw = (process.env.META_AD_ACCOUNT_ID ?? '').trim()
  if (!raw) return ''
  return raw.startsWith('act_') ? raw : `act_${raw}`
}

async function graph(path: string, params: Record<string, string>) {
  const token = (process.env.META_ACCESS_TOKEN ?? '').trim()
  const qs = new URLSearchParams(params)
  // Token goes in the header, never the URL, so it can't leak into logs.
  const res = await fetch(`${GRAPH}/${path}?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
  const body = await res.json()
  if (!res.ok || body.error) throw new Error(body.error?.message || `Meta API ${res.status}`)
  return body
}

export async function syncMetaAdSpend(): Promise<MetaSyncResult> {
  const act = accountId()
  if (!act || !process.env.META_ACCESS_TOKEN?.trim() || !supabaseConfigured) return { ok: true, skipped: true }

  try {
    const acct = await graph(act, { fields: 'currency' })
    const currency: string = acct.currency || 'MYR'

    // last_7d = the 7 full days before today, in the ad account's own timezone.
    const insights = await graph(`${act}/insights`, {
      fields: 'spend',
      date_preset: 'last_7d',
      time_increment: '1',
      level: 'account',
    })
    const days: DaySpend[] = (insights.data ?? [])
      .map((d: any) => ({ date: d.date_start, spend: Math.round(Number(d.spend || 0) * 100) / 100 }))
      .filter((d: DaySpend) => d.spend > 0)
    if (!days.length) return { ok: true, currency, filed: 0, updated: 0 }

    const { data: existing, error } = await supabase
      .from('records')
      .select('id, amount, meta')
      .eq('category', 'cash_out')
      .eq('meta->>source', 'meta_ads')
      .in('meta->>date', days.map(d => d.date))
    if (error) throw new Error(error.message)
    const byDate = new Map((existing ?? []).map(r => [r.meta?.date as string, r]))

    let filed = 0
    let updated = 0
    for (const d of days) {
      const prev = byDate.get(d.date)
      if (prev) {
        if (Number(prev.amount) !== d.spend) {
          await supabase.from('records').update({ amount: d.spend }).eq('id', prev.id)
          updated++
        }
        continue
      }
      const { error: insErr } = await supabase.from('records').insert({
        title: `Meta Ads — ${d.date}`,
        status: 'paid',
        amount: d.spend,
        category: 'cash_out',
        due_date: d.date,
        notes: currency === 'MYR' ? 'Synced from Meta Ads' : `Synced from Meta Ads (amount in ${currency})`,
        meta: { source: 'meta_ads', date: d.date, currency, category: 'Advertising', auto_filed: true },
      })
      if (insErr) throw new Error(insErr.message)
      filed++
    }
    return { ok: true, currency, filed, updated }
  } catch (e: any) {
    console.error('[CFO] Meta Ads sync failed:', e?.message || e)
    return { ok: false, error: String(e?.message || e) }
  }
}
