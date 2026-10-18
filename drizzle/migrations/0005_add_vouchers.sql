CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value integer NOT NULL DEFAULT 0,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vouchers TO authenticated;
GRANT ALL ON public.vouchers TO service_role;

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin write vouchers" ON public.vouchers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.enrollments ADD COLUMN voucher_code text;

CREATE OR REPLACE FUNCTION public.validate_voucher(_code text, _price integer)
RETURNS TABLE(final_amount integer, discount integer, voucher_code text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.vouchers%ROWTYPE; d integer;
BEGIN
  SELECT * INTO v FROM public.vouchers WHERE lower(code) = lower(trim(_code)) AND is_active;
  IF NOT FOUND THEN RETURN; END IF;
  IF v.expires_at IS NOT NULL AND v.expires_at < now() THEN RETURN; END IF;
  IF v.max_uses IS NOT NULL AND v.used_count >= v.max_uses THEN RETURN; END IF;
  IF v.discount_type = 'percent' THEN
    d := greatest(0, least(_price, round(_price * v.discount_value / 100.0)::integer));
  ELSE
    d := greatest(0, least(_price, v.discount_value));
  END IF;
  final_amount := _price - d;
  discount := d;
  voucher_code := v.code;
  RETURN NEXT;
END $$;

GRANT EXECUTE ON FUNCTION public.validate_voucher(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.enrollment_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_final integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    NEW.status := 'pending'; NEW.paid_at := NULL;
    SELECT price INTO NEW.amount FROM public.classes WHERE id = NEW.class_id;
    IF NEW.voucher_code IS NOT NULL AND NEW.voucher_code <> '' THEN
      SELECT final_amount INTO v_final FROM public.validate_voucher(NEW.voucher_code, NEW.amount);
      IF v_final IS NOT NULL THEN
        NEW.amount := v_final;
        UPDATE public.vouchers SET used_count = used_count + 1 WHERE lower(code) = lower(NEW.voucher_code);
      ELSE
        NEW.voucher_code := NULL;
      END IF;
    END IF;
  END IF;
  IF NEW.status = 'paid' AND NEW.paid_at IS NULL THEN NEW.paid_at := now(); END IF;
  RETURN NEW;
END $$;