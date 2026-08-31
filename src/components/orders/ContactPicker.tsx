/**
 * Combobox de busca de contatos reutilizáveis.
 * Exibe sugestões por nome/telefone/endereço e devolve o contato selecionado
 * ao consumidor, que decide quais campos preencher.
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, User, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { useContacts, type Contact, type ContactKind } from '@/hooks/useContacts';
import { maskBrazilianPhone } from '@/lib/phone';

interface ContactPickerProps {
  kind: ContactKind;
  onSelect: (contact: Contact) => void;
  label?: string;
}

export function ContactPicker({ kind, onSelect, label }: ContactPickerProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const { search, contacts, isLoading } = useContacts();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = useMemo(() => search(term, kind), [search, term, kind]);
  const totalForKind = useMemo(
    () => contacts.filter(c => c.kind === kind || c.kind === 'both').length,
    [contacts, kind],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          disabled={isLoading || totalForKind === 0}
          aria-label={label ?? 'Buscar contato salvo'}
        >
          <Search className="h-3 w-3" aria-hidden="true" />
          {label ?? 'Buscar contato'}
          {totalForKind > 0 && (
            <span className="text-muted-foreground">({totalForKind})</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              value={term}
              onChange={e => setTerm(e.target.value)}
              placeholder="Nome, telefone ou endereço…"
              className="flex h-9 w-full bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Buscar contato"
            />
          </div>
          <CommandList>
            {results.length === 0 ? (
              <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
            ) : (
              <CommandGroup heading={`Mais recentes (${results.length})`}>
                {results.map(contact => (
                  <CommandItem
                    key={contact.id}
                    value={contact.id}
                    onSelect={() => {
                      onSelect(contact);
                      setOpen(false);
                      setTerm('');
                    }}
                    className="flex-col items-start gap-1"
                  >
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <User className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                      {contact.name}
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {contact.usage_count}× uso
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" aria-hidden="true" />
                      {maskBrazilianPhone(contact.phone_e164.replace(/^\+55/, ''))}
                    </div>
                    {contact.address && (
                      <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="line-clamp-1">{contact.address}</span>
                      </div>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
