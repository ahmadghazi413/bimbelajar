CREATE POLICY "authenticated read qris" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = 'qris');
CREATE POLICY "admin write qris" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = 'qris' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update qris" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = 'qris' AND public.has_role(auth.uid(), 'admin'));