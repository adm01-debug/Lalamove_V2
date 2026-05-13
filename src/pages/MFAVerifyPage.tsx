import { useNavigate, useLocation } from 'react-router-dom';
import { MFAVerify } from '@/components/auth/MFAVerify';

export default function MFAVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient opacity-50" />
      <div className="absolute inset-0 noise" />

      <div className="relative z-10 w-full max-w-md">
        <MFAVerify 
          onSuccess={() => navigate(from, { replace: true })}
          onCancel={() => navigate('/auth')}
        />
      </div>
    </div>
  );
}
