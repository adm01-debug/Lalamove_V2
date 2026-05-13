# 🤝 Contributing - Lalamove Guardian

## Setup do Ambiente

```bash
# Clone
git clone https://github.com/adm01-debug/lalamove-guardian.git
cd lalamove-guardian

# Supabase CLI
brew install supabase/tap/supabase

# Iniciar local
supabase start

# Instalar deps
npm install

# Rodar dev
npm run dev
```

## Criar Branch

```bash
git checkout -b feature/nova-funcionalidade
```

**Padrão:**
- `feature/` - Nova funcionalidade
- `fix/` - Correção de bug
- `docs/` - Documentação
- `refactor/` - Refatoração
- `test/` - Testes

## Commit

```bash
git commit -m "feat: adiciona avaliação por região"
```

**Conventional Commits:**
- `feat:` - Nova feature
- `fix:` - Bug fix
- `docs:` - Documentação
- `style:` - Formatação
- `refactor:` - Refatoração
- `test:` - Testes
- `chore:` - Manutenção

## Pull Request

1. Push: `git push origin feature/nova-funcionalidade`
2. Criar PR no GitHub
3. Preencher template
4. Aguardar review
5. Merge!

## Estrutura de Código

```
src/
├── components/  # Componentes reutilizáveis
├── hooks/      # Hooks customizados
├── pages/      # Páginas/rotas
├── services/   # Business logic
└── utils/      # Utilitários

supabase/
├── functions/  # Edge functions
└── migrations/ # SQL migrations
```

## Style Guide

### TypeScript
```typescript
// ✅ BOM
interface Driver {
  id: string;
  name: string;
}

// ❌ RUIM
const evaluateDriver = async (id) => {
  // sem tipos
};
```

### React
```tsx
// ✅ BOM
export const DriverCard: React.FC<{ driver: Driver }> = ({ driver }) => {
  return <Card>{driver.name}</Card>;
};
```

## Code Review Checklist

- [ ] TypeScript sem errors
- [ ] ESLint passou
- [ ] Testes adicionados
- [ ] Documentação atualizada
- [ ] Sem console.logs
- [ ] Performance OK

---

**Mantido por:** Tech Team
