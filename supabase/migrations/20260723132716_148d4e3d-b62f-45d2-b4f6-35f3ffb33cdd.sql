
ALTER TABLE public.lalamove_orders
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_notes TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE public.lalamove_orders
  DROP CONSTRAINT IF EXISTS lalamove_orders_cancellation_reason_check;

ALTER TABLE public.lalamove_orders
  ADD CONSTRAINT lalamove_orders_cancellation_reason_check
  CHECK (
    cancellation_reason IS NULL OR cancellation_reason IN (
      'USER_REQUESTED',
      'DRIVER_UNRESPONSIVE',
      'DRIVER_LATE',
      'DRIVER_ASKED_CHANGE',
      'DRIVER_ASKED_CANCEL',
      'DRIVER_RUDE',
      'DRIVER_ASKED_FOR_MORE_MONEY',
      'DELIVERY_ETA_TOO_LONG',
      'PRICE_TOO_HIGH',
      'INCORRECT_ORDER_DETAILS',
      'MISTAKEN_ORDER',
      'WRONG_ADDRESS',
      'NO_CAPACITY',
      'OTHER'
    )
  );

CREATE INDEX IF NOT EXISTS idx_lalamove_orders_cancellation_reason
  ON public.lalamove_orders (cancellation_reason)
  WHERE cancellation_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lalamove_orders_cancelled_at
  ON public.lalamove_orders (cancelled_at DESC)
  WHERE cancelled_at IS NOT NULL;
