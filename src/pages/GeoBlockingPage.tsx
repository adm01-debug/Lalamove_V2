import { useState, useMemo } from "react";
import { useFuseSearchWithMatches } from '@/hooks/useFuseSearch';
import { HighlightText } from '@/components/ui/highlight-match';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInputWithHelp } from '@/components/ui/search-help-tooltip';
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Globe, 
  Search, 
  Plus, 
  Trash2, 
  Shield, 
  ShieldCheck,
  ShieldX,
  MapPin,
  CheckCircle2,
  XCircle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Lista de países com códigos ISO
const COUNTRIES = [
  { code: "BR", name: "Brasil", flag: "🇧🇷" },
  { code: "US", name: "Estados Unidos", flag: "🇺🇸" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "ES", name: "Espanha", flag: "🇪🇸" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "CO", name: "Colômbia", flag: "🇨🇴" },
  { code: "MX", name: "México", flag: "🇲🇽" },
  { code: "PE", name: "Peru", flag: "🇵🇪" },
  { code: "UY", name: "Uruguai", flag: "🇺🇾" },
  { code: "PY", name: "Paraguai", flag: "🇵🇾" },
  { code: "BO", name: "Bolívia", flag: "🇧🇴" },
  { code: "EC", name: "Equador", flag: "🇪🇨" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪" },
  { code: "CA", name: "Canadá", flag: "🇨🇦" },
  { code: "GB", name: "Reino Unido", flag: "🇬🇧" },
  { code: "DE", name: "Alemanha", flag: "🇩🇪" },
  { code: "FR", name: "França", flag: "🇫🇷" },
  { code: "IT", name: "Itália", flag: "🇮🇹" },
  { code: "JP", name: "Japão", flag: "🇯🇵" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "IN", name: "Índia", flag: "🇮🇳" },
  { code: "AU", name: "Austrália", flag: "🇦🇺" },
  { code: "NZ", name: "Nova Zelândia", flag: "🇳🇿" },
  { code: "ZA", name: "África do Sul", flag: "🇿🇦" },
];

const getCountryInfo = (code: string) => {
  return COUNTRIES.find(c => c.code === code) || { code, name: code, flag: "🏳️" };
};

export function GeoBlockingPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("");
  const queryClient = useQueryClient();

  // Buscar países na whitelist (is_blocked = false significa que está permitido)
  const { data: allowedCountries = [], isLoading } = useQuery({
    queryKey: ["geo-whitelist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("geo_blocks")
        .select("*")
        .eq("is_blocked", false)
        .order("country_name", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Adicionar país à whitelist
  const addCountryMutation = useMutation({
    mutationFn: async (countryCode: string) => {
      const countryInfo = getCountryInfo(countryCode);
      
      // Verificar se já existe
      const { data: existing } = await supabase
        .from("geo_blocks")
        .select("id")
        .eq("country_code", countryCode)
        .maybeSingle();

      if (existing) {
        // Atualizar para permitido
        const { error } = await supabase
          .from("geo_blocks")
          .update({ is_blocked: false, reason: "Permitido via whitelist" })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Inserir novo
        const { error } = await supabase
          .from("geo_blocks")
          .insert({
            country_code: countryCode,
            country_name: countryInfo.name,
            is_blocked: false,
            block_type: "whitelist",
            reason: "Permitido via whitelist",
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geo-whitelist"] });
      toast.success("País adicionado à whitelist");
      setIsAddDialogOpen(false);
      setSelectedCountry("");
    },
    onError: (error) => {
      toast.error("Erro ao adicionar país: " + error.message);
    },
  });

  // Remover país da whitelist
  const removeCountryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("geo_blocks")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geo-whitelist"] });
      toast.success("País removido da whitelist");
    },
    onError: (error) => {
      toast.error("Erro ao remover país: " + error.message);
    },
  });

  // Fuzzy search with Fuse.js - with match highlighting
  const countrySearchKeys = useMemo(() => ['country_name', 'country_code'], []);
  const countrySearchResults = useFuseSearchWithMatches(allowedCountries, countrySearchKeys, searchTerm);
  const filteredCountries = searchTerm.trim() 
    ? countrySearchResults.map(r => ({ ...r.item, _matches: r.matches }))
    : allowedCountries;

  // Países disponíveis para adicionar
  const availableCountries = COUNTRIES.filter(
    (c) => !allowedCountries.some((ac) => ac.country_code === c.code)
  );

  const stats = {
    allowed: allowedCountries.length,
    blocked: COUNTRIES.length - allowedCountries.length,
    total: COUNTRIES.length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Globe className="h-8 w-8 text-primary" />
            Bloqueio Geográfico
          </h2>
          <p className="text-muted-foreground mt-1">
            Gerencie a whitelist de países permitidos para acesso ao sistema
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar País
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar País à Whitelist</DialogTitle>
              <DialogDescription>
                Selecione um país para permitir o acesso ao sistema
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>País</Label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione um país" />
                </SelectTrigger>
                <SelectContent>
                  {availableCountries.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      <span className="flex items-center gap-2">
                        <span>{country.flag}</span>
                        <span>{country.name}</span>
                        <span className="text-muted-foreground">({country.code})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => addCountryMutation.mutate(selectedCountry)}
                disabled={!selectedCountry || addCountryMutation.isPending}
              >
                {addCountryMutation.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Países Permitidos</CardTitle>
            <ShieldCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.allowed}</div>
            <p className="text-xs text-muted-foreground">
              Na whitelist global
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Países Bloqueados</CardTitle>
            <ShieldX className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.blocked}</div>
            <p className="text-xs text-muted-foreground">
              Sem acesso ao sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Modo de Proteção</CardTitle>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Whitelist</div>
            <p className="text-xs text-muted-foreground">
              Apenas países listados têm acesso
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-4 pt-6">
          <div className="rounded-full bg-primary/10 p-3">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Modo Whitelist Ativo</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Apenas usuários de países na whitelist podem acessar o sistema. 
              Todos os outros países são automaticamente bloqueados. 
              Esta configuração é aplicada globalmente a todos os usuários.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Countries List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Países Permitidos</CardTitle>
              <CardDescription>
                Lista de países com acesso permitido ao sistema
              </CardDescription>
            </div>
            <div className="w-full md:w-64">
              <SearchInputWithHelp
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Buscar país..."
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : filteredCountries.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg">Nenhum país na whitelist</h3>
              <p className="text-muted-foreground mt-1">
                {searchTerm
                  ? "Nenhum país encontrado com esse termo"
                  : "Adicione países para permitir o acesso ao sistema"}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredCountries.map((country) => {
                const info = getCountryInfo(country.country_code);
                return (
                  <div
                    key={country.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{info.flag}</span>
                      <div>
                        <p className="font-medium">{country.country_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {country.country_code}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-success border-success">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Permitido
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover país da whitelist?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Usuários de {country.country_name} ({info.flag}) não poderão mais acessar o sistema.
                              Esta ação pode ser desfeita adicionando o país novamente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeCountryMutation.mutate(country.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Add Common Countries */}
      {availableCountries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adicionar Rapidamente</CardTitle>
            <CardDescription>
              Clique em um país para adicioná-lo à whitelist
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {availableCountries.slice(0, 10).map((country) => (
                <Button
                  key={country.code}
                  variant="outline"
                  size="sm"
                  onClick={() => addCountryMutation.mutate(country.code)}
                  disabled={addCountryMutation.isPending}
                  className="gap-2"
                >
                  <span>{country.flag}</span>
                  <span>{country.name}</span>
                </Button>
              ))}
              {availableCountries.length > 10 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  +{availableCountries.length - 10} mais
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default GeoBlockingPage;
