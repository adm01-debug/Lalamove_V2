/**
 * Gera SQL consolidado para corrigir problemas do Dashboard
 */

import * as fs from 'fs';

const migrationFiles = [
  'supabase/migrations/20260828000002_dashboard_fixes.sql',
];

let fullSQL = '';

for (const file of migrationFiles) {
  fullSQL += fs.readFileSync(file, 'utf-8') + '\n\n';
}

console.log('='.repeat(70));
console.log('SQL PARA APLICAR NO SUPABASE DASHBOARD');
console.log('https://supabase.com/dashboard/project/iecgydonctmabiijadsf/sql');
console.log('='.repeat(70));
console.log('');
console.log(fullSQL);