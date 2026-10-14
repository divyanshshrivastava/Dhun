// Pre-commit and pre-push repository hygiene scanner
// Enforces Section C local-only rules, 5MB file size limit, and secret detection

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Patterns that MUST NEVER be tracked in Git
const FORBIDDEN_FILE_PATTERNS = [
  /^PROGRESS_REPORT\.md$/i,
  /^IMPLEMENTATION_PLAN\.md$/i,
  /^DEPLOYMENT_CHECKLIST\.md$/i,
  /^\.env(\..+)?$/i, // Matches .env, .env.local, .env.production, etc. EXCEPT .env.example
  /^audio-masters\//i,
  /^storage\//i,
  /^raw-audio\//i,
  /\.(wav|mp3|m4a|flac|aac|opus|ogg|raw)$/i,
  /\.log$/i,
  /\.DS_Store$/i,
  /Thumbs\.db$/i,
  /\.pglite\//i,
  /node_modules\//i,
  /^\.next\//i,
  /^coverage\//i,
  /^test-results\//i,
  /^playwright-report\//i,
  /lighthouse.*\.report\.(json|html)$/i,
];

// Regex patterns indicating leaked credentials or private keys
const SECRET_REGEX_PATTERNS = [
  { name: 'Private Key', regex: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: 'AWS Access Key ID', regex: /AKIA[0-9A-Z]{16}/ },
  {
    name: 'Real PostgreSQL Password URI',
    regex: /postgresql:\/\/(?!postgres:postgres|user:pass|neondb_owner:npg_password)[a-zA-Z0-9_-]+:[^@\s]{6,}@[a-zA-Z0-9.-]+/,
  },
];

function getTrackedFiles(): string[] {
  const output = execSync('git ls-files', { encoding: 'utf-8' });
  return output
    .split(/\r?\n/)
    .map(f => f.trim())
    .filter(Boolean);
}

function loadLocalEnvValues(): string[] {
  const envFiles = ['.env', '.env.local', '.env.production.local'];
  const secrets: string[] = [];

  for (const file of envFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).replace(/^['"]|['"]$/g, '').trim();
          // Only inspect variables whose name designates a secret/credential
          const isSecretKey = /(SECRET|TOKEN|KEY|PASS|CREDENTIAL|AUTH)/i.test(key) && !/(_ID|_NAME)$/i.test(key);
          if (
            isSecretKey &&
            val.length >= 16 &&
            !val.includes('localhost') &&
            !val.includes('neon.tech') &&
            !val.includes('replace_with') &&
            !val.includes('dhun_')
          ) {
            secrets.push(val);
          }
        }
      }
    }
  }

  return Array.from(new Set(secrets));
}

export function runRepoHygieneCheck(): { passed: boolean; violations: string[] } {
  const violations: string[] = [];
  const trackedFiles = getTrackedFiles();
  const localSecretValues = loadLocalEnvValues();

  console.log(`[Hygiene Check] Inspecting ${trackedFiles.length} tracked files...`);

  for (const file of trackedFiles) {
    // 1. Check forbidden file patterns
    for (const pattern of FORBIDDEN_FILE_PATTERNS) {
      if (file === '.env.example') continue; // Explicitly allowed
      if (pattern.test(file)) {
        violations.push(`[FORBIDDEN FILE] Tracked file "${file}" matches forbidden pattern: ${pattern}`);
      }
    }

    // Check physical file if it exists
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    const stats = fs.statSync(fullPath);

    // 2. Check 5 MB file size limit
    if (stats.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
      violations.push(`[LARGE FILE] Tracked file "${file}" exceeds 5MB limit (${sizeMb} MB)`);
    }

    // 3. Check for secrets inside text files (skip lockfile for hash checks)
    if (file === 'package-lock.json') continue;

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Check regex secret patterns
      for (const { name, regex } of SECRET_REGEX_PATTERNS) {
        if (regex.test(content)) {
          violations.push(`[SECRET PATTERN] Tracked file "${file}" contains potential secret (${name})`);
        }
      }

      // Check if any real secret from local .env files is present in tracked files
      for (const secretVal of localSecretValues) {
        if (content.includes(secretVal)) {
          violations.push(`[LEAKED LOCAL SECRET] Tracked file "${file}" contains a secret value defined in your local .env file!`);
        }
      }
    } catch {
      // Non-text file or read error
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

if (process.argv[1] && process.argv[1].includes('check_repo_hygiene')) {
  const result = runRepoHygieneCheck();
  if (result.passed) {
    console.log('✓ [Repo Hygiene] All tracked files passed hygiene inspection. 0 leaks, 0 oversize files, 0 forbidden files.');
    process.exit(0);
  } else {
    console.error('\n❌ [Repo Hygiene Violation] The following issues must be resolved before committing:');
    for (const v of result.violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }
}
