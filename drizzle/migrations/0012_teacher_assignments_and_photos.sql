ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS teacher_id text;
CREATE OR REPLACE FUNCTION public.is_teacher(_class_id uuid DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v text; me text;
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 SELECT lower(email) INTO me FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL;
 IF me IS NULL THEN RETURN false; END IF;
 SELECT value INTO v FROM public.settings WHERE key='teacher_list';
 RETURN EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(nullif(v,''),'[]')::jsonb) t WHERE lower(t->>'email')=me AND (_class_id IS NULL OR CASE WHEN t->>'allClasses'='true' THEN true WHEN jsonb_typeof(t->'classIds')='array' THEN (t->'classIds') ? _class_id::text ELSE coalesce(t->>'classId','') IN ('','all',_class_id::text) END));
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
CREATE POLICY "teacher read assigned classes" ON public.classes FOR SELECT TO authenticated USING (public.is_teacher(id));
CREATE POLICY "teacher read assigned subjects" ON public.subjects FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.subject_id=subjects.id AND public.is_teacher(c.id)));
CREATE OR REPLACE FUNCTION public.public_teachers() RETURNS TABLE(id text,name text,photo_path text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT t->>'id',t->>'name',coalesce(t->>'photoPath','') FROM public.settings s CROSS JOIN LATERAL jsonb_array_elements(s.value::jsonb) t WHERE s.key='teacher_list' $$;
GRANT EXECUTE ON FUNCTION public.public_teachers() TO anon,authenticated;
CREATE POLICY "teacher photos read" ON storage.objects FOR SELECT TO anon,authenticated USING (bucket_id='teacher-photos' AND (public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.public_teachers() t WHERE t.photo_path=name)));
CREATE POLICY "admin upload teacher photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='teacher-photos' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete teacher photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='teacher-photos' AND public.has_role(auth.uid(),'admin'));