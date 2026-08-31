import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, HelpCircle, X } from 'lucide-react';
import { EXTENDED_SEARCH_HELP } from '@/hooks/useFuseSearch';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchInputWithHelpProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function SearchInputWithHelp({
  value,
  onChange,
  placeholder = 'Buscar...',
  className,
  inputClassName,
}: SearchInputWithHelpProps) {
  const { t } = useTranslation();
  const [showHelp, setShowHelp] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          className={cn('pl-9 pr-9', inputClassName)}
        />
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors',
            showHelp && 'text-primary'
          )}
        >
          {showHelp ? <X className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
        </button>
      </div>

      <AnimatePresence>
        {(showHelp || (isFocused && !value)) && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full left-0 right-0 mt-2 p-4 bg-popover border border-border rounded-lg shadow-lg"
          >
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  {t('search.advancedOperators', 'Operadores de Busca Avançada')}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {EXTENDED_SEARCH_HELP.operators.map((op) => (
                    <div
                      key={op.symbol}
                      className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <Badge variant="outline" className="font-mono text-xs px-1.5">
                        {op.symbol}
                      </Badge>
                      <div className="text-xs">
                        <span className="text-foreground font-medium">{op.name}</span>
                        <p className="text-muted-foreground">{op.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">
                  {t('search.examples', 'Exemplos')}
                </h4>
                <div className="space-y-1.5">
                  {EXTENDED_SEARCH_HELP.examples.slice(0, 4).map((ex, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        onChange(ex.query);
                        setShowHelp(false);
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left group"
                    >
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-primary group-hover:bg-primary/10">
                        {ex.query}
                      </code>
                      <span className="text-xs text-muted-foreground flex-1">
                        {ex.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  💡 {t('search.tip', 'Dica: Combine operadores para buscas mais precisas')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Compact version for smaller spaces
export function SearchHelpBadges({ onInsert }: { onInsert?: (query: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {EXTENDED_SEARCH_HELP.operators.map((op) => (
        <Badge
          key={op.symbol}
          variant="outline"
          className="font-mono text-xs cursor-help"
          title={`${op.name}: ${op.description} (ex: ${op.example})`}
          onClick={() => onInsert?.(op.example)}
        >
          {op.symbol}
        </Badge>
      ))}
    </div>
  );
}
