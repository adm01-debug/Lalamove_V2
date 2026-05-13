-- Assign admin role to the main user
INSERT INTO public.user_roles (user_id, role)
VALUES ('bf10a243-4982-4394-883e-664cdd5b51f4', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;