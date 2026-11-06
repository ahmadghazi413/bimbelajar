ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS package_target text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS target_counts integer[] NOT NULL DEFAULT '{}';
ALTER TABLE public.vouchers DROP CONSTRAINT IF EXISTS vouchers_package_target_check;
ALTER TABLE public.vouchers ADD CONSTRAINT vouchers_package_target_check CHECK (package_target IN ('all','monthly','session'));

CREATE OR REPLACE FUNCTION public.voucher_scope_ok(_code text, _package text, _count integer)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT (v.package_target = 'all' OR v.package_target = _package)
       AND (cardinality(v.target_counts) = 0 OR v.package_target = 'all' OR _count = ANY(v.target_counts))
    FROM public.vouchers v WHERE lower(v.code) = lower(trim(_code)) LIMIT 1), true)
$$;
GRANT EXECUTE ON FUNCTION public.voucher_scope_ok(text, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.enrollment_voucher_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF nullif(trim(NEW.voucher_code), '') IS NOT NULL AND NOT public.voucher_scope_ok(
       NEW.voucher_code, NEW.package_type,
       CASE WHEN NEW.package_type = 'session' THEN NEW.sessions_total ELSE NEW.package_weeks / 4 END) THEN
    RAISE EXCEPTION 'Voucher ini tidak berlaku untuk paket yang dipilih.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enrollment_voucher_scope ON public.enrollments;
CREATE TRIGGER enrollment_voucher_scope BEFORE INSERT ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.enrollment_voucher_scope();