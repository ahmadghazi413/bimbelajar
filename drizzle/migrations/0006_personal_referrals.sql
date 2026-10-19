CREATE TABLE public.referral_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 enabled boolean NOT NULL DEFAULT true,
 discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed')),
 discount_value integer NOT NULL DEFAULT 0 CHECK (discount_value >= 0 AND (discount_type <> 'percent' OR discount_value <= 100)),
 reward_enabled boolean NOT NULL DEFAULT false,
 reward_amount integer NOT NULL DEFAULT 0 CHECK (reward_amount >= 0)
);
GRANT SELECT, INSERT, UPDATE ON public.referral_settings TO authenticated;
GRANT ALL ON public.referral_settings TO service_role;
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read referral settings" ON public.referral_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin referral settings" ON public.referral_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.referral_accounts (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 code text NOT NULL UNIQUE DEFAULT ('BIM-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)))
);
GRANT SELECT ON public.referral_accounts TO authenticated;
GRANT ALL ON public.referral_accounts TO service_role;
ALTER TABLE public.referral_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own referral account" ON public.referral_accounts FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
INSERT INTO public.referral_accounts(user_id) SELECT id FROM public.profiles;
CREATE FUNCTION public.create_referral_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.referral_accounts(user_id) VALUES (NEW.id); RETURN NEW; END $$;
CREATE TRIGGER create_referral_account AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.create_referral_account();

ALTER TABLE public.enrollments ADD COLUMN referral_code text;
ALTER TABLE public.enrollments ADD COLUMN referrer_id uuid;
ALTER TABLE public.enrollments ADD COLUMN referral_reward_amount integer NOT NULL DEFAULT 0;
ALTER TABLE public.enrollments ADD COLUMN use_referral_reward boolean NOT NULL DEFAULT false;
ALTER TABLE public.enrollments ADD COLUMN reward_used integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX referral_once_per_member ON public.enrollments(user_id) WHERE referrer_id IS NOT NULL AND status <> 'rejected';

CREATE TABLE public.referral_rewards (
 source_enrollment_id uuid PRIMARY KEY REFERENCES public.enrollments(id),
 user_id uuid NOT NULL REFERENCES public.referral_accounts(user_id),
 amount integer NOT NULL CHECK (amount >= 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_rewards TO authenticated;
GRANT ALL ON public.referral_rewards TO service_role;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own referral rewards" ON public.referral_rewards FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE FUNCTION public.referral_balance(_user_id uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN auth.uid()=_user_id OR public.has_role(auth.uid(),'admin') THEN greatest(0,
 COALESCE((SELECT sum(r.amount) FROM public.referral_rewards r JOIN public.enrollments e ON e.id=r.source_enrollment_id WHERE r.user_id=_user_id AND e.status='paid'),0)
 - COALESCE((SELECT sum(reward_used) FROM public.enrollments WHERE user_id=_user_id AND status<>'rejected'),0))::integer ELSE 0 END
$$;
REVOKE ALL ON FUNCTION public.referral_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referral_balance(uuid) TO authenticated;

CREATE FUNCTION public.validate_discount(_code text, _class_id uuid, _use_reward boolean DEFAULT false)
RETURNS TABLE(final_amount integer, discount integer, code text, kind text, referrer_id uuid, reward_amount integer, reward_used integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE p integer; cfg public.referral_settings%ROWTYPE; v record; a public.referral_accounts%ROWTYPE; d integer:=0;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Silakan masuk dahulu.'; END IF;
 SELECT price INTO p FROM public.classes WHERE id=_class_id AND is_active;
 IF p IS NULL OR p<0 THEN RAISE EXCEPTION 'Kelas tidak tersedia.'; END IF;
 kind:=NULL; code:=NULL; referrer_id:=NULL; reward_amount:=0;
 IF nullif(trim(_code),'') IS NOT NULL THEN
   SELECT * INTO a FROM public.referral_accounts WHERE upper(code)=upper(trim(_code));
   IF FOUND THEN
     SELECT * INTO cfg FROM public.referral_settings WHERE id=true;
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
END $$;
REVOKE ALL ON FUNCTION public.validate_discount(text,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_discount(text,uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.enrollment_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q record;
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Pendaftaran harus menggunakan akun sendiri.'; END IF;
   PERFORM 1 FROM public.referral_accounts WHERE user_id=NEW.user_id FOR UPDATE;
   IF nullif(trim(NEW.voucher_code),'') IS NOT NULL THEN PERFORM 1 FROM public.vouchers WHERE lower(code)=lower(trim(NEW.voucher_code)) FOR UPDATE; END IF;
   SELECT * INTO q FROM public.validate_discount(COALESCE(nullif(NEW.referral_code,''),NEW.voucher_code),NEW.class_id,NEW.use_referral_reward);
   NEW.status:='pending'; NEW.paid_at:=NULL; NEW.amount:=q.final_amount;
   NEW.referral_code:=CASE WHEN q.kind='referral' THEN q.code ELSE NULL END;
   NEW.voucher_code:=CASE WHEN q.kind='voucher' THEN q.code ELSE NULL END;
   NEW.referrer_id:=q.referrer_id; NEW.referral_reward_amount:=q.reward_amount; NEW.reward_used:=q.reward_used;
   IF q.kind='voucher' THEN UPDATE public.vouchers SET used_count=used_count+1 WHERE code=q.code; END IF;
 ELSE
   NEW.amount:=OLD.amount; NEW.user_id:=OLD.user_id; NEW.class_id:=OLD.class_id;
   NEW.referral_code:=OLD.referral_code; NEW.voucher_code:=OLD.voucher_code; NEW.referrer_id:=OLD.referrer_id;
   NEW.referral_reward_amount:=OLD.referral_reward_amount; NEW.reward_used:=OLD.reward_used; NEW.use_referral_reward:=OLD.use_referral_reward;
   IF NOT public.has_role(auth.uid(),'admin') THEN NEW.status:=OLD.status; NEW.paid_at:=OLD.paid_at; END IF;
 END IF;
 IF NEW.status='paid' AND NEW.paid_at IS NULL THEN NEW.paid_at:=now(); END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.issue_referral_reward() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='paid' AND NEW.referrer_id IS NOT NULL AND NEW.referral_reward_amount>0 THEN
   INSERT INTO public.referral_rewards(source_enrollment_id,user_id,amount) VALUES(NEW.id,NEW.referrer_id,NEW.referral_reward_amount) ON CONFLICT(source_enrollment_id) DO NOTHING;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER issue_referral_reward AFTER UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.issue_referral_reward();