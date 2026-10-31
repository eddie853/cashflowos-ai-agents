// 👉 Every tab in the app, in one plain list (no 'use client', so server code like
//    the layout can read it too). Adding a tab? Add ONE line to the right group
//    here, give it an icon + decide where it sits on phones in BottomNav.tsx,
//    say who may open it in lib/access.ts, and create app/<name>/page.tsx.
//    See docs/add-a-tab-prompt.md for the copy-paste prompt.
export type Tab = { href: string; label: string; ico: string }

export const NAV_GROUPS: { label: string; tabs: Tab[] }[] = [
  { label: 'Overview', tabs: [
    { href: '/', label: 'Dashboard', ico: '🏠' },
  ] },
  { label: 'Money', tabs: [
    { href: '/cash-in', label: 'Cash In', ico: '💰' },
    { href: '/cash-out', label: 'Cash Out', ico: '🧾' },
  ] },
  { label: 'Pipeline', tabs: [
    { href: '/leads', label: 'Leads', ico: '🧲' },
    { href: '/customers', label: 'Customers', ico: '🧑‍🤝‍🧑' },
  ] },
  { label: 'Work', tabs: [
    { href: '/content', label: 'Content', ico: '📣' },
    { href: '/tasks', label: 'Tasks', ico: '✅' },
  ] },
  { label: 'Robot', tabs: [
    { href: '/approvals', label: 'Approvals', ico: '🙋' },
    { href: '/employees', label: 'AI Employees', ico: '🤖' },
    { href: '/vault', label: 'Vault', ico: '🗄️' },
  ] },
  { label: 'Team', tabs: [
    { href: '/admin', label: 'Users & Activity', ico: '👥' },
  ] },
]

// Flat list kept for anything that wants every tab in one array.
export const TABS = NAV_GROUPS.flatMap(g => g.tabs)
