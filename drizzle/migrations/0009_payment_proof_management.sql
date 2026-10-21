CREATE POLICY "admin delete payment proof" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] <> 'qris' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner delete unused payment proof" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text AND NOT EXISTS (SELECT 1 FROM public.enrollments e WHERE e.proof_url = name));
CREATE OR REPLACE FUNCTION public.submit_proof(_enrollment_id uuid, _proof_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE e public.enrollments%ROWTYPE;
BEGIN
 SELECT * INTO e FROM public.enrollments WHERE id = _enrollment_id AND user_id = auth.uid() AND status = 'pending' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pembayaran tidak tersedia atau tidak lagi menunggu konfirmasi.'; END IF;
 IF _proof_url NOT LIKE auth.uid()::text || '/' || e.id::text || '-%' THEN RAISE EXCEPTION 'Bukti harus milik pembayaran ini.'; END IF;
 IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'payment-proofs' AND o.name = _proof_url AND o.metadata->>'mimetype' IN ('image/jpeg', 'image/png', 'image/webp') AND (o.metadata->>'size')::bigint BETWEEN 1 AND 5242880) THEN RAISE EXCEPTION 'Gunakan foto JPG, PNG, atau WebP maksimal 5 MB.'; END IF;
 UPDATE public.enrollments SET proof_url = _proof_url WHERE id = e.id;
END $function$;
REVOKE ALL ON FUNCTION public.submit_proof(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_proof(uuid, text) TO authenticated;