#!/usr/bin/env node

/**
 * Script para deployar Edge Functions no Supabase do cliente.
 * Uso: npx content-hub deploy-functions
 *
 * Requer: Supabase CLI instalado (npx supabase)
 * O usuario deve estar logado no Supabase CLI e linked ao projeto.
 */

import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const FUNCTIONS_DIR = resolve(process.cwd(), 'supabase', 'functions');

function getFunctions() {
  try {
    const entries = readdirSync(FUNCTIONS_DIR);
    return entries.filter((entry) => {
      if (entry.startsWith('_')) return false;
      const fullPath = join(FUNCTIONS_DIR, entry);
      return statSync(fullPath).isDirectory();
    });
  } catch {
    console.error('Diretorio supabase/functions nao encontrado.');
    console.error('Execute este comando na raiz do projeto Content Hub.');
    process.exit(1);
  }
}

async function main() {
  console.log('Content Hub - Deploy Edge Functions');
  console.log('===================================\n');

  const functions = getFunctions();

  if (functions.length === 0) {
    console.log('Nenhuma Edge Function encontrada em supabase/functions/');
    process.exit(0);
  }

  console.log(`Encontradas ${functions.length} funcoes: ${functions.join(', ')}\n`);

  for (const fn of functions) {
    console.log(`Deployando ${fn}...`);
    try {
      execSync(`npx supabase functions deploy ${fn} --no-verify-jwt`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log(`  ${fn} deployada com sucesso.\n`);
    } catch {
      console.error(`  Erro ao deployar ${fn}. Verifique se o Supabase CLI esta configurado.\n`);
    }
  }

  console.log('Deploy concluido.');
}

main();
