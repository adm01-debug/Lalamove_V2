
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  Share2, 
  MoreHorizontal,
  X
} from 'lucide-react';
import { Order } from '@/types';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface BatchActionsToolbarProps {
  selectedOrders: Order[];
  onClear: () => void;
  onStatusUpdate?: (status: Order['status']) => void;
}

export function BatchActionsToolbar({ selectedOrders, onClear, onStatusUpdate }: BatchActionsToolbarProps) {
  const count = selectedOrders.length;
  if (count === 0) return null;

  const handleWhatsAppBatch = () => {
    const ordersWithContact = selectedOrders.filter(o => o.supplier_contact || o.customerPhone);
    
    if (ordersWithContact.length === 0) {
      toast.error('Nenhum pedido selecionado possui contato de fornecedor/cliente.');
      return;
    }

    toast.info(`Preparando comunicações para ${ordersWithContact.length} contatos...`);
    
    // In a real app, this would open a multi-tab or use a WhatsApp API
    // For this MVP improvement, we'll open the first one and show a list for others
    ordersWithContact.forEach((order, index) => {
      const phone = order.supplier_contact || order.customerPhone;
      const message = `Olá! O motorista ${order.driverName || 'atribuído'} está a caminho para a coleta do pedido ${order.internalOrderId || order.lalamoveId}.`;
      const link = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      
      if (index === 0) {
        window.open(link, '_blank');
      } else {
        // Delay others or use a different approach
        setTimeout(() => {
          if (confirm(`Deseja enviar mensagem para o próximo pedido (${order.internalOrderId || order.lalamoveId})?`)) {
            window.open(link, '_blank');
          }
        }, 500 * index);
      }
    });
  };

  const handleShareTracking = () => {
    const trackingLinks = selectedOrders.map(o => `${o.internalOrderId}: https://track.lalamove.com/${o.lalamoveId}`).join('\n');
    navigator.clipboard.writeText(trackingLinks);
    toast.success('Links de rastreamento copiados para a área de transferência!');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-2xl"
      >
        <div className="bg-card/95 backdrop-blur-xl border border-primary/20 shadow-2xl rounded-2xl p-3 md:p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-lg shrink-0">
              {count}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold">Pedidos Selecionados</p>
              <p className="text-xs text-muted-foreground">Ações em massa disponíveis</p>
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 gap-2 border-primary/20 hover:bg-primary/10"
              onClick={handleWhatsAppBatch}
            >
              <MessageSquare className="w-4 h-4 text-green-500" />
              <span className="hidden xs:inline">WhatsApp</span>
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 gap-2 border-primary/20 hover:bg-primary/10"
              onClick={handleShareTracking}
            >
              <Share2 className="w-4 h-4 text-blue-500" />
              <span className="hidden xs:inline">Links</span>
            </Button>

            <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={onClear}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
