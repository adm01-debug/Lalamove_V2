import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldX, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient opacity-50" />
      <div className="absolute inset-0 noise" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="glass-card">
          <CardHeader className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="mx-auto p-4 rounded-full bg-destructive/10 w-fit mb-4"
            >
              <ShieldX className="h-12 w-12 text-destructive" />
            </motion.div>
            <CardTitle className="text-2xl">Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
              Entre em contato com um administrador se acredita que isso é um erro.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Link to="/">
                <Button className="w-full">
                  <Home className="mr-2 h-4 w-4" />
                  Ir para Dashboard
                </Button>
              </Link>
              <Button variant="outline" onClick={() => window.history.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
