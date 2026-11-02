ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS allowed_packages text[] NOT NULL DEFAULT ARRAY['monthly','session']::text[];
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS available_sessions integer[] NOT NULL DEFAULT ARRAY[4,8]::integer[];

CREATE OR REPLACE FUNCTION public.class_session_count(_class_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT count(*)::int FROM public.class_sessions WHERE class_id=_class_id AND is_published
$$;

CREATE OR REPLACE FUNCTION public.sessions_bought(_user_id uuid, _class_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(sum(sessions_total),0)::int FROM public.enrollments
  WHERE user_id=_user_id AND class_id=_class_id AND package_type='session' AND status IN ('paid','pending')
$$;

CREATE OR REPLACE FUNCTION public.session_allowed(_user_id uuid, _session_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record; idx int; bought int;
BEGIN
  SELECT class_id, level, number, is_published INTO s FROM public.class_sessions WHERE id=_session_id;
  IF NOT FOUND OR NOT s.is_published THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.enrollments WHERE user_id=_user_id AND class_id=s.class_id AND status='paid' AND package_type<>'session') THEN RETURN true; END IF;
  SELECT COALESCE(sum(sessions_total),0) INTO bought FROM public.enrollments WHERE user_id=_user_id AND class_id=s.class_id AND status='paid' AND package_type='session';
  SELECT count(*) INTO idx FROM public.class_sessions c WHERE c.class_id=s.class_id AND c.is_published AND (c.level, c.number) <= (s.level, s.number);
  RETURN idx <= bought;
END $$;

CREATE OR REPLACE FUNCTION public.validate_discount_base(_code text, _class_id uuid, _use_reward boolean, _base integer)
 RETURNS TABLE(final_amount integer, discount integer, code text, kind text, referrer_id uuid, reward_amount integer, reward_used integer)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p integer; cfg public.referral_settings%ROWTYPE; v record; a public.referral_accounts%ROWTYPE; d integer:=0;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Silakan masuk dahulu.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.classes c WHERE c.id=_class_id AND c.is_active) THEN RAISE EXCEPTION 'Kelas tidak tersedia.'; END IF;
 p:=_base;
 IF p IS NULL OR p<0 THEN RAISE EXCEPTION 'Harga tidak valid.'; END IF;
 kind:=NULL; code:=NULL; referrer_id:=NULL; reward_amount:=0;
 IF nullif(trim(_code),'') IS NOT NULL THEN
   SELECT ra.* INTO a FROM public.referral_accounts ra WHERE upper(ra.code)=upper(trim(_code));
   IF FOUND THEN
     SELECT rs.* INTO cfg FROM public.referral_settings rs WHERE rs.id=true;
     IF NOT FOUND THEN cfg.enabled:=true; cfg.discount_type:='percent'; cfg.discount_value:=0; cfg.reward_enabled:=false; cfg.reward_amount:=0; END IF;
     IF NOT cfg.enabled THEN RAISE EXCEPTION 'Program referral sedang nonaktif.'; END IF;
     IF a.user_id=auth.uid() THEN RAISE EXCEPTION 'Kode sendiri tidak dapat digunakan.'; END IF;
     IF EXISTS(SELECT 1 FROM public.enrollments e WHERE e.user_id=auth.uid() AND e.referrer_id IS NOT NULL AND e.status<>'rejected') THEN RAISE EXCEPTION 'Kode teman hanya dapat digunakan sekali per akun.'; END IF;
     d:=least(p, CASE WHEN cfg.discount_type='percent' THEN round(p*cfg.discount_value/100.0)::integer ELSE cfg.discount_value END);
     code:=a.code; kind:='referral'; referrer_id:=a.user_id; reward_amount:=CASE WHEN cfg.reward_enabled THEN cfg.reward_amount ELSE 0 END;
   ELSE
     SELECT * INTO v FROM public.validate_voucher(_code,p);
     IF NOT FOUND THEN RAISE EXCEPTION 'Kode tidak valid atau sudah habis.'; END IF;
     d:=v.discount; code:=v.voucher_code; kind:='voucher';
   END IF;
 END IF;
 reward_used:=CASE WHEN _use_reward THEN least(p-d,public.referral_balance(auth.uid())) ELSE 0 END;
 discount:=d; final_amount:=p-d-reward_used; RETURN NEXT;
END $function$;

CREATE OR REPLACE FUNCTION public.enrollment_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE q record; cls record; prev_end timestamptz; n int; bought int; total int; pps int; base int;
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Pendaftaran harus menggunakan akun sendiri.'; END IF;
   SELECT c.price, c.price_per_session, c.package_weeks, c.allowed_packages, c.available_sessions INTO cls FROM public.classes c WHERE c.id=NEW.class_id;
   IF cls.allowed_packages IS NULL OR cardinality(cls.allowed_packages)=0 THEN cls.allowed_packages:=ARRAY['monthly']; END IF;
   NEW.package_type:=CASE WHEN NEW.package_type = ANY(cls.allowed_packages) THEN NEW.package_type ELSE cls.allowed_packages[1] END;
   IF NEW.package_type='session' THEN
     n:=COALESCE(NEW.sessions_total,0);
     bought:=public.sessions_bought(NEW.user_id, NEW.class_id);
     total:=public.class_session_count(NEW.class_id);
     IF n<=0 OR NOT (n = ANY(cls.available_sessions) OR (bought>0 AND n=greatest(total-bought,0))) THEN
       RAISE EXCEPTION 'Jumlah sesi tidak tersedia untuk kelas ini.';
     END IF;
     pps:=CASE WHEN COALESCE(cls.price_per_session,0)>0 THEN cls.price_per_session ELSE round(cls.price/8.0)::int END;
     base:=n*pps;
     NEW.package_weeks:=0; NEW.sessions_total:=n;
   ELSE
     base:=cls.price; NEW.package_weeks:=COALESCE(cls.package_weeks,4); NEW.sessions_total:=0;
   END IF;
   NEW.sessions_used:=0;
   NEW.starts_at:=NULL;
   PERFORM 1 FROM public.referral_accounts WHERE user_id=NEW.user_id FOR UPDATE;
   IF nullif(trim(NEW.voucher_code),'') IS NOT NULL THEN PERFORM 1 FROM public.vouchers WHERE lower(code)=lower(trim(NEW.voucher_code)) FOR UPDATE; END IF;
   SELECT * INTO q FROM public.validate_discount_base(COALESCE(nullif(NEW.referral_code,''),NEW.voucher_code),NEW.class_id,NEW.use_referral_reward,base);
   NEW.status:='pending'; NEW.paid_at:=NULL; NEW.amount:=q.final_amount;
   NEW.referral_code:=CASE WHEN q.kind='referral' THEN q.code ELSE NULL END;
   NEW.voucher_code:=CASE WHEN q.kind='voucher' THEN q.code ELSE NULL END;
   NEW.referrer_id:=q.referrer_id; NEW.referral_reward_amount:=q.reward_amount; NEW.reward_used:=q.reward_used;
   IF q.kind='voucher' THEN UPDATE public.vouchers SET used_count=used_count+1 WHERE code=q.code; END IF;
 ELSE
   NEW.amount:=OLD.amount; NEW.user_id:=OLD.user_id; NEW.class_id:=OLD.class_id;
   NEW.referral_code:=OLD.referral_code; NEW.voucher_code:=OLD.voucher_code; NEW.referrer_id:=OLD.referrer_id;
   NEW.referral_reward_amount:=OLD.referral_reward_amount; NEW.reward_used:=OLD.reward_used; NEW.use_referral_reward:=OLD.use_referral_reward;
   NEW.package_type:=OLD.package_type; NEW.package_weeks:=OLD.package_weeks; NEW.sessions_total:=OLD.sessions_total;
   IF auth.uid() IS NOT NULL THEN NEW.starts_at:=OLD.starts_at; END IF;
   IF NOT public.has_role(auth.uid(),'admin') THEN NEW.status:=OLD.status; NEW.paid_at:=OLD.paid_at; NEW.sessions_used:=OLD.sessions_used; END IF;
   IF NEW.status='paid' AND OLD.status IS DISTINCT FROM 'paid' THEN
     SELECT max(public.enrollment_end(COALESCE(x.starts_at, x.paid_at), x.package_type, x.package_weeks)) INTO prev_end
       FROM public.enrollments x
       WHERE x.user_id=NEW.user_id AND x.class_id=NEW.class_id AND x.status='paid' AND x.id<>NEW.id;
     NEW.starts_at:=GREATEST(now(), COALESCE(prev_end, now()));
   END IF;
 END IF;
 IF NEW.status='paid' AND NEW.paid_at IS NULL THEN NEW.paid_at:=now(); END IF;
 RETURN NEW;
END $function$;

DROP POLICY IF EXISTS "paid read session private" ON public.session_private;
CREATE POLICY "paid read session private" ON public.session_private FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR session_allowed(auth.uid(), session_id));
DROP POLICY IF EXISTS "paid read rec" ON public.session_recordings;
CREATE POLICY "paid read rec" ON public.session_recordings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR session_allowed(auth.uid(), session_id));