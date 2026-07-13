DROP POLICY IF EXISTS "Authenticated users can insert region cache" ON public.region_cache;
DROP POLICY IF EXISTS "Authenticated users can update region cache" ON public.region_cache;

CREATE POLICY "Authenticated users can insert region cache"
ON public.region_cache
FOR INSERT
TO authenticated
WITH CHECK (
  length(btrim(coord_key)) BETWEEN 1 AND 100
  AND length(btrim(region)) BETWEEN 1 AND 200
);

CREATE POLICY "Authenticated users can update region cache"
ON public.region_cache
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
  length(btrim(coord_key)) BETWEEN 1 AND 100
  AND length(btrim(region)) BETWEEN 1 AND 200
);
