/**
 * Aplica correções via Edge Function deploy + invoke
 * Usa o Supabase CLI para fazer deploy
 */

import { execSync } from 'child_process';

console.log('🚀 Fazendo deploy da Edge Function exec-sql...');

try {
  // Faz deploy da função
  const output = execSync('npx supabase functions deploy exec-sql --project-ref iecgydonctmabiijadsf --no-verify-jwt 2>&1', {
    cwd: 'd:\\Projetos\\Lalamove_V2-main',
    encoding: 'utf-8'
  });
  console.log(output);
} catch (err: any) {
  console.error('Erro:', err.message);
}