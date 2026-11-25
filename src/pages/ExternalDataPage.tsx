import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QueryState } from '@/components/ui/query-state';
import { DataErrorBanner } from '@/components/ui/data-error-banner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Building2,
  Users,
  Truck,
  Contact,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  Database,
  Warehouse,
} from 'lucide-react';
import {
  useExternalList,
  useExternalStats,
  TABLE_LABELS,
  type ExternalTable,
  type ExternalRecord,
} from '@/hooks/useExternalData';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const TABLE_ICONS: Record<ExternalTable, React.ReactNode> = {
  companies: <Building2 className="w-4 h-4" />,
  customers: <Users className="w-4 h-4" />,
  suppliers: <ShoppingBag className="w-4 h-4" />,
  carriers: <Truck className="w-4 h-4" />,
  contacts: <Contact className="w-4 h-4" />,
  supplier_branches: <Warehouse className="w-4 h-4" />,
};

const PAGE_SIZE = 25;

export default function ExternalDataPage() {
  const [activeTable, setActiveTable] = useState<ExternalTable>('companies');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 400);

  const { data: stats, isLoading: statsLoading, isError: statsFailed, refetch: refetchStats } = useExternalStats();
  const { data: listData, isLoading: listLoading, isError: listFailed, error: listError, refetch: refetchList } = useExternalList(
    activeTable,
    debouncedSearch || undefined,
    page,
    PAGE_SIZE
  );

  const totalPages = listData?.count ? Math.ceil(listData.count / PAGE_SIZE) : 0;

  const handleTableChange = (table: string) => {
    setActiveTable(table as ExternalTable);
    setPage(1);
    setSearch('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Database className="w-6 h-6 text-primary" />
          Base de Dados CRM
        </h2>
        <p className="text-muted-foreground mt-1">
          Consulte empresas, clientes, fornecedores, filiais, transportadoras e contatos
        </p>
      </div>

      {statsFailed && (
        <DataErrorBanner
          message="Não foi possível carregar as contagens da base. Os totais abaixo podem aparecer vazios."
          onRetry={() => refetchStats()}
        />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {(Object.keys(TABLE_LABELS) as ExternalTable[]).map((table) => (
          <Card
            key={table}
            className={`cursor-pointer transition-all hover:border-primary/50 ${
              activeTable === table ? 'border-primary bg-primary/5' : ''
            }`}
            onClick={() => handleTableChange(table)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {TABLE_ICONS[table]}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{TABLE_LABELS[table]}</p>
                <p className="text-lg font-semibold text-foreground">
                  {statsLoading ? (
                    <Skeleton className="h-6 w-16" />
                  ) : (
                    stats?.counts?.[table]?.toLocaleString('pt-BR') ?? '—'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Content */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              {TABLE_ICONS[activeTable]}
              {TABLE_LABELS[activeTable]}
              {listData?.count != null && (
                <Badge variant="secondary" className="ml-2">
                  {listData.count.toLocaleString('pt-BR')} registros
                </Badge>
              )}
            </CardTitle>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou endereço..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {listFailed ? (
            <QueryState isError error={listError} onRetry={refetchList} />
          ) : listLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !listData?.data?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum registro encontrado</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listData.data.map((record: ExternalRecord) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {record.name || '—'}
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {record.address || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {[record.city, record.state].filter(Boolean).join(' / ') || '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {record.phone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {record.phone}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[180px] truncate">
                          {record.email ? (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              {record.email}
                            </span>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {page} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
