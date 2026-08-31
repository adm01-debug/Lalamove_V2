import { useState } from 'react';
import { useV3CallMutation } from '@/hooks/useLalamove';
import type { LalamoveApiResponse } from '@/lib/lalamove-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Terminal, Play, Copy, RefreshCw } from 'lucide-react';

export function LalamoveV3Explorer() {
  const v3Mutation = useV3CallMutation();
  const [v3Path, setV3Path] = useState('/v3/cities');
  const [v3Method, setV3Method] = useState('GET');
  const [v3Body, setV3Body] = useState('');
  const [v3Result, setV3Result] = useState<LalamoveApiResponse | null>(null);

  const handleV3Call = async () => {
    try {
      let parsedBody: Record<string, unknown> | undefined;
      if (v3Body.trim() && v3Method !== 'GET') {
        try {
          parsedBody = JSON.parse(v3Body);
        } catch {
          toast.error('Body JSON inválido');
          return;
        }
      }
      const result = await v3Mutation.mutateAsync({
        path: v3Path,
        method: v3Method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        body: parsedBody,
      });
      setV3Result(result);
    } catch {
      toast.error('Erro na chamada V3');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          API V3 Explorer
        </CardTitle>
        <CardDescription>
          Teste endpoints da API V3 diretamente. Os headers de autenticação HMAC são aplicados automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select value={v3Method} onValueChange={setV3Method}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={v3Path}
            onChange={(e) => setV3Path(e.target.value)}
            placeholder="/v3/cities"
            className="font-mono text-sm"
          />
          <Button onClick={handleV3Call} disabled={v3Mutation.isPending}>
            {v3Mutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {v3Method !== 'GET' && (
          <textarea
            value={v3Body}
            onChange={(e) => setV3Body(e.target.value)}
            placeholder='{"key": "value"}'
            className="w-full h-32 font-mono text-sm p-3 rounded-lg border bg-muted/30"
          />
        )}

        {v3Result && (
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(v3Result, null, 2));
                toast.success('Copiado!');
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <pre className="bg-muted/50 rounded-lg p-4 text-xs overflow-x-auto max-h-96 font-mono">
              {JSON.stringify(v3Result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
