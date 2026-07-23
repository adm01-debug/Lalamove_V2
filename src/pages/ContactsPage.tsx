/**
 * Gerenciamento de contatos reutilizáveis.
 * Lista, busca, edita (nome/endereço/tipo) e exclui contatos salvos.
 */
import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { Pencil, Trash2, Users, Search, Loader2 } from 'lucide-react';
import { useContacts, type Contact, type ContactKind } from '@/hooks/useContacts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { maskBrazilianPhone } from '@/lib/phone';

const KIND_LABEL: Record<ContactKind, string> = {
  sender: 'Remetente',
  recipient: 'Destinatário',
  both: 'Ambos',
};

function formatPhoneDisplay(e164: string): string {
  if (!e164.startsWith('+55')) return e164;
  return formatPhoneMasked(e164.slice(3));
}

export default function ContactsPage() {
  const { contacts, isLoading, search, updateContact, deleteContact, isMutating } = useContacts();
  const [term, setTerm] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | ContactKind>('all');
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);

  const list = useMemo(() => {
    const base = term.trim() || kindFilter !== 'all'
      ? search(term, kindFilter === 'all' ? undefined : kindFilter, 500)
      : contacts;
    return base;
  }, [term, kindFilter, search, contacts]);

  return (
    <>
      <Helmet>
        <title>Contatos salvos | Lalamove Intelligence Hub</title>
        <meta name="description" content="Gerencie contatos reutilizáveis para pedidos: edite dados, altere tipo e remova registros." />
      </Helmet>

      <div className="container mx-auto px-4 py-6 space-y-4">
        <header className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Users className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Contatos salvos</h1>
            <p className="text-sm text-muted-foreground">
              {contacts.length} contato{contacts.length === 1 ? '' : 's'} · reutilizados automaticamente em novos pedidos
            </p>
          </div>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Buscar por nome, telefone ou endereço"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="pl-9"
                aria-label="Buscar contatos"
              />
            </div>
            <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as 'all' | ContactKind)}>
              <SelectTrigger aria-label="Filtrar por tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="sender">Remetentes</SelectItem>
                <SelectItem value="recipient">Destinatários</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando contatos…
              </div>
            ) : list.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Nenhum contato encontrado.</p>
                <p className="text-xs mt-1">Contatos são salvos automaticamente ao criar pedidos.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {list.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground truncate">{c.name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {KIND_LABEL[c.kind]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {c.usage_count} uso{c.usage_count === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {formatPhoneDisplay(c.phone_e164)}
                        {c.address ? ` · ${c.address}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(c)}
                        aria-label={`Editar ${c.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(c)}
                        aria-label={`Excluir ${c.name}`}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <EditContactDialog
        contact={editing}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          if (!editing) return;
          try {
            await updateContact({ id: editing.id, ...patch });
            toast.success('Contato atualizado');
            setEditing(null);
          } catch (err) {
            toast.error('Falha ao atualizar', {
              description: err instanceof Error ? err.message : 'Erro desconhecido',
            });
          }
        }}
        busy={isMutating}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `"${deleting.name}" (${formatPhoneDisplay(deleting.phone_e164)}) será removido permanentemente. Esta ação não pode ser desfeita.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                try {
                  await deleteContact(deleting.id);
                  toast.success('Contato removido');
                  setDeleting(null);
                } catch (err) {
                  toast.error('Falha ao remover', {
                    description: err instanceof Error ? err.message : 'Erro desconhecido',
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface EditPatch {
  name: string;
  address: string | null;
  kind: ContactKind;
}

interface EditContactDialogProps {
  contact: Contact | null;
  onClose: () => void;
  onSave: (patch: EditPatch) => Promise<void>;
  busy: boolean;
}

function EditContactDialog({ contact, onClose, onSave, busy }: EditContactDialogProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [kind, setKind] = useState<ContactKind>('both');

  // Sincroniza quando abre com novo contato
  useMemo(() => {
    if (contact) {
      setName(contact.name);
      setAddress(contact.address ?? '');
      setKind(contact.kind);
    }
  }, [contact]);

  const canSave = name.trim().length > 0 && !busy;

  return (
    <Dialog open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar contato</DialogTitle>
          <DialogDescription>
            Telefone não é editável (usado como chave de deduplicação).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="edit-name">Nome</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label htmlFor="edit-phone">Telefone</Label>
            <Input
              id="edit-phone"
              value={contact ? formatPhoneDisplay(contact.phone_e164) : ''}
              disabled
              readOnly
            />
          </div>
          <div>
            <Label htmlFor="edit-address">Endereço</Label>
            <Input
              id="edit-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Opcional"
              maxLength={300}
            />
          </div>
          <div>
            <Label htmlFor="edit-kind">Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ContactKind)}>
              <SelectTrigger id="edit-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sender">Remetente</SelectItem>
                <SelectItem value="recipient">Destinatário</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onSave({
                name: name.trim(),
                address: address.trim() || null,
                kind,
              })
            }
            disabled={!canSave}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
