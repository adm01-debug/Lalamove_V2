import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Filter, 
  X, 
  ChevronDown, 
  Star, 
  Package, 
  AlertTriangle,
  Car,
  Bike,
  Truck,
  Check,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface DriverFilters {
  riskScoreRange: [number, number];
  ratingRange: [number, number];
  minDeliveries: number;
  maxDeliveries: number | null;
  vehicleTypes: string[];
  hasIncidents: boolean | null;
  isWhitelisted: boolean | null;
  isBlacklisted: boolean | null;
}

interface AdvancedFiltersProps {
  filters: DriverFilters;
  onFiltersChange: (filters: DriverFilters) => void;
  onReset: () => void;
  activeFilterCount: number;
}

const vehicleOptions = [
  { value: 'MOTORCYCLE', label: 'Moto', icon: Bike },
  { value: 'CAR', label: 'Carro', icon: Car },
  { value: 'VAN', label: 'Van', icon: Truck },
  { value: 'TRUCK', label: 'Caminhão', icon: Truck },
];

export const defaultFilters: DriverFilters = {
  riskScoreRange: [0, 10],
  ratingRange: [0, 5],
  minDeliveries: 0,
  maxDeliveries: null,
  vehicleTypes: [],
  hasIncidents: null,
  isWhitelisted: null,
  isBlacklisted: null,
};

export function AdvancedFilters({
  filters,
  onFiltersChange,
  onReset,
  activeFilterCount,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleVehicleToggle = (vehicleType: string) => {
    const newVehicleTypes = filters.vehicleTypes.includes(vehicleType)
      ? filters.vehicleTypes.filter(v => v !== vehicleType)
      : [...filters.vehicleTypes, vehicleType];
    onFiltersChange({ ...filters, vehicleTypes: newVehicleTypes });
  };

  const handleRiskScoreChange = (value: number[]) => {
    onFiltersChange({ ...filters, riskScoreRange: [value[0], value[1]] });
  };

  const handleRatingChange = (value: number[]) => {
    onFiltersChange({ ...filters, ratingRange: [value[0], value[1]] });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button
            variant={activeFilterCount > 0 ? 'gradient' : 'outline'}
            size="sm"
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Filtros Avançados
            {activeFilterCount > 0 && (
              <Badge variant="secondary" size="sm" className="ml-1 bg-background/20">
                {activeFilterCount}
              </Badge>
            )}
            <ChevronDown className={cn(
              "w-4 h-4 transition-transform",
              isOpen && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>
        
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar
          </Button>
        )}
      </div>

      <CollapsibleContent>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card variant="glass" className="mt-3">
                <CardContent className="p-4 space-y-6">
                  {/* Risk Score Range */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning" />
                        Score de Risco
                      </Label>
                      <span className="text-sm text-muted-foreground">
                        {filters.riskScoreRange[0]} - {filters.riskScoreRange[1]}
                      </span>
                    </div>
                    <Slider
                      value={filters.riskScoreRange}
                      onValueChange={handleRiskScoreChange}
                      min={0}
                      max={10}
                      step={0.5}
                      className="py-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Baixo</span>
                      <span>Médio</span>
                      <span>Alto</span>
                    </div>
                  </div>

                  {/* Rating Range */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Star className="w-4 h-4 text-warning fill-warning" />
                        Avaliação
                      </Label>
                      <span className="text-sm text-muted-foreground">
                        {filters.ratingRange[0]} - {filters.ratingRange[1]} ★
                      </span>
                    </div>
                    <Slider
                      value={filters.ratingRange}
                      onValueChange={handleRatingChange}
                      min={0}
                      max={5}
                      step={0.5}
                      className="py-2"
                    />
                  </div>

                  {/* Delivery Count */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Package className="w-4 h-4 text-primary" />
                      Número de Entregas
                    </Label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Mínimo</Label>
                        <Input
                          type="number"
                          min={0}
                          value={filters.minDeliveries}
                          onChange={(e) => onFiltersChange({ 
                            ...filters, 
                            minDeliveries: parseInt(e.target.value) || 0 
                          })}
                          className="mt-1 h-9"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">Máximo</Label>
                        <Input
                          type="number"
                          min={0}
                          value={filters.maxDeliveries ?? ''}
                          onChange={(e) => onFiltersChange({ 
                            ...filters, 
                            maxDeliveries: e.target.value ? parseInt(e.target.value) : null 
                          })}
                          placeholder="Sem limite"
                          className="mt-1 h-9"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Types */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Tipo de Veículo</Label>
                    <div className="flex flex-wrap gap-2">
                      {vehicleOptions.map((vehicle) => {
                        const isSelected = filters.vehicleTypes.includes(vehicle.value);
                        const Icon = vehicle.icon;
                        return (
                          <Button
                            key={vehicle.value}
                            variant={isSelected ? 'gradient' : 'outline'}
                            size="sm"
                            onClick={() => handleVehicleToggle(vehicle.value)}
                            className="gap-2"
                          >
                            <Icon className="w-4 h-4" />
                            {vehicle.label}
                            {isSelected && <Check className="w-3 h-3" />}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Boolean Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                      <Label className="text-sm cursor-pointer">Com Incidentes</Label>
                      <Switch
                        checked={filters.hasIncidents === true}
                        onCheckedChange={(checked) => onFiltersChange({ 
                          ...filters, 
                          hasIncidents: checked ? true : null 
                        })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/20">
                      <Label className="text-sm cursor-pointer text-success">Whitelist</Label>
                      <Switch
                        checked={filters.isWhitelisted === true}
                        onCheckedChange={(checked) => onFiltersChange({ 
                          ...filters, 
                          isWhitelisted: checked ? true : null 
                        })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                      <Label className="text-sm cursor-pointer text-destructive">Blacklist</Label>
                      <Switch
                        checked={filters.isBlacklisted === true}
                        onCheckedChange={(checked) => onFiltersChange({ 
                          ...filters, 
                          isBlacklisted: checked ? true : null 
                        })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function getActiveFilterCount(filters: DriverFilters): number {
  let count = 0;
  
  if (filters.riskScoreRange[0] > 0 || filters.riskScoreRange[1] < 10) count++;
  if (filters.ratingRange[0] > 0 || filters.ratingRange[1] < 5) count++;
  if (filters.minDeliveries > 0) count++;
  if (filters.maxDeliveries !== null) count++;
  if (filters.vehicleTypes.length > 0) count++;
  if (filters.hasIncidents !== null) count++;
  if (filters.isWhitelisted !== null) count++;
  if (filters.isBlacklisted !== null) count++;
  
  return count;
}
