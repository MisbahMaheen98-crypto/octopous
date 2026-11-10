import fs from 'fs';
import path from 'path';
import { ProjectIndex, FileMetadata, SearchMatch, RetrievedSnippet } from '../octo.types.js';
import { SecurityGuard } from '../octo.security.js';
import { logger } from '../octo.logger.js';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '.octo-backup',
  '.cache',
  '.vscode',
  '.vscode-test',
  '.octopus-storage',
]);

const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.html',
  '.css',
  '.py',
  '.go',
  '.rs',
  '.sql',
  '.yaml',
  '.yml',
  '.prisma',
]);

export interface DiscoveredApiRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';
  path: string;
  file: string;
  line: number;
}

export interface DiscoveredDbModel {
  name: string;
  file: string;
  line: number;
  fields: string[];
  relations: string[];
}

export interface DiscoveredComponent {
  name: string;
  file: string;
  line: number;
  type: 'functional' | 'class';
  hasHooks: boolean;
}

export interface ProjectArchitectureOverview {
  frameworks: string[];
  entryPoints: string[];
  packageManagers: string[];
  apiRoutes: DiscoveredApiRoute[];
  dbModels: DiscoveredDbModel[];
  components: DiscoveredComponent[];
  authFiles: string[];
  testFiles: string[];
  configFiles: string[];
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
}

export class ProjectIndexer {
  private projectRoot: string;
  private projectId: string;
  private index: ProjectIndex | null = null;
  private isIndexing = false;
  private lastError: string | null = null;
  private fileTimestamps: Map<string, number> = new Map();
  private architectureOverview: ProjectArchitectureOverview | null = null;

  constructor(projectId: string, projectRoot: string) {
    this.projectId = projectId;
    this.projectRoot = path.resolve(projectRoot);
  }

  public getStatus() {
    return {
      projectId: this.projectId,
      isIndexing: this.isIndexing,
      isReady: this.index !== null,
      lastIndexedAt: this.index?.indexedAt || null,
      totalFiles: this.index?.totalFiles || 0,
      totalLines: this.index?.totalLines || 0,
      fileTypes: this.index?.fileTypes || {},
      lastError: this.lastError,
    };
  }

  public getIndex(): ProjectIndex | null {
    return this.index;
  }

  public getArchitectureOverview(): ProjectArchitectureOverview {
    if (!this.architectureOverview && this.index) {
      this.synthesizeArchitectureOverview();
    }
    return this.architectureOverview || {
      frameworks: [],
      entryPoints: [],
      packageManagers: ['npm'],
      apiRoutes: [],
      dbModels: [],
      components: [],
      authFiles: [],
      testFiles: [],
      configFiles: [],
      totalFiles: 0,
      totalLines: 0,
      languages: {},
    };
  }

  /**
   * Full codebase indexing scan
   */
  public async buildIndex(): Promise<ProjectIndex> {
    this.isIndexing = true;
    this.lastError = null;
    const startTime = Date.now();

    try {
      if (!fs.existsSync(this.projectRoot)) {
        throw new Error(`Project directory does not exist: ${this.projectRoot}`);
      }

      const files: Record<string, FileMetadata> = {};
      const fileTypes: Record<string, number> = {};
      const symbols: Record<string, { relativePath: string; line: number; type: string }> = {};
      let totalLines = 0;
      this.fileTimestamps.clear();

      const scanDir = (currentDir: string) => {
        let entries: fs.Dirent[] = [];
        try {
          entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          const relativePath = path.relative(this.projectRoot, fullPath).replace(/\\/g, '/');

          if (entry.isDirectory()) {
            if (IGNORED_DIRS.has(entry.name)) continue;
            scanDir(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
            if (SecurityGuard.isSensitiveFile(entry.name)) continue;

            try {
              const stats = fs.statSync(fullPath);
              this.fileTimestamps.set(relativePath, stats.mtimeMs);

              const content = fs.readFileSync(fullPath, 'utf-8');
              const parsed = this.parseFileContent(relativePath, fullPath, entry.name, ext, stats.size, stats.mtime, content);
              
              files[relativePath] = parsed.metadata;
              totalLines += parsed.metadata.lineCount;
              fileTypes[ext] = (fileTypes[ext] || 0) + 1;

              for (const [sym, info] of Object.entries(parsed.symbols)) {
                symbols[sym] = info;
              }
            } catch (readErr) {
              logger.warn('ProjectIndexer', `Could not read or parse: ${relativePath}`, readErr);
            }
          }
        }
      };

      scanDir(this.projectRoot);

      // Build cross-file dependency graph
      const { dependencies, dependents } = this.resolveDependencies(files);

      this.index = {
        projectId: this.projectId,
        indexedAt: new Date().toISOString(),
        totalFiles: Object.keys(files).length,
        totalLines,
        fileTypes,
        files,
        symbols,
        dependencies,
        dependents,
      };

      this.synthesizeArchitectureOverview();

      logger.info('ProjectIndexer', `Indexed ${this.index.totalFiles} files with cross-file AST intelligence in ${Date.now() - startTime}ms`);
      return this.index;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      logger.error('ProjectIndexer', 'Indexing failed', err);
      throw err;
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Incremental Index Update
   * Re-scans only modified, added, or deleted files to prevent unnecessary full rescans.
   */
  public async updateIndex(): Promise<ProjectIndex> {
    if (!this.index) {
      return this.buildIndex();
    }

    this.isIndexing = true;
    const startTime = Date.now();
    let modifiedCount = 0;
    let addedCount = 0;
    let deletedCount = 0;

    try {
      const currentFilesOnDisk = new Set<string>();

      const checkDir = (currentDir: string) => {
        let entries: fs.Dirent[] = [];
        try {
          entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          const relativePath = path.relative(this.projectRoot, fullPath).replace(/\\/g, '/');

          if (entry.isDirectory()) {
            if (IGNORED_DIRS.has(entry.name)) continue;
            checkDir(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
            if (SecurityGuard.isSensitiveFile(entry.name)) continue;

            currentFilesOnDisk.add(relativePath);

            try {
              const stats = fs.statSync(fullPath);
              const lastMtime = this.fileTimestamps.get(relativePath);

              if (lastMtime === undefined) {
                // Newly added file
                addedCount++;
                const content = fs.readFileSync(fullPath, 'utf-8');
                const parsed = this.parseFileContent(relativePath, fullPath, entry.name, ext, stats.size, stats.mtime, content);
                this.index!.files[relativePath] = parsed.metadata;
                this.fileTimestamps.set(relativePath, stats.mtimeMs);
                for (const [sym, info] of Object.entries(parsed.symbols)) {
                  this.index!.symbols[sym] = info;
                }
              } else if (stats.mtimeMs > lastMtime) {
                // Modified file
                modifiedCount++;
                const content = fs.readFileSync(fullPath, 'utf-8');
                const parsed = this.parseFileContent(relativePath, fullPath, entry.name, ext, stats.size, stats.mtime, content);
                this.index!.files[relativePath] = parsed.metadata;
                this.fileTimestamps.set(relativePath, stats.mtimeMs);
                // Update symbols for this file
                for (const [sym, info] of Object.entries(parsed.symbols)) {
                  this.index!.symbols[sym] = info;
                }
              }
            } catch (err) {
              logger.warn('ProjectIndexer', `Incremental check error on ${relativePath}`, err);
            }
          }
        }
      };

      checkDir(this.projectRoot);

      // Check for deleted files
      for (const knownFile of Object.keys(this.index.files)) {
        if (!currentFilesOnDisk.has(knownFile)) {
          deletedCount++;
          delete this.index.files[knownFile];
          this.fileTimestamps.delete(knownFile);
          // Clean up symbols defined in deleted file
          for (const [sym, info] of Object.entries(this.index.symbols)) {
            if (info.relativePath === knownFile) {
              delete this.index.symbols[sym];
            }
          }
        }
      }

      if (addedCount > 0 || modifiedCount > 0 || deletedCount > 0) {
        // Re-resolve dependencies
        const { dependencies, dependents } = this.resolveDependencies(this.index.files);
        this.index.dependencies = dependencies;
        this.index.dependents = dependents;
        this.index.totalFiles = Object.keys(this.index.files).length;
        this.index.indexedAt = new Date().toISOString();
        this.synthesizeArchitectureOverview();
        logger.info(
          'ProjectIndexer',
          `Incremental update completed in ${Date.now() - startTime}ms (Added: ${addedCount}, Modified: ${modifiedCount}, Deleted: ${deletedCount})`
        );
      }

      return this.index;
    } catch (err) {
      logger.error('ProjectIndexer', 'Incremental index update failed', err);
      return this.index;
    } finally {
      this.isIndexing = false;
    }
  }

  private parseFileContent(
    relativePath: string,
    fullPath: string,
    fileName: string,
    ext: string,
    sizeBytes: number,
    mtime: Date,
    content: string
  ): {
    metadata: FileMetadata;
    symbols: Record<string, { relativePath: string; line: number; type: string }>;
  } {
    const lines = content.split('\n');
    const lineCount = lines.length;
    const fileSymbols: string[] = [];
    const fileImports: string[] = [];
    const symbols: Record<string, { relativePath: string; line: number; type: string }> = {};

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // Functions / Methods / Classes / Interfaces / Types
      const declMatch = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?(function|class|interface|type|enum)\s+([A-Za-z0-9_]+)/);
      if (declMatch && declMatch[1] && declMatch[2]) {
        const kind = declMatch[1];
        const symName = declMatch[2];
        fileSymbols.push(symName);
        symbols[symName] = {
          relativePath,
          line: lineNum,
          type: kind,
        };
      }

      // Exported const / let arrow functions or objects
      const constMatch = trimmed.match(/^export\s+(?:const|let|var)\s+([A-Za-z0-9_]+)\s*(?:=|:)/);
      if (constMatch && constMatch[1]) {
        const symName = constMatch[1];
        fileSymbols.push(symName);
        symbols[symName] = {
          relativePath,
          line: lineNum,
          type: 'const',
        };
      }

      // React functional components: e.g. function Component(...) or const Component: React.FC = ...
      const reactMatch = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9_]+)\s*(?:=|\()/);
      if (reactMatch && reactMatch[1]) {
        const compName = reactMatch[1];
        if (!symbols[compName]) {
          fileSymbols.push(compName);
          symbols[compName] = {
            relativePath,
            line: lineNum,
            type: 'component',
          };
        }
      }

      // Python def / class
      if (ext === '.py') {
        const pyMatch = trimmed.match(/^(?:async\s+)?(def|class)\s+([A-Za-z0-9_]+)/);
        if (pyMatch && pyMatch[1] && pyMatch[2]) {
          const symName = pyMatch[2];
          fileSymbols.push(symName);
          symbols[symName] = {
            relativePath,
            line: lineNum,
            type: pyMatch[1],
          };
        }
      }

      // Imports extraction
      const importMatch = line.match(/(?:import|from|require\()\s*['"](\.[^'"]+)['"]/);
      if (importMatch && importMatch[1]) {
        fileImports.push(importMatch[1]);
      }
    });

    const metadata: FileMetadata = {
      path: fullPath,
      relativePath,
      name: fileName,
      extension: ext,
      sizeBytes,
      lineCount,
      lastModified: mtime.toISOString(),
      symbols: fileSymbols,
      imports: fileImports,
    };

    return { metadata, symbols };
  }

  private resolveDependencies(files: Record<string, FileMetadata>) {
    const dependencies: Record<string, string[]> = {};
    const dependents: Record<string, string[]> = {};

    for (const [relPath, meta] of Object.entries(files)) {
      dependencies[relPath] = [];
      if (!dependents[relPath]) dependents[relPath] = [];

      const fileDir = path.dirname(meta.path);
      for (const rawImport of meta.imports || []) {
        const cleanImport = rawImport.replace(/\.(js|ts|tsx|jsx)$/, '');
        for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.json', '']) {
          const candidatePath = path.resolve(fileDir, cleanImport + ext);
          const candidateRel = path.relative(this.projectRoot, candidatePath).replace(/\\/g, '/');
          if (files[candidateRel] && candidateRel !== relPath) {
            if (!dependencies[relPath].includes(candidateRel)) {
              dependencies[relPath].push(candidateRel);
            }
            if (!dependents[candidateRel]) dependents[candidateRel] = [];
            if (!dependents[candidateRel].includes(relPath)) {
              dependents[candidateRel].push(relPath);
            }
            break;
          }
        }
      }
    }

    return { dependencies, dependents };
  }

  private synthesizeArchitectureOverview() {
    if (!this.index) return;

    const frameworks = new Set<string>();
    const entryPoints: string[] = [];
    const packageManagers = new Set<string>(['npm']);
    const apiRoutes: DiscoveredApiRoute[] = [];
    const dbModels: DiscoveredDbModel[] = [];
    const components: DiscoveredComponent[] = [];
    const authFiles: string[] = [];
    const testFiles: string[] = [];
    const configFiles: string[] = [];
    const languages: Record<string, number> = {};

    // 1. Check package.json manifests
    for (const [relPath, fileMeta] of Object.entries(this.index.files)) {
      if (fileMeta.name === 'package.json') {
        try {
          const pkg = JSON.parse(fs.readFileSync(fileMeta.path, 'utf-8'));
          const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
          if (deps['fastify']) frameworks.add('Fastify');
          if (deps['express']) frameworks.add('Express');
          if (deps['react']) frameworks.add('React');
          if (deps['vite']) frameworks.add('Vite');
          if (deps['next']) frameworks.add('Next.js');
          if (deps['@prisma/client'] || deps['prisma']) frameworks.add('Prisma ORM');
          if (deps['vitest']) frameworks.add('Vitest');
          if (deps['jest']) frameworks.add('Jest');
          if (deps['tailwindcss']) frameworks.add('Tailwind CSS');
          if (pkg.main) entryPoints.push(`${path.dirname(relPath)}/${pkg.main}`.replace(/^\.\//, ''));
        } catch {}
      }

      // Check lockfiles
      if (fileMeta.name === 'pnpm-lock.yaml') packageManagers.add('pnpm');
      if (fileMeta.name === 'yarn.lock') packageManagers.add('yarn');
      if (fileMeta.name === 'package-lock.json') packageManagers.add('npm');

      // Check tests
      if (
        relPath.includes('.test.') ||
        relPath.includes('.spec.') ||
        relPath.startsWith('test/') ||
        relPath.startsWith('tests/')
      ) {
        testFiles.push(relPath);
      }

      // Check configs
      if (
        fileMeta.name.startsWith('tsconfig') ||
        fileMeta.name.startsWith('vite.config') ||
        fileMeta.name.startsWith('tailwind.config') ||
        fileMeta.name.startsWith('eslint') ||
        fileMeta.name.startsWith('.env')
      ) {
        configFiles.push(relPath);
      }

      // Check auth related files
      if (
        relPath.toLowerCase().includes('auth') ||
        relPath.toLowerCase().includes('session') ||
        relPath.toLowerCase().includes('login') ||
        relPath.toLowerCase().includes('token')
      ) {
        authFiles.push(relPath);
      }

      // Language distribution
      languages[fileMeta.extension] = (languages[fileMeta.extension] || 0) + 1;

      // Detect API routes and Database models inside source files
      if (['.ts', '.js', '.tsx', '.jsx'].includes(fileMeta.extension)) {
        try {
          const content = fs.readFileSync(fileMeta.path, 'utf-8');
          const lines = content.split('\n');

          lines.forEach((line, idx) => {
            const lineNum = idx + 1;
            // API Route: app.get('/path', ...), router.post('/path', ...), etc.
            const routeMatch = line.match(/\b(app|router|fastify|server)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/i);
            if (routeMatch && routeMatch[2] && routeMatch[3]) {
              apiRoutes.push({
                method: routeMatch[2].toUpperCase() as any,
                path: routeMatch[3],
                file: relPath,
                line: lineNum,
              });
            }

            // React component definition
            const compMatch = line.match(/(?:export\s+)?(?:default\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9_]+)/);
            if (compMatch && compMatch[1] && (content.includes('return <') || content.includes('return (') || content.includes('JSX.Element') || content.includes(': React.FC'))) {
              components.push({
                name: compMatch[1],
                file: relPath,
                line: lineNum,
                type: 'functional',
                hasHooks: content.includes('useState') || content.includes('useEffect') || content.includes('useCallback'),
              });
            }
          });
        } catch {}
      }

      // Detect Prisma models
      if (fileMeta.extension === '.prisma') {
        try {
          const content = fs.readFileSync(fileMeta.path, 'utf-8');
          const lines = content.split('\n');
          let currentModel: DiscoveredDbModel | null = null;

          lines.forEach((line, idx) => {
            const lineNum = idx + 1;
            const modelMatch = line.match(/^model\s+([A-Za-z0-9_]+)\s*\{/);
            if (modelMatch && modelMatch[1]) {
              currentModel = {
                name: modelMatch[1],
                file: relPath,
                line: lineNum,
                fields: [],
                relations: [],
              };
              dbModels.push(currentModel);
            } else if (currentModel && line.trim() === '}') {
              currentModel = null;
            } else if (currentModel && line.trim().length > 0 && !line.trim().startsWith('//') && !line.trim().startsWith('@@')) {
              const fieldParts = line.trim().split(/\s+/);
              if (fieldParts[0]) {
                currentModel.fields.push(fieldParts[0]);
                if (line.includes('@relation')) {
                  currentModel.relations.push(fieldParts[0]);
                }
              }
            }
          });
        } catch {}
      }
    }

    // Default entry points if not in package.json
    if (entryPoints.length === 0) {
      for (const ep of ['src/server.ts', 'src/main.ts', 'src/index.ts', 'src/main.tsx', 'src/index.tsx', 'index.html']) {
        if (this.index.files[ep]) entryPoints.push(ep);
      }
    }

    this.architectureOverview = {
      frameworks: Array.from(frameworks),
      entryPoints: [...new Set(entryPoints)],
      packageManagers: Array.from(packageManagers),
      apiRoutes: apiRoutes.slice(0, 100),
      dbModels: dbModels.slice(0, 50),
      components: components.slice(0, 100),
      authFiles: authFiles.slice(0, 30),
      testFiles: testFiles.slice(0, 50),
      configFiles: configFiles.slice(0, 30),
      totalFiles: this.index.totalFiles,
      totalLines: this.index.totalLines,
      languages,
    };
  }

  public getDependencies(relativePath: string): string[] {
    return this.index?.dependencies[relativePath] || [];
  }

  public getDependents(relativePath: string): string[] {
    return this.index?.dependents[relativePath] || [];
  }

  public getFileDependencies(relativePath: string): { directDependencies: string[]; directDependents: string[] } {
    return {
      directDependencies: this.getDependencies(relativePath),
      directDependents: this.getDependents(relativePath),
    };
  }

  public async readFile(relativePath: string): Promise<string> {
    const safePath = SecurityGuard.validatePathWithinProject(this.projectRoot, relativePath);
    if (SecurityGuard.isSensitiveFile(relativePath)) {
      throw new Error(`Access denied: ${relativePath} is marked as sensitive.`);
    }
    if (!fs.existsSync(safePath)) {
      throw new Error(`File not found: ${relativePath}`);
    }
    return fs.readFileSync(safePath, 'utf-8');
  }

  public async readFileRange(relativePath: string, startLine: number, endLine: number): Promise<{
    content: string;
    startLine: number;
    endLine: number;
    totalLines: number;
  }> {
    const content = await this.readFile(relativePath);
    const lines = content.split('\n');
    const totalLines = lines.length;
    const clampedStart = Math.max(1, Math.min(startLine, totalLines));
    const clampedEnd = Math.max(clampedStart, Math.min(endLine, totalLines));
    const slice = lines.slice(clampedStart - 1, clampedEnd).join('\n');

    return {
      content: SecurityGuard.redactSecrets(slice),
      startLine: clampedStart,
      endLine: clampedEnd,
      totalLines,
    };
  }

  public searchExact(term: string, caseSensitive: boolean = false): SearchMatch[] {
    if (!this.index) {
      return [];
    }

    const matches: SearchMatch[] = [];
    const query = caseSensitive ? term : term.toLowerCase();

    for (const [relPath, meta] of Object.entries(this.index.files)) {
      try {
        const content = fs.readFileSync(meta.path, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
          const testLine = caseSensitive ? line : line.toLowerCase();
          if (testLine.includes(query)) {
            matches.push({
              relativePath: relPath,
              line: idx + 1,
              lineContent: line.trim(),
              preview: lines.slice(Math.max(0, idx - 2), Math.min(lines.length, idx + 3)).join('\n'),
            });
          }
        });
      } catch {
        // Skip unreadable files
      }
    }

    return matches.slice(0, 50); // Safe limit
  }

  public findSymbol(symbolName: string) {
    if (!this.index) return null;
    return this.index.symbols[symbolName] || null;
  }

  /**
   * Retrieves relevant context snippets for AI prompting without sending the entire repository.
   */
  public retrieveRelevantSnippets(query: string, maxSnippets: number = 4): RetrievedSnippet[] {
    return this.retrieveContext(query, maxSnippets);
  }

  public retrieveContext(query: string, maxSnippets: number = 4): RetrievedSnippet[] {
    if (!this.index) return [];

    const snippets: RetrievedSnippet[] = [];
    const lowerQuery = query.toLowerCase();
    const queryTokens = lowerQuery.split(/\s+/).filter((t) => t.length > 2);

    // 1. Direct symbol lookups
    for (const [sym, symInfo] of Object.entries(this.index.symbols)) {
      if (lowerQuery.includes(sym.toLowerCase())) {
        try {
          const fileMeta = this.index.files[symInfo.relativePath];
          if (fileMeta) {
            const content = fs.readFileSync(fileMeta.path, 'utf-8');
            const lines = content.split('\n');
            const startLine = Math.max(1, symInfo.line - 10);
            const endLine = Math.min(lines.length, symInfo.line + 50);
            const window = lines.slice(startLine - 1, endLine).join('\n');

            snippets.push({
              relativePath: symInfo.relativePath,
              startLine,
              endLine,
              content: SecurityGuard.redactSecrets(window),
              reason: `Matched declared symbol '${sym}' at line ${symInfo.line}`,
            });
          }
        } catch {
          // ignore
        }
      }
    }

    // 2. Filename match
    for (const [relPath, fileMeta] of Object.entries(this.index.files)) {
      const baseName = path.basename(relPath).toLowerCase();
      if (queryTokens.some((tok) => baseName.includes(tok))) {
        if (!snippets.some((s) => s.relativePath === relPath)) {
          try {
            const content = fs.readFileSync(fileMeta.path, 'utf-8');
            const lines = content.split('\n');
            const endLine = Math.min(lines.length, 60);
            snippets.push({
              relativePath: relPath,
              startLine: 1,
              endLine,
              content: SecurityGuard.redactSecrets(lines.slice(0, endLine).join('\n')),
              reason: `Query matched filename: ${relPath}`,
            });
          } catch {
            // ignore
          }
        }
      }
    }

    // 3. Keyword matches in source if still need snippets
    if (snippets.length < maxSnippets) {
      for (const [relPath, fileMeta] of Object.entries(this.index.files)) {
        if (snippets.some((s) => s.relativePath === relPath)) continue;
        try {
          const content = fs.readFileSync(fileMeta.path, 'utf-8');
          const lowerContent = content.toLowerCase();
          const matchCount = queryTokens.filter((tok) => lowerContent.includes(tok)).length;

          if (matchCount >= 2 || (queryTokens.length === 1 && matchCount === 1)) {
            const lines = content.split('\n');
            snippets.push({
              relativePath: relPath,
              startLine: 1,
              endLine: Math.min(lines.length, 50),
              content: SecurityGuard.redactSecrets(lines.slice(0, 50).join('\n')),
              reason: `Relevant keywords found in file: ${relPath}`,
            });
          }
        } catch {
          // ignore
        }
        if (snippets.length >= maxSnippets) break;
      }
    }

    // 4. Cross-file dependents (e.g. tests or consuming callers of matched files)
    if (snippets.length < maxSnippets) {
      const currentMatchedFiles = [...new Set(snippets.map((s) => s.relativePath))];
      for (const matchedFile of currentMatchedFiles) {
        const dependentFiles = this.getDependents(matchedFile);
        for (const dep of dependentFiles) {
          if (!snippets.some((s) => s.relativePath === dep) && snippets.length < maxSnippets) {
            try {
              const fileMeta = this.index.files[dep];
              if (fileMeta) {
                const content = fs.readFileSync(fileMeta.path, 'utf-8');
                const lines = content.split('\n');
                const endLine = Math.min(lines.length, 45);
                snippets.push({
                  relativePath: dep,
                  startLine: 1,
                  endLine,
                  content: SecurityGuard.redactSecrets(lines.slice(0, endLine).join('\n')),
                  reason: `Cross-file dependent of ${matchedFile}`,
                });
              }
            } catch {
              // ignore
            }
          }
        }
      }
    }

    return snippets.slice(0, maxSnippets);
  }
}
