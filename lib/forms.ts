// 👉 The Add / Edit forms for each editable tab, as plain data. The form
//    component (app/_components/RecordForm.tsx) draws these fields, and the server
//    action (app/records/actions.ts) uses the SAME list to check and save them —
//    so the form and the database can never disagree. Safe for client + server.
//
//    `to` says where a field lives on the `records` row: a real column, or a key
//    inside the `meta` bag ('meta.next'). `also` copies the value to more places
//    (a lead's potential is both `amount` and `meta.potential`, which is what the
//    Leads tab and the bot already read).
import type { Rec } from './records'

export type FieldKind = 'text' | 'number' | 'date' | 'select' | 'textarea'
export type Field = {
  name: string
  label: string
  kind: FieldKind
  to: string
  also?: string[]
  options?: string[]
  required?: boolean
  placeholder?: string
}
export type EditableCategory = 'lead' | 'customer' | 'task' | 'content'
export type FormSpec = { category: EditableCategory; noun: string; path: string; fields: Field[] }

export const FORMS: Record<EditableCategory, FormSpec> = {
  lead: {
    category: 'lead',
    noun: 'lead',
    path: '/leads',
    fields: [
      { name: 'title', label: 'Name — company', kind: 'text', to: 'title', required: true, placeholder: 'Aisha Rahman — Acme' },
      { name: 'status', label: 'Stage', kind: 'select', to: 'status', options: ['new', 'contacted', 'appointment', 'closed', 'nurture'] },
      { name: 'potential', label: 'Potential (RM)', kind: 'number', to: 'amount', also: ['meta.potential'] },
      { name: 'next', label: 'Next step', kind: 'text', to: 'meta.next', placeholder: 'book demo' },
      { name: 'due_date', label: 'Follow up by', kind: 'date', to: 'due_date' },
      { name: 'notes', label: 'Notes', kind: 'textarea', to: 'notes' },
    ],
  },
  customer: {
    category: 'customer',
    noun: 'customer',
    path: '/customers',
    fields: [
      { name: 'title', label: 'Customer', kind: 'text', to: 'title', required: true, placeholder: 'Caremetic Sdn Bhd' },
      { name: 'company', label: 'Company', kind: 'text', to: 'meta.company' },
      { name: 'owes', label: 'Owes (RM)', kind: 'number', to: 'amount', also: ['meta.owes'] },
      { name: 'last_touch', label: 'Last touch', kind: 'date', to: 'meta.last_touch' },
      { name: 'next', label: 'Next action', kind: 'text', to: 'meta.next', placeholder: 'send report' },
      { name: 'status', label: 'Status', kind: 'select', to: 'status', options: ['active', 'paused', 'past'] },
      { name: 'notes', label: 'Notes', kind: 'textarea', to: 'notes' },
    ],
  },
  task: {
    category: 'task',
    noun: 'task',
    path: '/tasks',
    fields: [
      { name: 'title', label: 'Task', kind: 'text', to: 'title', required: true, placeholder: 'Chase supplier' },
      { name: 'due_date', label: 'Due', kind: 'date', to: 'due_date' },
      { name: 'status', label: 'Status', kind: 'select', to: 'status', options: ['open', 'done'] },
      { name: 'owner', label: 'Who', kind: 'text', to: 'meta.owner' },
      { name: 'notes', label: 'Notes', kind: 'textarea', to: 'notes' },
    ],
  },
  content: {
    category: 'content',
    noun: 'content item',
    path: '/content',
    fields: [
      { name: 'title', label: 'Title', kind: 'text', to: 'title', required: true, placeholder: 'Reel: 3 wedding-day tips' },
      { name: 'format', label: 'Format', kind: 'select', to: 'meta.format', options: ['reel', 'post', 'carousel', 'video', 'ad', 'story'] },
      { name: 'platform', label: 'Platform', kind: 'select', to: 'meta.platform', options: ['instagram', 'tiktok', 'facebook', 'linkedin', 'youtube', 'other'] },
      { name: 'status', label: 'Status', kind: 'select', to: 'status', options: ['draft', 'scheduled', 'posted'] },
      { name: 'due_date', label: 'Date', kind: 'date', to: 'due_date' },
      { name: 'views', label: 'Views', kind: 'number', to: 'meta.views' },
      { name: 'notes', label: 'Notes', kind: 'textarea', to: 'notes' },
    ],
  },
}

export const isEditableCategory = (c: unknown): c is EditableCategory =>
  typeof c === 'string' && c in FORMS

// The current value of a field on a record, as a string for the form input.
export function fieldValue(rec: Rec | null | undefined, f: Field): string {
  if (!rec) return ''
  const v = f.to.startsWith('meta.') ? rec.meta?.[f.to.slice(5)] : (rec as any)[f.to]
  return v === null || v === undefined ? '' : String(v)
}
