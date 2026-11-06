update public.question_bank set section = case
  when topic in ('Unit 1','Unit 2','Unit 3','Unit 4') then 'Section A'
  when topic in ('Unit 5','Unit 6','Unit 7','Unit 8','Unit 9') then 'Section D'
  when topic = 'Unit 10' then 'Section B'
  when topic in ('Unit 11','Unit 12') then 'Section C'
  when topic in ('Unit 13','Unit 14','Unit 15') then 'Section E'
  when topic = 'Unit 16' then 'Section F'
end, updated_at = now()
where is_active and part='Part 1' and (section is null or section='')
  and topic like 'Unit %';