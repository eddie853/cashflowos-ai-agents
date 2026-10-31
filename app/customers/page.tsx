import { getRecords, m, rm, type Rec } from '@/lib/records'
import Empty from '@/app/_components/Empty'
import { requireTab } from '@/lib/auth'
import { canEdit } from '@/lib/access'
import { AddRecord, EditRecord, EditLink } from '@/app/_components/RecordForm'

export const dynamic = 'force-dynamic'

// The Customers tab = everyone who's already bought. Each is a `records` row with
// category='customer'. We show what matters after the sale: how much they OWE,
// when we LAST TOUCHED them, and the NEXT ACTION. The table collapses to stacked
// cards on phones (the .tbl mobile rules + data-label attributes in globals.css).

// How much a customer owes: prefer meta.owes, else the amount on the row.
function owes(r: Rec): number {
  const o = r.meta?.owes
  return Number(o ?? r.amount ?? 0)
}

export default async function Customers({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const me = await requireTab('/customers')
  const editable = canEdit(me.role, 'customer')
  const { edit } = await searchParams
  const rows = await getRecords()
  const customers = rows.filter(r => r.category === 'customer')

  // Sort the ones who owe money to the top — that's what needs a nudge.
  customers.sort((a, b) => owes(b) - owes(a))
  const editing = editable && edit ? customers.find(r => String(r.id) === edit) : undefined

  return (
    <>
      <h1 className="ph">Customers 🤝</h1>
      <p className="cap">Who's bought — what they owe, last touch, next action.</p>

      {editable ? (
        editing ? <EditRecord category="customer" rec={editing} /> : <AddRecord category="customer" />
      ) : null}

      {customers.length === 0 ? (
        <Empty label="customers" />
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Owes</th>
              <th>Last touch</th>
              <th>Next action</th>
              {editable ? <th></th> : null}
            </tr>
          </thead>
          <tbody>
            {customers.map(r => {
              const owed = owes(r)
              return (
                <tr key={r.id}>
                  <td data-label="Customer">{r.title}</td>
                  <td data-label="Owes">
                    {owed > 0 ? (
                      <span className="pill overdue">{rm(owed)}</span>
                    ) : (
                      <span className="pill paid">Nothing</span>
                    )}
                  </td>
                  <td data-label="Last touch">{m(r, 'last_touch')}</td>
                  <td data-label="Next action">{m(r, 'next')}</td>
                  {editable ? <td data-label=""><EditLink path="/customers" id={r.id} /></td> : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </>
  )
}
