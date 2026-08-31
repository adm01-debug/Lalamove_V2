-- Tabela para solicitações de reset de senha com aprovação
CREATE TABLE public.password_reset_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Anyone can request password reset"
ON public.password_reset_requests
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins and managers can view reset requests"
ON public.password_reset_requests
FOR SELECT
USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
);

CREATE POLICY "Admins can update reset requests"
ON public.password_reset_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.password_reset_requests;