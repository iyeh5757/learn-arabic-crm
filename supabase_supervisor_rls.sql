-- Allow supervisors to add payments for students assigned to their own teachers
create policy "Supervisors can insert payments for their teachers' students"
on payments
for insert
to authenticated
with check (
  exists (
    select 1
    from students s
    join teachers t on t.id = s.assigned_teacher_id
    where s.id = payments.student_id
      and t.supervisor_id = auth.uid()
  )
);

-- Allow supervisors to edit students assigned to their own teachers
create policy "Supervisors can update their teachers' students"
on students
for update
to authenticated
using (
  exists (
    select 1
    from teachers t
    where t.id = students.assigned_teacher_id
      and t.supervisor_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from teachers t
    where t.id = students.assigned_teacher_id
      and t.supervisor_id = auth.uid()
  )
);
