-- Valida o CHECK de service_type em lalamove_orders.
-- O constraint foi criado NOT VALID (evita lock/scan na criação). As linhas
-- existentes já estão dentro do catálogo canônico de 14 serviceTypes
-- (src/lib/lalamoveCatalog.ts), então a validação é segura e passa a
-- proteger INSERT/UPDATE futuros contra valores fora do catálogo.

ALTER TABLE public.lalamove_orders
  VALIDATE CONSTRAINT lalamove_orders_service_type_chk;
