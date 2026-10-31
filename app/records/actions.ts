'use server'

// 🔒 Don't edit — this keeps your robot safe.
// Add / Edit a record from the web app (Leads, Customers, Tasks, Content).
// Re-checks the person's role on EVERY save (lib/access.ts → canEdit), cleans each
// field with the same spec the form was drawn from (lib/forms.ts), never changes a
// record's category, never deletes, and writes who-changed-what to activity_log.
// Money tabs are not editable here — money still moves only through the approval
// engine.

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { actionUser, logActivity } from '@/lib/auth'
import { canEdit } from '@/lib/access'
import { FORMS, fieldValue, isEditableCategory, type Field } from '@/lib/forms'
import type { Rec } from '@/lib/records'

export type SaveResult = { ok: boolean; message: string; savedAt?: number }

const DATE = /^\d{4}-\d{2}-\d{2}$/

// Turn one submitted value into what gets stored, or an error message.
function clean(f: Field, raw: string, current: string): { value: string | number | null } | { error: string } {
  const v = raw.trim()
  if (!v) return f.required ? { error: `${f.label} is required.` } : { value: null }
  switch (f.kind) {
    case 'number': {
      const n = Number(v.replace(/rm/i, '').replace(/,/g, '').trim())
      if (!Number.isFinite(n) || n < 0 || n > 1e12) return { error: `${f.label} must be a number.` }
      return { value: n }
    }
    case 'date':
      return DATE.test(v) ? { value: v } : { error: `${f.label} must be a date.` }
    case 'select':
      // Allow the options, plus whatever the record already had (older data).
      return f.options?.includes(v) || v === current ? { value: v } : { error: `Pick a ${f.label.toLowerCase()} from the list.` }
    case 'textarea':
      return { value: v.slice(0, 2000) }
    default:
      return { value: v.slice(0, 200) }
  }
}

export async function saveRecord(_prev: SaveResult | null, form: FormData): Promise<SaveResult> {
  const category = form.get('category')
  if (!isEditableCategory(category)) return { ok: false, message: 'Unknown record type.' }
  const spec = FORMS[category]

  const me = await actionUser()
  if (!me || !canEdit(me.role, category)) return { ok: false, message: `Your role can't edit ${spec.noun}s.` }

  // Editing? Load the row and make sure it really is this category.
  const idRaw = String(form.get('id') ?? '').trim()
  const id = idRaw ? Number(idRaw) : null
  let existing: Rec | null = null
  if (idRaw) {
    if (!Number.isInteger(id)) return { ok: false, message: 'Bad record id.' }
    const { data } = await supabase.from('records').select('*').eq('id', id).maybeSingle()
    if (!data || data.category !== category) return { ok: false, message: 'That record no longer exists here.' }
    existing = { ...data, meta: data.meta ?? {} } as Rec
  }

  // Build the row from the spec. Missing select on a NEW record → its first option.
  const row: Record<string, any> = {}
  const meta: Record<string, any> = { ...(existing?.meta ?? {}) }
  const changes: Record<string, [string, string]> = {}
  for (const f of spec.fields) {
    const current = fieldValue(existing, f)
    let raw = String(form.get(f.name) ?? '')
    if (!existing && f.kind === 'select' && !raw && f.options) raw = f.options[0]
    const res = clean(f, raw, current)
    if ('error' in res) return { ok: false, message: res.error }
    for (const target of [f.to, ...(f.also ?? [])]) {
      if (target.startsWith('meta.')) {
        const key = target.slice(5)
        if (res.value === null) delete meta[key]
        else meta[key] = res.value
      } else {
        row[target] = target === 'amount' ? (res.value ?? 0) : res.value
      }
    }
    const next = res.value === null ? '' : String(res.value)
    if (existing && next !== current) changes[f.name] = [current, next]
  }
  row.meta = meta

  if (existing) {
    if (Object.keys(changes).length === 0) return { ok: true, message: 'No changes.', savedAt: Date.now() }
    const { error } = await supabase.from('records').update(row).eq('id', existing.id).eq('category', category)
    if (error) return { ok: false, message: `Couldn't save: ${error.message}` }
    await logActivity(me, `edited ${spec.noun}`, 'record', existing.id, { title: row.title, changes })
  } else {
    meta.source = meta.source ?? 'app'
    const { data, error } = await supabase
      .from('records')
      .insert({ ...row, category, status: row.status ?? 'open' })
      .select('id')
      .single()
    if (error) return { ok: false, message: `Couldn't save: ${error.message}` }
    await logActivity(me, `added ${spec.noun}`, 'record', data.id, { title: row.title })
  }

  revalidatePath(spec.path)
  revalidatePath('/')
  // An edit opens via ?edit=<id>; send them back to the clean list when done.
  if (existing) redirect(spec.path)
  return { ok: true, message: `Added ✓`, savedAt: Date.now() }
}
