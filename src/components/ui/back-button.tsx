import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
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

  // Root paths don't show the back button
  const isRootPath = location.pathname === '/' || location.pathname === '/dashboard';

  const handleBack = () => {
    // If we have history, go back
    if (window.history.length > 2) { // 2 because of the initial entry
      navigate(-1);
    } else {
      // Fallback to dashboard
      navigate('/');
    }
  };

  return (
    <AnimatePresence mode="wait">
      {!isRootPath && (
        <motion.div
          key="back-button"
          initial={{ opacity: 0, scale: 0.8, x: -10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.8, x: -10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex-shrink-0"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={variant}
                size={showLabel ? 'default' : size}
                onClick={handleBack}
                className={cn(
                  "group transition-all duration-300 relative overflow-hidden",
                  variant === 'glass' && "bg-background/20 backdrop-blur-md border-border/30 hover:bg-background/40 hover:border-primary/30",
                  !showLabel && "rounded-xl h-10 w-10",
                  className
                )}
                aria-label="Voltar para a página anterior"
              >
                {/* Hover glow effect */}
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <ArrowLeft className={cn(
                  "w-4 h-4 relative z-10 transition-transform duration-300 group-hover:-translate-x-1",
                  showLabel && "mr-2"
                )} />
                {showLabel && <span className="relative z-10 font-medium">{label}</span>}
              </Button>
            </TooltipTrigger>
            {!showLabel && (
              <TooltipContent side="right" sideOffset={10} className="bg-background/95 backdrop-blur-xl border-border/50 text-xs">
                <p>Voltar para a página anterior</p>
              </TooltipContent>
            )}
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
