import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';

export function CoordinateInput({
  coords, onChange, onAdd, onRemove, min = 2, max = 12, labels,
}: {
  coords: [number, number][];
  onChange: (idx: number, val: [number, number]) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  min?: number;
  max?: number;
  labels?: string[];
}) {
  return (
    <div className="space-y-2">
      {coords.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <Badge variant="outline" className="w-8 text-center shrink-0">
            {labels?.[i] ?? String.fromCharCode(65 + i)}
          </Badge>
          <Input placeholder="Latitude" type="number" step="any" value={c[1] || ''} onChange={(e) => onChange(i, [c[0], parseFloat(e.target.value) || 0])} className="w-28 font-mono text-xs" />
          <Input placeholder="Longitude" type="number" step="any" value={c[0] || ''} onChange={(e) => onChange(i, [parseFloat(e.target.value) || 0, c[1]])} className="w-28 font-mono text-xs" />
          {coords.length > min && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onRemove(i)}>
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          )}
        </div>
      ))}
      {coords.length < max && (
        <Button variant="outline" size="sm" className="gap-1" onClick={onAdd}>
          <Plus className="w-3.5 h-3.5" /> Adicionar ponto
        </Button>
      )}
    </div>
  );
}
