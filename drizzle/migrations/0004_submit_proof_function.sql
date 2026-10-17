CREATE OR REPLACE FUNCTION public.submit_proof(_enrollment_id uuid, _proof_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.enrollments
  SET proof_url = _proof_url
  WHERE id = _enrollment_id AND user_id = auth.uid() AND status = 'pending';
END
$function$;
GRANT EXECUTE ON FUNCTION public.submit_proof(uuid, text) TO authenticated;