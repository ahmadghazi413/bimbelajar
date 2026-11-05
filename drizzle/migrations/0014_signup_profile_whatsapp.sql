CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone) VALUES (NEW.id, left(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), 100), CASE WHEN NEW.raw_user_meta_data->>'phone' ~ '^\+?[0-9]{9,15}$' THEN NEW.raw_user_meta_data->>'phone' ELSE NULL END);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END
$function$;