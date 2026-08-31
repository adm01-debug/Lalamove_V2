import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./card";

interface HoverPreviewProps {
  trigger: React.ReactNode;
  preview: React.ReactNode;
  className?: string;
  previewClassName?: string;
  delay?: number;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

export function HoverPreview({
  trigger,
  preview,
  className,
  previewClassName,
  delay = 300,
  side = "top",
  align = "center",
}: HoverPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsOpen(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsOpen(false);
  };

  const getPositionClasses = () => {
    const positions = {
      top: "bottom-full mb-2",
      bottom: "top-full mt-2",
      left: "right-full mr-2",
      right: "left-full ml-2",
    };

    const alignments = {
      start: side === "top" || side === "bottom" ? "left-0" : "top-0",
      center: side === "top" || side === "bottom" ? "left-1/2 -translate-x-1/2" : "top-1/2 -translate-y-1/2",
      end: side === "top" || side === "bottom" ? "right-0" : "bottom-0",
    };

    return cn(positions[side], alignments[align]);
  };

  const getAnimationProps = () => {
    const animations = {
      top: { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } },
      bottom: { initial: { opacity: 0, y: -10 }, animate: { opacity: 1, y: 0 } },
      left: { initial: { opacity: 0, x: 10 }, animate: { opacity: 1, x: 0 } },
      right: { initial: { opacity: 0, x: -10 }, animate: { opacity: 1, x: 0 } },
    };
    return animations[side];
  };

  return (
    <div
      className={cn("relative inline-block", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {trigger}
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={cn(
              "absolute z-50 pointer-events-none",
              getPositionClasses()
            )}
            {...getAnimationProps()}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Card
              className={cn(
                "p-4 shadow-xl border bg-popover/95 backdrop-blur-xl",
                "min-w-[200px] max-w-[400px]",
                previewClassName
              )}
            >
              {preview}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Preview para dados de entidade
interface EntityPreviewData {
  title: string;
  subtitle?: string;
  image?: string;
  fields: { label: string; value: string | number }[];
  status?: { label: string; variant: "success" | "warning" | "destructive" | "default" };
}

export function EntityPreview({ data }: { data: EntityPreviewData }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        {data.image ? (
          <img
            src={data.image}
            alt={data.title}
            className="w-12 h-12 rounded-xl object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <span className="text-lg font-bold text-primary">
              {data.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div>
          <h4 className="font-semibold text-foreground">{data.title}</h4>
          {data.subtitle && (
            <p className="text-sm text-muted-foreground">{data.subtitle}</p>
          )}
        </div>
      </div>

      {/* Status badge */}
      {data.status && (
        <div className={cn(
          "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
          {
            "bg-success/10 text-success": data.status.variant === "success",
            "bg-warning/10 text-warning": data.status.variant === "warning",
            "bg-destructive/10 text-destructive": data.status.variant === "destructive",
            "bg-muted text-muted-foreground": data.status.variant === "default",
          }
        )}>
          {data.status.label}
        </div>
      )}

      {/* Fields */}
      <div className="space-y-1.5">
        {data.fields.map((field, index) => (
          <div key={index} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{field.label}</span>
            <span className="font-medium text-foreground">{field.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Preview para orders
interface OrderPreviewProps {
  orderId: string;
  customer: string;
  status: string;
  amount: number;
  items: number;
  estimatedDelivery: string;
}

export function OrderPreview({ 
  orderId, 
  customer, 
  status, 
  amount, 
  items, 
  estimatedDelivery 
}: OrderPreviewProps) {
  return (
    <EntityPreview
      data={{
        title: `Pedido #${orderId}`,
        subtitle: customer,
        status: {
          label: status,
          variant: status === "Entregue" ? "success" : status === "Em trânsito" ? "warning" : "default",
        },
        fields: [
          { label: "Valor", value: `R$ ${amount.toFixed(2)}` },
          { label: "Itens", value: items },
          { label: "Previsão", value: estimatedDelivery },
        ],
      }}
    />
  );
}

// Preview para drivers
interface DriverPreviewProps {
  name: string;
  photo?: string;
  rating: number;
  deliveries: number;
  status: string;
  vehicle: string;
}

export function DriverPreview({
  name,
  photo,
  rating,
  deliveries,
  status,
  vehicle,
}: DriverPreviewProps) {
  return (
    <EntityPreview
      data={{
        title: name,
        subtitle: vehicle,
        image: photo,
        status: {
          label: status,
          variant: status === "Disponível" ? "success" : status === "Em entrega" ? "warning" : "default",
        },
        fields: [
          { label: "Avaliação", value: `${rating.toFixed(1)} ★` },
          { label: "Entregas", value: deliveries },
        ],
      }}
    />
  );
}
