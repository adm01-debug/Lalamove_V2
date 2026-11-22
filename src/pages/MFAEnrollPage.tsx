import { useNavigate, useLocation } from 'react-router-dom';
import { MFAEnroll } from '@/components/auth/MFAEnroll';

export default function MFAEnrollPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient opacity-50" />
      <div className="absolute inset-0 noise" />

      <div className="relative z-10 w-full max-w-md">
        <h1 className="sr-only">Inscrição em duas etapas</h1>
        <MFAEnroll
          onSuccess={() => navigate(from, { replace: true })}
          onCancel={() => navigate('/auth')}
        />
      </div>
    </div>
  );
}
