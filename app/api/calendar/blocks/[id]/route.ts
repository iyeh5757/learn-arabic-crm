// app/api/calendar/blocks/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// DELETE /api/calendar/blocks/[id]?scope=one|future|all
// one    → just this block
// future → this and all later blocks in the same recurrence
// all    → every block in the same recurrence
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = new URL(req.url).searchParams.get('scope') ?? 'one'

  const { data: block } = await supabase
    .from('calendar_blocks')
    .select('id, teacher_id, start_at, recurrence_group_id')
    .eq('id', params.id)
    .single()
  if (!block) return NextResponse.json({ error: 'Block not found' }, { status: 404 })

  // RLS still scopes deletes to what the user is allowed to remove
  let del = supabase.from('calendar_blocks').delete()

  if (scope === 'one' || !block.recurrence_group_id) {
    del = del.eq('id', params.id)
  } else if (scope === 'all') {
    del = del.eq('recurrence_group_id', block.recurrence_group_id)
  } else if (scope === 'future') {
    del = del.eq('recurrence_group_id', block.recurrence_group_id).gte('start_at', block.start_at)
  } else {
    del = del.eq('id', params.id)
  }

  const { error } = await del
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
