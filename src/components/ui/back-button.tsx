import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface BackButtonProps {
  className?: string;
  variant?: 'ghost' | 'outline' | 'secondary' | 'glass';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  label?: string;
  showLabel?: boolean;
}

export function BackButton({ 
  className, 
  variant = 'glass', 
  size = 'icon', 
  label = 'Voltar',
  showLabel = false 
}: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on root paths
  if (location.pathname === '/' || location.pathname === '/dashboard') {
    return null;
  }

  const handleBack = () => {
    // If we have history, go back
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Fallback to dashboard
      navigate('/');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={showLabel ? 'default' : size}
            onClick={handleBack}
            className={cn(
              "group transition-all duration-200",
              !showLabel && "rounded-xl",
              className
            )}
            aria-label="Voltar para a página anterior"
          >
            <ArrowLeft className={cn(
              "w-4 h-4 transition-transform group-hover:-translate-x-1",
              showLabel && "mr-2"
            )} />
            {showLabel && <span>{label}</span>}
          </Button>
        </TooltipTrigger>
        {!showLabel && (
          <TooltipContent side="right">
            <p>Voltar para a página anterior</p>
          </TooltipContent>
        )}
      </Tooltip>
    </motion.div>
  );
}
