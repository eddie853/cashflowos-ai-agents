// 👉 WHO MAY SEE / DO WHAT — the one place roles are defined.
// Plain data, no secrets: safe to import from server code AND client components
// (the nav uses it to hide tabs). The SERVER is still the real lock — every page
// calls requireTab() and every action re-checks with the functions below.

export type Role = 'admin' | 'sales' | 'staff'

export const ROLES: { key: Role; label: string; blurb: string }[] = [
  { key: 'admin', label: 'Admin', blurb: 'Everything, incl. money, approvals and managing users' },
  { key: 'sales', label: 'Sales', blurb: 'Leads, Customers, Tasks, Content' },
  { key: 'staff', label: 'Staff', blurb: 'Tasks, Content' },
]

export const isRole = (v: unknown): v is Role => ROLES.some(r => r.key === v)
export const roleLabel = (r: Role) => ROLES.find(x => x.key === r)?.label ?? r

// Tab → roles allowed to open it. A tab missing from this list is admin-only.
const TAB_ROLES: Record<string, Role[]> = {
  '/': ['admin', 'sales', 'staff'],
  '/leads': ['admin', 'sales'],
  '/customers': ['admin', 'sales'],
  '/tasks': ['admin', 'sales', 'staff'],
  '/content': ['admin', 'sales', 'staff'],
}

export const canSeeTab = (role: Role, href: string) => (TAB_ROLES[href] ?? ['admin']).includes(role)

// Money totals (Dashboard money row) and the YES on money actions: Admins only.
export const canSeeMoney = (role: Role) => role === 'admin'
export const canApprove = (role: Role) => role === 'admin'

// Which record categories each role may add / edit from the web app.
const EDIT_ROLES: Record<string, Role[]> = {
  lead: ['admin', 'sales'],
  customer: ['admin', 'sales'],
  task: ['admin', 'sales', 'staff'],
  content: ['admin', 'sales', 'staff'],
}

export const canEdit = (role: Role, category: string) => (EDIT_ROLES[category] ?? []).includes(role)
