import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt, ChevronLeft, ChevronRight, FileSpreadsheet, FileDown } from 'lucide-react';
import { useUapiWalletStatement, UapiError } from '@/hooks/useLalamoveUapi';
import { formatFen, formatUapiTime } from '@/lib/uapiFormat';
import { toAccountingRows, summarizeAccountingRows } from '@/lib/uapiStatement';
import { isUapiSessionMissing } from '@/lib/uapiErrors';
import { UapiSessionRequired } from '@/components/lalamove/UapiSessionRequired';
import { DataErrorBanner } from '@/components/ui/data-error-banner';
import { exportToCSV, exportToExcel } from '@/utils/exportUtils';

/** Etapa 21 — extrato financeiro da carteira Lalamove. */
export function UapiStatementPanel() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, isFetching, refetch } = useUapiWalletStatement(page);

  const rows = data ?? [];
  const accountingRows = useMemo(() => toAccountingRows(rows), [rows]);
  const totals = useMemo(() => summarizeAccountingRows(accountingRows), [accountingRows]);
  const fileBase = `extrato-lalamove-pagina-${page}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4" />
          Extrato da carteira
        </CardTitle>
        <CardDescription>Movimentações financeiras da conta Lalamove (UAPI).</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading && (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {isError && isUapiSessionMissing(error) && (
          <UapiSessionRequired onRetry={() => void refetch()} retrying={isFetching} />
        )}

        {isError && !isUapiSessionMissing(error) && (
          <DataErrorBanner
            message={error instanceof UapiError ? error.message : 'Falha ao carregar o extrato.'}
            details={error instanceof UapiError ? error.hint : undefined}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        )}

        {!isLoading && !isError && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Sem movimentações nesta página.</p>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Extrato da carteira Lalamove</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">Data</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Descrição</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Valor</th>
                  <th scope="col" className="py-2 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.flow_id ?? row.id ?? index} className="border-b border-border/50">
                    <td className="py-2 pr-3 text-muted-foreground">{formatUapiTime(row.create_time)}</td>
                    <td className="py-2 pr-3 text-foreground">{row.remark || '—'}</td>
                    <td className="py-2 pr-3 text-right font-medium text-foreground">
                      {formatFen(row.amount_fen)}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">{formatFen(row.balance_fen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {accountingRows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              {totals.lancamentos} lançamentos · créditos R$ {totals.creditos} · débitos R$ {totals.debitos}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(accountingRows, fileBase)}
              >
                <FileDown className="mr-1 h-4 w-4" />
                CSV contábil
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void exportToExcel(
                    [
                      { name: 'Lançamentos', rows: accountingRows },
                      { name: 'Resumo', rows: [{ ...totals }] },
                    ],
                    fileBase,
                  )
                }
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                Excel
              </Button>
            </div>
          </div>
        )}



        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isFetching}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">Página {page}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={rows.length === 0 || isFetching}
          >
            Próxima
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
