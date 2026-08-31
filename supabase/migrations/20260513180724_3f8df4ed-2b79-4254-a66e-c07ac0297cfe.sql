-- Create a table to log security test results
CREATE TABLE IF NOT EXISTS public.security_test_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    role_tested TEXT NOT NULL,
    operation TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Function to run RLS tests (can be called via RPC)
CREATE OR REPLACE FUNCTION public.run_rls_security_audit()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_results JSONB := '[]'::jsonb;
    v_table RECORD;
    v_test_count INTEGER := 0;
    v_fail_count INTEGER := 0;
BEGIN
    -- Check for tables in public schema without RLS enabled
    FOR v_table IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND rowsecurity = false
    LOOP
        v_test_count := v_test_count + 1;
        v_fail_count := v_fail_count + 1;
        
        INSERT INTO public.security_test_logs (test_name, table_name, role_tested, operation, success, error_message)
        VALUES ('RLS_ENABLED_CHECK', v_table.tablename, 'public', 'ALL', false, 'RLS is disabled');
        
        v_results := v_results || jsonb_build_object(
            'table', v_table.tablename,
            'test', 'RLS_ENABLED_CHECK',
            'status', 'FAIL',
            'details', 'RLS is disabled'
        );
    END LOOP;

    -- Return summary
    RETURN jsonb_build_object(
        'total_tests', v_test_count,
        'failures', v_fail_count,
        'timestamp', now(),
        'details', v_results
    );
END;
$$;
