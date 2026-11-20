import crypto from 'node:crypto';
import {
  calculateRepositoryHealthScore,
  type FindingCategory,
  type FindingSeverity,
  type RepoSignalsInput,
  type ScoreBreakdown,
} from '../scoring.ts';

export interface ScannableFile {
  path: string;
  content: string;
}

export interface DetectedFinding {
  fingerprint: string;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: 'confirmed' | 'potential';
  scannerEngine:
    | 'secret-scanner'
    | 'static-ast'
    | 'osv-audit'
    | 'complexity-analyzer'
    | 'architecture-analyzer';
  ruleId: string;
  title: string;
  description: string;
  whyItMatters: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  codeExcerpt: string;
  metadata?: Record<string, unknown>;
}

export interface DependencyRecord {
  name: string;
  version: string;
  ecosystem: 'npm' | 'PyPI' | 'Go';
  scope: 'runtime' | 'dev';
  filePath: string;
  license?: string;
  vulnerabilities: Array<{
    id: string;
    summary: string;
    severity: FindingSeverity;
    fixedVersion?: string;
  }>;
  outdatedHint?: string;
}

export interface ArchitectureGraph {
  nodes: Array<{
    id: string;
    label: string;
    directory: string;
    language: string;
    linesOfCode: number;
    isEntryPoint: boolean;
    inDegree: number;
    outDegree: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
  }>;
  circularDependencies: string[][];
  entryPoints: string[];
  directories: Array<{ name: string; fileCount: number }>;
}

export interface ScanExecutionResult {
  findings: DetectedFinding[];
  dependencies: DependencyRecord[];
  architecture: ArchitectureGraph;
  scoreBreakdown: ScoreBreakdown;
  languages: Record<string, number>;
  filesAnalyzed: number;
  skippedChecks: string[];
}

export type ScanType = 'full' | 'security' | 'quality' | 'dependency' | 'architecture' | 'custom';

export interface ScanOptions {
  scanType: ScanType;
  enabledAnalyzers?: string[];
  osvLookup?: (deps: Array<{ name: string; version: string; ecosystem: string }>) => Promise<{
    results: Record<string, Array<{ id: string; summary: string; severity: FindingSeverity; fixedVersion?: string }>>;
    skippedReason?: string;
  }>;
}

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.rb',
  '.php',
  '.yml',
  '.yaml',
  '.json',
  '.env',
  '.sql',
  '.sh',
]);

function getExtension(filePath: string): string {
  const idx = filePath.lastIndexOf('.');
  return idx >= 0 ? filePath.slice(idx).toLowerCase() : '';
}

function detectLanguage(filePath: string): string {
  const ext = getExtension(filePath);
  if (ext === '.ts' || ext === '.tsx') return 'TypeScript';
  if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') return 'JavaScript';
  if (ext === '.py') return 'Python';
  if (ext === '.go') return 'Go';
  if (ext === '.rs') return 'Rust';
  if (ext === '.java') return 'Java';
  if (ext === '.rb') return 'Ruby';
  if (ext === '.sql') return 'SQL';
  if (ext === '.json' || ext === '.yml' || ext === '.yaml') return 'Config';
  return 'Other';
}

function makeFingerprint(ruleId: string, filePath: string, lineStart: number, excerpt: string): string {
  return crypto
    .createHash('sha256')
    .update(`${ruleId}|${filePath}|${lineStart}|${excerpt.trim().slice(0, 120)}`)
    .digest('hex')
    .slice(0, 24);
}

function extractExcerpt(lines: string[], lineIdx: number, radius = 2): string {
  const start = Math.max(0, lineIdx - radius);
  const end = Math.min(lines.length, lineIdx + radius + 1);
  return lines
    .slice(start, end)
    .map((l, idx) => `${start + idx + 1}: ${l}`)
    .join('\n');
}

interface PatternRule {
  ruleId: string;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: 'confirmed' | 'potential';
  scannerEngine: DetectedFinding['scannerEngine'];
  regex: RegExp;
  languages?: string[];
  ignoreTests?: boolean;
  description: string;
  whyItMatters: string;
  redactMatch?: boolean;
}

const SECURITY_AND_QUALITY_RULES: PatternRule[] = [
  {
    ruleId: 'SEC-AWS-KEY',
    title: 'Hardcoded AWS Access Key ID detected',
    category: 'security',
    severity: 'critical',
    confidence: 'confirmed',
    scannerEngine: 'secret-scanner',
    regex: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/,
    description: 'An AWS access key identifier is committed directly in source code.',
    whyItMatters: 'Exposed cloud credentials allow unauthorized access to cloud infrastructure and data.',
    redactMatch: true,
  },
  {
    ruleId: 'SEC-GITHUB-TOKEN',
    title: 'Hardcoded GitHub Personal Access Token detected',
    category: 'security',
    severity: 'critical',
    confidence: 'confirmed',
    scannerEngine: 'secret-scanner',
    regex: /\b(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})\b/,
    description: 'A GitHub authentication token was found in repository source.',
    whyItMatters: 'Anyone with read access to the repository can impersonate the token owner.',
    redactMatch: true,
  },
  {
    ruleId: 'SEC-PRIVATE-KEY',
    title: 'Private cryptographic key committed to repository',
    category: 'security',
    severity: 'critical',
    confidence: 'confirmed',
    scannerEngine: 'secret-scanner',
    regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
    description: 'A PEM-encoded private key header is present in tracked source files.',
    whyItMatters: 'Private keys must never be stored in version control as they compromise TLS, SSH, or token signing.',
    redactMatch: true,
  },
  {
    ruleId: 'SEC-HARDCODED-SECRET',
    title: 'Hardcoded secret or API credential assignment',
    category: 'security',
    severity: 'high',
    confidence: 'potential',
    scannerEngine: 'secret-scanner',
    regex: /(?:api_key|apiKey|jwt_secret|jwtSecret|db_password|dbPassword|client_secret|secret_key)\s*[:=]\s*['"`][A-Za-z0-9_\-./+=]{12,}['"`]/,
    ignoreTests: true,
    description: 'A credential-like variable is assigned a static string literal instead of reading from environment secrets.',
    whyItMatters: 'Hardcoded secrets remain in git history and are shared across environments.',
    redactMatch: true,
  },
  {
    ruleId: 'SEC-SQL-INJECTION',
    title: 'Potential SQL injection via string interpolation',
    category: 'security',
    severity: 'critical',
    confidence: 'confirmed',
    scannerEngine: 'static-ast',
    regex: /(?:query|execute|raw)\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`|(?:SELECT|INSERT|UPDATE|DELETE)\s+.+\$\{/i,
    languages: ['TypeScript', 'JavaScript'],
    description: 'Dynamic user-controlled values appear interpolated directly into a SQL query template literal.',
    whyItMatters: 'Unsanitized string interpolation in SQL statements allows attackers to execute arbitrary database queries.',
  },
  {
    ruleId: 'SEC-PY-SQL-INJECTION',
    title: 'Potential SQL injection via Python f-string in query execution',
    category: 'security',
    severity: 'critical',
    confidence: 'confirmed',
    scannerEngine: 'static-ast',
    regex: /cursor\.execute\s*\(\s*f["'][^"']*\{[^}]+\}/,
    languages: ['Python'],
    description: 'An f-string is passed directly into cursor.execute() instead of parameterized bindings.',
    whyItMatters: 'Attackers can manipulate interpolated values to dump or alter database records.',
  },
  {
    ruleId: 'SEC-EVAL-EXEC',
    title: 'Dynamic code execution via eval() or new Function()',
    category: 'security',
    severity: 'high',
    confidence: 'confirmed',
    scannerEngine: 'static-ast',
    regex: /\b(?:eval|Function)\s*\(/,
    languages: ['TypeScript', 'JavaScript', 'Python'],
    ignoreTests: true,
    description: 'Use of eval() or dynamic Function constructor executes strings as arbitrary code.',
    whyItMatters: 'If untrusted input reaches eval(), it leads to remote code execution or XSS.',
  },
  {
    ruleId: 'SEC-CMD-INJECTION',
    title: 'Shell command execution with potential injection vector',
    category: 'security',
    severity: 'high',
    confidence: 'potential',
    scannerEngine: 'static-ast',
    regex: /(?:child_process\.exec|execSync|os\.system)\s*\(|subprocess\.\w+\([^)]*shell\s*=\s*True/,
    languages: ['TypeScript', 'JavaScript', 'Python'],
    description: 'Executing commands through a system shell enables metacharacter injection when arguments are untrusted.',
    whyItMatters: 'Prefer execFile/spawn or subprocess without shell=True using argument arrays.',
  },
  {
    ruleId: 'SEC-XSS-INNERHTML',
    title: 'Unescaped HTML injection sink (dangerouslySetInnerHTML / innerHTML)',
    category: 'security',
    severity: 'high',
    confidence: 'potential',
    scannerEngine: 'static-ast',
    regex: /dangerouslySetInnerHTML|\.innerHTML\s*=/,
    languages: ['TypeScript', 'JavaScript'],
    description: 'Direct DOM HTML insertion bypasses framework escaping.',
    whyItMatters: 'Rendering unsanitized HTML exposes users to Cross-Site Scripting (XSS) attacks.',
  },
  {
    ruleId: 'SEC-TLS-VERIFY-OFF',
    title: 'TLS certificate validation disabled',
    category: 'security',
    severity: 'high',
    confidence: 'confirmed',
    scannerEngine: 'static-ast',
    regex: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]0['"]|verify\s*=\s*False/,
    description: 'TLS/SSL certificate verification is explicitly bypassed.',
    whyItMatters: 'Disabling certificate checks makes connections vulnerable to man-in-the-middle interception.',
  },
  {
    ruleId: 'SEC-WEAK-CRYPTO',
    title: 'Weak cryptographic hash or non-CSPRNG token generation',
    category: 'security',
    severity: 'medium',
    confidence: 'potential',
    scannerEngine: 'static-ast',
    regex: /createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)|hashlib\.(?:md5|sha1)\s*\(/,
    description: 'MD5 and SHA-1 are cryptographically broken for integrity checks or password hashing.',
    whyItMatters: 'Use SHA-256+ for digests and Argon2/scrypt/bcrypt for password derivation.',
  },
  {
    ruleId: 'SEC-CORS-WILDCARD',
    title: 'Permissive wildcard CORS configuration with credentials',
    category: 'security',
    severity: 'medium',
    confidence: 'confirmed',
    scannerEngine: 'static-ast',
    regex: /origin\s*:\s*['"]\*['"].*credentials\s*:\s*true|credentials\s*:\s*true.*origin\s*:\s*['"]\*['"]/,
    description: 'CORS allows wildcard origins alongside credentialed requests.',
    whyItMatters: 'Overly permissive CORS policies expose authenticated API responses to untrusted origins.',
  },
  {
    ruleId: 'QUAL-TS-ANY',
    title: 'Excessive use of explicit TypeScript `any` type',
    category: 'quality',
    severity: 'low',
    confidence: 'confirmed',
    scannerEngine: 'complexity-analyzer',
    regex: /:\s*any\b|as\s+any\b/,
    languages: ['TypeScript'],
    ignoreTests: true,
    description: 'Explicit `any` disables static type verification across callers and callees.',
    whyItMatters: 'Weakening TypeScript types hides nullability and contract bugs until runtime.',
  },
  {
    ruleId: 'PERF-SYNC-FS',
    title: 'Blocking synchronous filesystem call in runtime module',
    category: 'performance',
    severity: 'medium',
    confidence: 'potential',
    scannerEngine: 'complexity-analyzer',
    regex: /\b(?:readFileSync|writeFileSync|existsSync|readdirSync)\s*\(/,
    languages: ['TypeScript', 'JavaScript'],
    ignoreTests: true,
    description: 'Synchronous filesystem operations block the Node.js event loop.',
    whyItMatters: 'Under concurrent traffic, synchronous I/O stalls all in-flight HTTP requests.',
  },
  {
    ruleId: 'QUAL-CONSOLE-DEBUG',
    title: 'Residual console debug output in production source',
    category: 'quality',
    severity: 'info',
    confidence: 'confirmed',
    scannerEngine: 'complexity-analyzer',
    regex: /\bconsole\.(?:log|debug)\s*\(/,
    languages: ['TypeScript', 'JavaScript'],
    ignoreTests: true,
    description: 'Unstructured console debug statements can leak runtime data or clutter production logs.',
    whyItMatters: 'Use structured logging with secret redaction for production observability.',
  },
];

function isTestFile(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.includes('.test.') ||
    lower.includes('.spec.') ||
    lower.includes('__tests__') ||
    lower.startsWith('tests/') ||
    lower.includes('/tests/')
  );
}

function redactLineSecrets(text: string): string {
  return text
    .replace(/\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, '$1****************')
    .replace(/\b(ghp_|github_pat_)[A-Za-z0-9_]{10,}/g, '$1[REDACTED]')
    .replace(/(secret|password|api_key|apiKey|token)\s*[:=]\s*(['"`])[^'"`]{8,}\2/gi, '$1: $2[REDACTED]$2');
}

function estimateComplexity(content: string): { maxFnLines: number; cyclomatic: number } {
  const lines = content.split('\n');
  let cyclomatic = 1;
  const branchRegex = /\b(if|else if|for|while|case|catch)\b|&&|\|\||\?/g;
  for (const line of lines) {
    const matches = line.match(branchRegex);
    if (matches) cyclomatic += matches.length;
  }

  let maxFnLines = 0;
  let currentFnStart = -1;
  let braceDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (currentFnStart === -1 && /\b(function|async\s+function|def\s+\w+)\b|=>\s*\{/.test(line)) {
      currentFnStart = i;
      braceDepth = 0;
    }
    if (currentFnStart !== -1) {
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      braceDepth += opens - closes;
      if (braceDepth <= 0 && i > currentFnStart + 1) {
        maxFnLines = Math.max(maxFnLines, i - currentFnStart + 1);
        currentFnStart = -1;
      }
    }
  }
  return { maxFnLines, cyclomatic };
}

function detectDuplicateBlocks(files: ScannableFile[]): DetectedFinding[] {
  const seen = new Map<string, { filePath: string; line: number; snippet: string }>();
  const duplicates: DetectedFinding[] = [];
  const reportedPairs = new Set<string>();

  for (const file of files) {
    if (isTestFile(file.path) || file.path.endsWith('.json')) continue;
    const lang = detectLanguage(file.path);
    if (lang === 'Config' || lang === 'Other') continue;

    const lines = file.content.split('\n');
    const WINDOW = 6;
    if (lines.length < WINDOW) continue;

    for (let i = 0; i <= lines.length - WINDOW; i++) {
      const slice = lines
        .slice(i, i + WINDOW)
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('import ') && !l.startsWith('//'));
      if (slice.length < 5) continue;
      const normalized = slice.join('\n');
      if (normalized.length < 140) continue;

      const hash = crypto.createHash('md5').update(normalized).digest('hex');
      const existing = seen.get(hash);
      if (existing && existing.filePath !== file.path) {
        const pairKey = `${existing.filePath}->${file.path}`;
        if (!reportedPairs.has(pairKey)) {
          reportedPairs.add(pairKey);
          duplicates.push({
            fingerprint: makeFingerprint('QUAL-DUPLICATE-BLOCK', file.path, i + 1, normalized),
            category: 'quality',
            severity: 'low',
            confidence: 'confirmed',
            scannerEngine: 'complexity-analyzer',
            ruleId: 'QUAL-DUPLICATE-BLOCK',
            title: `Duplicated logic block shared with ${existing.filePath}`,
            description: `A ${WINDOW}-line code block in ${file.path} closely matches ${existing.filePath} (line ${existing.line}).`,
            whyItMatters: 'Duplicated business logic increases maintenance overhead and causes bug fixes to drift.',
            filePath: file.path,
            lineStart: i + 1,
            lineEnd: i + WINDOW,
            codeExcerpt: extractExcerpt(lines, i + 1, 2),
          });
        }
      } else if (!existing) {
        seen.set(hash, { filePath: file.path, line: i + 1, snippet: normalized });
      }
    }
  }
  return duplicates.slice(0, 8);
}

function parseDependencies(files: ScannableFile[]): DependencyRecord[] {
  const deps: DependencyRecord[] = [];
  for (const file of files) {
    if (file.path.endsWith('package.json')) {
      try {
        const pkg = JSON.parse(file.content);
        const license = typeof pkg.license === 'string' ? pkg.license : 'Unspecified';
        for (const [name, ver] of Object.entries(pkg.dependencies || {})) {
          deps.push({
            name,
            version: String(ver).replace(/^[\^~>=< ]+/, ''),
            ecosystem: 'npm',
            scope: 'runtime',
            filePath: file.path,
            license,
            vulnerabilities: [],
          });
        }
        for (const [name, ver] of Object.entries(pkg.devDependencies || {})) {
          deps.push({
            name,
            version: String(ver).replace(/^[\^~>=< ]+/, ''),
            ecosystem: 'npm',
            scope: 'dev',
            filePath: file.path,
            license,
            vulnerabilities: [],
          });
        }
      } catch {
        // Ignore malformed package.json here; handled by static check if needed
      }
    } else if (file.path.endsWith('requirements.txt')) {
      for (const rawLine of file.content.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const match = line.match(/^([A-Za-z0-9_.\-]+)\s*(?:==|>=|~=)?\s*([0-9][A-Za-z0-9_.\-]*)?/);
        if (match) {
          deps.push({
            name: match[1],
            version: match[2] || 'unpinned',
            ecosystem: 'PyPI',
            scope: 'runtime',
            filePath: file.path,
            vulnerabilities: [],
            outdatedHint: match[2] ? undefined : 'Version is unpinned; pin an exact version for reproducible builds.',
          });
        }
      }
    }
  }
  return deps;
}

function resolveRelativeImport(fromPath: string, importSpec: string, fileSet: Set<string>): string | null {
  if (!importSpec.startsWith('.')) return null;
  const fromParts = fromPath.split('/');
  fromParts.pop();
  for (const seg of importSpec.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') fromParts.pop();
    else fromParts.push(seg);
  }
  const base = fromParts.join('/');
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.py`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
  ];
  for (const c of candidates) {
    if (fileSet.has(c)) return c;
  }
  return null;
}

function buildArchitectureGraph(files: ScannableFile[]): ArchitectureGraph {
  const codeFiles = files.filter((f) => {
    const lang = detectLanguage(f.path);
    return lang !== 'Config' && lang !== 'Other';
  });
  const fileSet = new Set(codeFiles.map((f) => f.path));
  const edges: Array<{ source: string; target: string }> = [];
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const f of codeFiles) {
    adj.set(f.path, []);
    inDegree.set(f.path, 0);
  }

  const importRegex = /(?:import\s+[\s\S]*?from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\))/g;

  for (const f of codeFiles) {
    let match: RegExpExecArray | null;
    importRegex.lastIndex = 0;
    const targets = new Set<string>();
    while ((match = importRegex.exec(f.content)) !== null) {
      const spec = match[1] || match[2];
      const resolved = resolveRelativeImport(f.path, spec, fileSet);
      if (resolved && resolved !== f.path && !targets.has(resolved)) {
        targets.add(resolved);
        edges.push({ source: f.path, target: resolved });
        adj.get(f.path)!.push(resolved);
        inDegree.set(resolved, (inDegree.get(resolved) || 0) + 1);
      }
    }
  }

  // Detect cycles via DFS
  const visited = new Set<string>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];

  function dfs(node: string) {
    visited.add(node);
    onStack.add(node);
    stack.push(node);

    for (const next of adj.get(node) || []) {
      if (!visited.has(next)) {
        dfs(next);
      } else if (onStack.has(next)) {
        const idx = stack.indexOf(next);
        if (idx !== -1) {
          cycles.push([...stack.slice(idx), next]);
        }
      }
    }

    stack.pop();
    onStack.delete(node);
  }

  for (const f of codeFiles) {
    if (!visited.has(f.path)) dfs(f.path);
  }

  const dirCounts = new Map<string, number>();
  const entryPoints: string[] = [];

  const nodes = codeFiles.map((f) => {
    const parts = f.path.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
    dirCounts.set(dir, (dirCounts.get(dir) || 0) + 1);
    const baseName = parts[parts.length - 1];
    const isEntry =
      /^(server|index|main|app)\.(ts|tsx|js|jsx|py|go)$/i.test(baseName) ||
      f.path === 'src/main.tsx' ||
      f.path === 'src/App.tsx';
    if (isEntry) entryPoints.push(f.path);

    return {
      id: f.path,
      label: baseName,
      directory: dir,
      language: detectLanguage(f.path),
      linesOfCode: f.content.split('\n').length,
      isEntryPoint: isEntry,
      inDegree: inDegree.get(f.path) || 0,
      outDegree: (adj.get(f.path) || []).length,
    };
  });

  return {
    nodes: nodes.slice(0, 80),
    edges: edges.slice(0, 160),
    circularDependencies: cycles.slice(0, 10),
    entryPoints,
    directories: Array.from(dirCounts.entries())
      .map(([name, fileCount]) => ({ name, fileCount }))
      .sort((a, b) => b.fileCount - a.fileCount),
  };
}

export async function runDeterministicScan(
  rawFiles: ScannableFile[],
  options: ScanOptions
): Promise<ScanExecutionResult> {
  const skippedChecks: string[] = [];
  const findings: DetectedFinding[] = [];
  const languages: Record<string, number> = {};

  const analyzableFiles = rawFiles.filter((f) => {
    const ext = getExtension(f.path);
    const name = f.path.split('/').pop() || '';
    return CODE_EXTENSIONS.has(ext) || name === 'Dockerfile' || name === '.env.example';
  });

  for (const file of analyzableFiles) {
    const lang = detectLanguage(file.path);
    if (lang !== 'Other') {
      languages[lang] = (languages[lang] || 0) + file.content.split('\n').length;
    }
  }

  const runSecurity =
    options.scanType === 'full' ||
    options.scanType === 'security' ||
    (options.scanType === 'custom' &&
      (options.enabledAnalyzers?.includes('secret-scanner') ||
        options.enabledAnalyzers?.includes('static-ast')));

  const runQuality =
    options.scanType === 'full' ||
    options.scanType === 'quality' ||
    (options.scanType === 'custom' && options.enabledAnalyzers?.includes('complexity-analyzer'));

  const runDeps =
    options.scanType === 'full' ||
    options.scanType === 'dependency' ||
    (options.scanType === 'custom' && options.enabledAnalyzers?.includes('osv-audit'));

  const runArch =
    options.scanType === 'full' ||
    options.scanType === 'architecture' ||
    (options.scanType === 'custom' && options.enabledAnalyzers?.includes('architecture-analyzer'));

  // 1. Pattern-based security + quality rules
  for (const file of analyzableFiles) {
    const lang = detectLanguage(file.path);
    const lines = file.content.split('\n');
    const isTest = isTestFile(file.path);

    for (const rule of SECURITY_AND_QUALITY_RULES) {
      if (rule.category === 'security' && !runSecurity) continue;
      if ((rule.category === 'quality' || rule.category === 'performance') && !runQuality) continue;
      if (rule.languages && !rule.languages.includes(lang)) continue;
      if (rule.ignoreTests && isTest) continue;

      let ruleMatchCount = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (rule.regex.test(line)) {
          ruleMatchCount++;
          if (ruleMatchCount > 3 && rule.severity === 'info') continue;
          const rawExcerpt = extractExcerpt(lines, i, 2);
          const safeExcerpt = rule.redactMatch ? redactLineSecrets(rawExcerpt) : rawExcerpt;
          findings.push({
            fingerprint: makeFingerprint(rule.ruleId, file.path, i + 1, safeExcerpt),
            category: rule.category,
            severity: rule.severity,
            confidence: rule.confidence,
            scannerEngine: rule.scannerEngine,
            ruleId: rule.ruleId,
            title: rule.title,
            description: rule.description,
            whyItMatters: rule.whyItMatters,
            filePath: file.path,
            lineStart: i + 1,
            lineEnd: i + 1,
            codeExcerpt: safeExcerpt,
          });
        }
      }
    }

    // Complexity analysis per file
    if (runQuality && !isTest && (lang === 'TypeScript' || lang === 'JavaScript' || lang === 'Python')) {
      const { maxFnLines, cyclomatic } = estimateComplexity(file.content);
      if (cyclomatic > 24 || maxFnLines > 75) {
        const excerpt = lines.slice(0, Math.min(8, lines.length)).map((l, idx) => `${idx + 1}: ${l}`).join('\n');
        findings.push({
          fingerprint: makeFingerprint('QUAL-HIGH-COMPLEXITY', file.path, 1, file.path),
          category: 'quality',
          severity: cyclomatic > 40 ? 'high' : 'medium',
          confidence: 'confirmed',
          scannerEngine: 'complexity-analyzer',
          ruleId: 'QUAL-HIGH-COMPLEXITY',
          title: `High module complexity (cyclomatic ${cyclomatic}, max function ${maxFnLines} lines)`,
          description: `${file.path} has elevated branching complexity (${cyclomatic}) or overly long functions (${maxFnLines} lines).`,
          whyItMatters: 'High cyclomatic complexity makes code harder to test, review, and modify safely.',
          filePath: file.path,
          lineStart: 1,
          lineEnd: Math.min(lines.length, 30),
          codeExcerpt: excerpt,
          metadata: { cyclomatic, maxFnLines },
        });
      }
    }
  }

  // 2. Duplicate code detection
  if (runQuality) {
    findings.push(...detectDuplicateBlocks(analyzableFiles));
  }

  // 3. Dependency analysis + OSV lookup
  let dependencies = parseDependencies(rawFiles);
  if (runDeps && dependencies.length > 0) {
    if (options.osvLookup) {
      const osv = await options.osvLookup(
        dependencies
          .filter((d) => d.version !== 'unpinned' && /^[0-9]/.test(d.version))
          .map((d) => ({ name: d.name, version: d.version, ecosystem: d.ecosystem }))
      );
      if (osv.skippedReason) {
        skippedChecks.push(osv.skippedReason);
      }
      dependencies = dependencies.map((dep) => {
        const key = `${dep.ecosystem}:${dep.name}@${dep.version}`;
        const vulns = osv.results[key] || [];
        for (const v of vulns) {
          findings.push({
            fingerprint: makeFingerprint(`OSV-${v.id}`, dep.filePath, 1, key),
            category: 'dependency',
            severity: v.severity,
            confidence: 'confirmed',
            scannerEngine: 'osv-audit',
            ruleId: `OSV-${v.id}`,
            title: `Vulnerable dependency ${dep.name}@${dep.version} (${v.id})`,
            description: v.summary,
            whyItMatters: `Known security advisory ${v.id} affects ${dep.name}@${dep.version}.${v.fixedVersion ? ` Upgrade to ${v.fixedVersion} or later.` : ''}`,
            filePath: dep.filePath,
            lineStart: 1,
            lineEnd: 1,
            codeExcerpt: `"${dep.name}": "${dep.version}"`,
            metadata: { package: dep.name, version: dep.version, advisoryId: v.id, fixedVersion: v.fixedVersion },
          });
        }
        return { ...dep, vulnerabilities: vulns };
      });
    } else {
      skippedChecks.push('Live OSV vulnerability lookup disabled for this scan run.');
    }

    for (const dep of dependencies) {
      if (dep.outdatedHint) {
        findings.push({
          fingerprint: makeFingerprint('DEP-UNPINNED', dep.filePath, 1, dep.name),
          category: 'dependency',
          severity: 'low',
          confidence: 'confirmed',
          scannerEngine: 'osv-audit',
          ruleId: 'DEP-UNPINNED',
          title: `Unpinned dependency version for ${dep.name}`,
          description: dep.outdatedHint,
          whyItMatters: 'Unpinned versions can silently pull breaking or compromised releases during builds.',
          filePath: dep.filePath,
          lineStart: 1,
          lineEnd: 1,
          codeExcerpt: dep.name,
        });
      }
    }
  }

  // 4. Architecture & Repo structure
  const architecture = buildArchitectureGraph(analyzableFiles);
  if (runArch) {
    for (const cycle of architecture.circularDependencies) {
      findings.push({
        fingerprint: makeFingerprint('ARCH-CIRCULAR', cycle[0], 1, cycle.join('->')),
        category: 'architecture',
        severity: 'medium',
        confidence: 'confirmed',
        scannerEngine: 'architecture-analyzer',
        ruleId: 'ARCH-CIRCULAR',
        title: `Circular module dependency: ${cycle.join(' -> ')}`,
        description: `Detected a cyclic import chain involving ${cycle.length - 1} modules.`,
        whyItMatters: 'Circular dependencies create tight coupling, initialization-order bugs, and difficult refactoring.',
        filePath: cycle[0],
        lineStart: 1,
        lineEnd: 1,
        codeExcerpt: cycle.join(' -> '),
      });
    }
  }

  // 5. Structural signals for deterministic health score
  const allPaths = rawFiles.map((f) => f.path);
  const testFiles = allPaths.filter((p) => isTestFile(p));
  const signals: RepoSignalsInput = {
    totalFiles: analyzableFiles.length,
    hasTests: testFiles.length > 0,
    testFileCount: testFiles.length,
    hasReadme: allPaths.some((p) => /^readme\.md$/i.test(p.split('/').pop() || '')),
    hasSecurityPolicy: allPaths.some((p) => /^security\.md$/i.test(p.split('/').pop() || '')),
    hasCiConfig: allPaths.some((p) => p.includes('.github/workflows/') || p.endsWith('.gitlab-ci.yml')),
    hasEnvExample: allPaths.some((p) => p.endsWith('.env.example')),
    hasTypeConfig: allPaths.some((p) => p.endsWith('tsconfig.json') || p.endsWith('pyproject.toml')),
    circularDependencyCount: architecture.circularDependencies.length,
    vulnerableDependencyCount: dependencies.filter((d) => d.vulnerabilities.length > 0).length,
    outdatedDependencyCount: dependencies.filter((d) => Boolean(d.outdatedHint)).length,
  };

  if (!signals.hasTests && (options.scanType === 'full' || options.scanType === 'architecture')) {
    const targetPath = allPaths.includes('package.json') ? 'package.json' : (allPaths[0] || 'README.md');
    findings.push({
      fingerprint: makeFingerprint('ARCH-NO-TESTS', 'repository', 1, 'no-tests'),
      category: 'architecture',
      severity: 'medium',
      confidence: 'confirmed',
      scannerEngine: 'architecture-analyzer',
      ruleId: 'ARCH-NO-TESTS',
      title: 'No automated test suite found in repository',
      description: 'No *.test.* or *.spec.* files were detected across scanned paths.',
      whyItMatters: 'Without automated tests, regressions and security patch verifications cannot be validated reliably.',
      filePath: targetPath,
      lineStart: 1,
      lineEnd: 1,
      codeExcerpt: 'No test files detected',
    });
  }

  const scoreBreakdown = calculateRepositoryHealthScore(findings, signals);

  return {
    findings,
    dependencies,
    architecture,
    scoreBreakdown,
    languages,
    filesAnalyzed: analyzableFiles.length,
    skippedChecks,
  };
}
