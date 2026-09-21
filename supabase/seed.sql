-- OPTIONAL sample family so you can see the tree straight away. Delete it later from /admin.
do $$
declare root uuid; wife uuid; u1 uuid; c1 uuid; c2 uuid; c3 uuid; w2 uuid; u2 uuid;
begin
  insert into public.people (name) values ('रामप्रसाद शर्मा') returning id into root;
  insert into public.people (name) values ('सावित्री देवी') returning id into wife;
  insert into public.unions (a_id, b_id) values (root, wife) returning id into u1;

  insert into public.people (name, parent_union_id) values ('मोहनलाल शर्मा', u1) returning id into c1;
  insert into public.people (name, parent_union_id) values ('कमला शर्मा', u1) returning id into c2;
  insert into public.people (name, parent_union_id) values ('सुरेश शर्मा', u1) returning id into c3;

  insert into public.people (name) values ('गीता देवी') returning id into w2;
  insert into public.unions (a_id, b_id) values (c1, w2) returning id into u2;
  insert into public.people (name, parent_union_id) values ('अनिल शर्मा', u2);
  insert into public.people (name, parent_union_id) values ('सीमा शर्मा', u2);
end $$;
