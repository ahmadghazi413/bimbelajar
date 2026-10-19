CREATE OR REPLACE FUNCTION public.validate_discount(_code text, _class_id uuid, _use_reward boolean DEFAULT false)
RETURNS TABLE(final_amount integer, discount integer, code text, kind text, referrer_id uuid, reward_amount integer, reward_used integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE p integer; cfg public.referral_settings%ROWTYPE; v record; a public.referral_accounts%ROWTYPE; d integer:=0;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Silakan masuk dahulu.'; END IF;
 SELECT c.price INTO p FROM public.classes c WHERE c.id=_class_id AND c.is_active;
 IF p IS NULL OR p<0 THEN RAISE EXCEPTION 'Kelas tidak tersedia.'; END IF;
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
END $$;