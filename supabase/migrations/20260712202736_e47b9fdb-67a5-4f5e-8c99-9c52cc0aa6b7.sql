-- INSERT: remove duplicata, mantém uma política (dono).
DROP POLICY IF EXISTS "Users can insert own passkeys" ON public.user_passkeys;
DROP POLICY IF EXISTS "Users can insert their passkeys" ON public.user_passkeys;
CREATE POLICY "Users can insert own passkeys"
  ON public.user_passkeys FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: consolida em uma (dono, com WITH CHECK).
DROP POLICY IF EXISTS "Users can update own passkeys" ON public.user_passkeys;
DROP POLICY IF EXISTS "Users can update their passkeys" ON public.user_passkeys;
CREATE POLICY "Users can update own passkeys"
  ON public.user_passkeys FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: consolida em uma (dono OU admin para revogação).
DROP POLICY IF EXISTS "Users can delete own passkeys" ON public.user_passkeys;
DROP POLICY IF EXISTS "Users can delete their passkeys" ON public.user_passkeys;
CREATE POLICY "Users can delete own passkeys"
  ON public.user_passkeys FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));