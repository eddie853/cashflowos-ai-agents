'use client'

// The Add / Edit form for Leads, Customers, Tasks and Content. It draws the
// fields from lib/forms.ts and saves through app/records/actions.ts, which
// re-checks the person's role and every value. Add = a collapsible "＋ Add …"
// panel; Edit = the same form, pre-filled, opened via ?edit=<id>.
import Link from 'next/link'
import { useActionState, useEffect, useRef } from 'react'
import { FORMS, fieldValue, type EditableCategory } from '@/lib/forms'
import type { Rec } from '@/lib/records'
import { saveRecord } from '@/app/records/actions'

function Fields({ category, rec }: { category: EditableCategory; rec?: Rec | null }) {
  return (
    <div className="form-grid">
      {FORMS[category].fields.map(f => {
        const value = fieldValue(rec, f)
        const common = { name: f.name, defaultValue: value, required: f.required, placeholder: f.placeholder }
        return (
          <label key={f.name} className={f.kind === 'textarea' ? 'field wide' : 'field'}>
            <span>{f.label}</span>
            {f.kind === 'textarea' ? (
              <textarea {...common} maxLength={2000} />
            ) : f.kind === 'select' ? (
              <select name={f.name} defaultValue={value || f.options?.[0]}>
                {/* Keep an older value that isn't in today's list, so saving never silently changes it. */}
                {value && !f.options?.includes(value) ? <option value={value}>{value}</option> : null}
                {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                {...common}
                type={f.kind === 'number' ? 'number' : f.kind === 'date' ? 'date' : 'text'}
                min={f.kind === 'number' ? 0 : undefined}
                step={f.kind === 'number' ? 'any' : undefined}
                maxLength={f.kind === 'text' ? 200 : undefined}
              />
            )}
          </label>
        )
      })}
    </div>
  )
}

export function AddRecord({ category }: { category: EditableCategory }) {
  const [state, action, pending] = useActionState(saveRecord, null)
  const formRef = useRef<HTMLFormElement>(null)
  const detailsRef = useRef<HTMLDetailsElement>(null)

  // After a successful add: clear the form and fold the panel away.
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset()
      if (detailsRef.current) detailsRef.current.open = false
    }
  }, [state?.ok, state?.savedAt])

  return (
    <details className="rf" ref={detailsRef}>
      <summary className="btn">＋ Add {FORMS[category].noun}</summary>
      <form ref={formRef} action={action} className="rf-body">
        <input type="hidden" name="category" value={category} />
        <Fields category={category} />
        <button className="btn" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
        {state && !state.ok ? <div className="form-msg err"><p>{state.message}</p></div> : null}
      </form>
      {state?.ok ? <div className="form-msg ok"><p>{state.message}</p></div> : null}
    </details>
  )
}

export function EditRecord({ category, rec }: { category: EditableCategory; rec: Rec }) {
  const [state, action, pending] = useActionState(saveRecord, null)
  const spec = FORMS[category]
  return (
    <form action={action} className="rf-body">
      <p className="rowlabel" style={{ marginBottom: 12 }}>Editing: {rec.title}</p>
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="id" value={rec.id} />
      <Fields category={category} rec={rec} />
      <div className="btnrow">
        <button className="btn" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</button>
        <Link className="btn ghost" href={spec.path} style={{ textDecoration: 'none' }}>Cancel</Link>
      </div>
      {state ? <div className={`form-msg ${state.ok ? 'ok' : 'err'}`}><p>{state.message}</p></div> : null}
    </form>
  )
}

export function EditLink({ path, id }: { path: string; id: number }) {
  return <Link className="edit-link" href={`${path}?edit=${id}`} scroll={true}>Edit</Link>
}
