/**
 * ChanceTEKone — Multi-folder ingestion scanner.
 *
 * Root causes this module fixes in the previous drag-and-drop / folder-picker code:
 *
 *  1. `DataTransferItem.webkitGetAsEntry()` was being called AFTER the first `await`.
 *     The browser empties the drag data store as soon as the `drop` handler yields,
 *     so every entry after the first one resolved to `null` — only ONE folder was ever
 *     recognised. `captureDrop()` now snapshots every entry synchronously.
 *  2. Only a single "detectedFolderName" was kept for the entire drop, so the scanner
 *     had no concept of multiple source folders, nested folders or relative paths.
 *  3. A directory that failed to read aborted silently (`console.warn`) with no
 *     per-folder status. Each folder now carries its own status/errors and can be retried.
 *  4. Files were keyed by bare `file.name`, so `Track 01.mp3` in folder B overwrote
 *     `Track 01.mp3` in folder A. Every file now gets a stable id derived from its
 *     relative path, size and mtime.
 *
 * The module has no browser dependencies other than structural types, so it is fully
 * unit-testable with fake file-system entries.
 */

import { stableHash, normalizeKey } from './hash';

export const MAX_FOLDERS_PER_BATCH = 300;
const MAX_DEPTH = 64;

export type ScannedFileKind = 'audio' | 'image' | 'unsupported';

export interface FileLike {
  name: string;
  size: number;
  type: string;
  lastModified?: number;
  webkitRelativePath?: string;
}

export interface FsFileEntryLike<F extends FileLike = File> {
  isFile: true;
  isDirectory: false;
  name: string;
  file(success: (file: F) => void, error?: (err: unknown) => void): void;
}

export interface FsDirectoryReaderLike<F extends FileLike = File> {
  readEntries(success: (entries: FsEntryLike<F>[]) => void, error?: (err: unknown) => void): void;
}

export interface FsDirectoryEntryLike<F extends FileLike = File> {
  isFile: false;
  isDirectory: true;
  name: string;
  createReader(): FsDirectoryReaderLike<F>;
}

export type FsEntryLike<F extends FileLike = File> = FsFileEntryLike<F> | FsDirectoryEntryLike<F>;

export interface ScannedFile<F extends FileLike = File> {
  id: string;
  file: F;
  name: string;
  /** e.g. `Music Collection/Michael Jackson/Thriller/03 Thriller.mp3` */
  relativePath: string;
  /** Folder that directly contains the file, e.g. `Music Collection/Michael Jackson/Thriller` */
  folderPath: string;
  /** Selected (top-level) folder this file originated from. Empty for loose files. */
  rootFolder: string;
  kind: ScannedFileKind;
  sizeBytes: number;
}

export type ScannedFolderStatus = 'scanned' | 'partial' | 'empty' | 'error';

export interface ScannedFolder<F extends FileLike = File> {
  id: string;
  name: string;
  path: string;
  rootFolder: string;
  depth: number;
  status: ScannedFolderStatus;
  /** Audio files directly inside this folder. */
  audioCount: number;
  /** Audio files in this folder and every nested folder. */
  totalAudioCount: number;
  imageCount: number;
  unsupportedCount: number;
  nestedFolderCount: number;
  errors: string[];
  /** Retained so that a failed folder can be retried without asking the admin to re-drop it. */
  entry?: FsDirectoryEntryLike<F>;
}

export interface FolderScanResult<F extends FileLike = File> {
  folders: ScannedFolder<F>[];
  files: ScannedFile<F>[];
  /** Top-level folders accepted into this scan. */
  selectedFolderCount: number;
  scannedFolderCount: number;
  failedFolderCount: number;
  emptyFolderCount: number;
  /** Folders discovered below the selected roots. */
  nestedFolderCount: number;
  audioFileCount: number;
  imageFileCount: number;
  unsupportedFileCount: number;
  totalAudioBytes: number;
  /** Top-level folders beyond the per-batch limit. Reported, never silently dropped. */
  overflowFolders: string[];
  /** File-level read failures (distinct from folder read failures). */
  fileErrors: { path: string; error: string }[];
}

export interface ScanProgress {
  foldersDiscovered: number;
  filesDiscovered: number;
  currentPath: string;
}

export interface ScanOptions {
  maxFolders?: number;
  /** How many top-level folders to scan in parallel. */
  concurrency?: number;
  onProgress?: (progress: ScanProgress) => void;
  signal?: { aborted: boolean };
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export function classifyFile(name: string, mimeType = ''): ScannedFileKind {
  const lower = name.toLowerCase();
  if (
    /\.(mp3|m4a|wav|flac|aac|ogg|oga|opus|wma|aif|aiff|alac|weba|m4b|m4p)$/i.test(lower) ||
    mimeType.startsWith('audio/')
  ) {
    return 'audio';
  }
  if (
    /\.(jpe?g|png|webp|gif|bmp|tiff?|avif|svg)$/i.test(lower) ||
    mimeType.startsWith('image/')
  ) {
    return 'image';
  }
  return 'unsupported';
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'name' in err) return String((err as { name: unknown }).name);
  return String(err ?? 'Unknown error');
}

export function makeFileId(relativePath: string, size: number, lastModified = 0): string {
  return `sf-${stableHash(`${relativePath}|${size}|${lastModified}`)}`;
}

function makeScannedFile<F extends FileLike>(
  file: F,
  folderPath: string,
  rootFolder: string
): ScannedFile<F> {
  const relativePath = folderPath ? `${folderPath}/${file.name}` : file.name;
  return {
    id: makeFileId(relativePath, file.size, file.lastModified),
    file,
    name: file.name,
    relativePath,
    folderPath,
    rootFolder,
    kind: classifyFile(file.name, file.type),
    sizeBytes: file.size,
  };
}

// ---------------------------------------------------------------------------
// Drag & drop capture (MUST run synchronously inside the `drop` event handler)
// ---------------------------------------------------------------------------

export interface DataTransferItemLike {
  kind: string;
  webkitGetAsEntry?: () => unknown;
  getAsFile?: () => File | null;
}

export interface DropCapture {
  roots: FsEntryLike[];
  looseFiles: File[];
}

/**
 * Snapshots every dropped entry synchronously. Do NOT `await` before calling this:
 * after the first microtask boundary the browser invalidates the DataTransfer.
 */
export function captureDrop(dataTransfer: {
  items?: ArrayLike<DataTransferItemLike> | null;
  files?: ArrayLike<File> | null;
}): DropCapture {
  const roots: FsEntryLike[] = [];
  const looseFiles: File[] = [];
  const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];

  if (items.length > 0) {
    for (const item of items) {
      if (item.kind !== 'file') continue;
      const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
      if (entry) {
        roots.push(entry as FsEntryLike);
      } else {
        const f = typeof item.getAsFile === 'function' ? item.getAsFile() : null;
        if (f) looseFiles.push(f);
      }
    }
  } else if (dataTransfer.files) {
    looseFiles.push(...Array.from(dataTransfer.files));
  }

  return { roots, looseFiles };
}

// ---------------------------------------------------------------------------
// Recursive traversal
// ---------------------------------------------------------------------------

async function readAllEntries<F extends FileLike>(dir: FsDirectoryEntryLike<F>): Promise<FsEntryLike<F>[]> {
  const reader = dir.createReader();
  const all: FsEntryLike<F>[] = [];
  // readEntries returns at most ~100 entries per call; loop until it returns an empty page.
  for (; ;) {
    const page = await new Promise<FsEntryLike<F>[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (page.length === 0) break;
    all.push(...page);
  }
  return all;
}

interface WalkContext<F extends FileLike> {
  folders: ScannedFolder<F>[];
  files: ScannedFile<F>[];
  fileErrors: { path: string; error: string }[];
  onProgress?: (p: ScanProgress) => void;
  signal?: { aborted: boolean };
}

function newFolder<F extends FileLike>(
  entry: FsDirectoryEntryLike<F>,
  path: string,
  rootFolder: string,
  depth: number
): ScannedFolder<F> {
  return {
    id: `fd-${stableHash(path)}`,
    name: entry.name,
    path,
    rootFolder,
    depth,
    status: 'scanned',
    audioCount: 0,
    totalAudioCount: 0,
    imageCount: 0,
    unsupportedCount: 0,
    nestedFolderCount: 0,
    errors: [],
    entry,
  };
}

async function walkDirectory<F extends FileLike>(
  dir: FsDirectoryEntryLike<F>,
  path: string,
  rootFolder: string,
  depth: number,
  ctx: WalkContext<F>
): Promise<void> {
  const folder = newFolder(dir, path, rootFolder, depth);
  ctx.folders.push(folder);
  ctx.onProgress?.({ foldersDiscovered: ctx.folders.length, filesDiscovered: ctx.files.length, currentPath: path });

  if (depth > MAX_DEPTH) {
    folder.status = 'error';
    folder.errors.push(`Folder nesting deeper than ${MAX_DEPTH} levels was not traversed.`);
    return;
  }

  let children: FsEntryLike<F>[];
  try {
    children = await readAllEntries(dir);
  } catch (err) {
    folder.status = 'error';
    folder.errors.push(`Could not read folder: ${describeError(err)}`);
    return;
  }

  for (const child of children) {
    if (ctx.signal?.aborted) return;
    if (child.isDirectory) {
      await walkDirectory(child, `${path}/${child.name}`, rootFolder, depth + 1, ctx);
    } else {
      try {
        const file = await new Promise<F>((resolve, reject) => child.file(resolve, reject));
        ctx.files.push(makeScannedFile(file, path, rootFolder));
      } catch (err) {
        const message = `Could not read file: ${describeError(err)}`;
        folder.errors.push(`${child.name}: ${message}`);
        ctx.fileErrors.push({ path: `${path}/${child.name}`, error: message });
      }
    }
  }
  ctx.onProgress?.({ foldersDiscovered: ctx.folders.length, filesDiscovered: ctx.files.length, currentPath: path });
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

// ---------------------------------------------------------------------------
// Result finalisation (all counts are derived from the folder/file arrays so
// they can never disagree with each other — merge/retry simply recompute).
// ---------------------------------------------------------------------------

export function finalizeScan<F extends FileLike>(
  folders: ScannedFolder<F>[],
  files: ScannedFile<F>[],
  overflowFolders: string[],
  fileErrors: { path: string; error: string }[]
): FolderScanResult<F> {
  const sortedFolders = [...folders].sort((a, b) => a.path.localeCompare(b.path));
  const byPath = new Map(sortedFolders.map((f) => [f.path, f]));

  for (const f of sortedFolders) {
    f.audioCount = 0;
    f.totalAudioCount = 0;
    f.imageCount = 0;
    f.unsupportedCount = 0;
    f.nestedFolderCount = 0;
  }

  for (const file of files) {
    const direct = byPath.get(file.folderPath);
    if (direct) {
      if (file.kind === 'audio') direct.audioCount++;
      else if (file.kind === 'image') direct.imageCount++;
      else direct.unsupportedCount++;
    }
    if (file.kind === 'audio') {
      // Credit every ancestor for recursive totals.
      let p = file.folderPath;
      while (p) {
        const folder = byPath.get(p);
        if (folder) folder.totalAudioCount++;
        const idx = p.lastIndexOf('/');
        p = idx === -1 ? '' : p.slice(0, idx);
      }
    }
  }

  for (const f of sortedFolders) {
    if (f.depth > 0) {
      const parentPath = f.path.slice(0, f.path.lastIndexOf('/'));
      const parent = byPath.get(parentPath);
      if (parent) parent.nestedFolderCount++;
    }
  }

  for (const f of sortedFolders) {
    const readFailed = f.errors.some((e) => e.startsWith('Could not read folder') || e.startsWith('Folder nesting'));
    if (readFailed) f.status = 'error';
    else if (f.errors.length > 0) f.status = 'partial';
    else if (f.totalAudioCount === 0 && f.imageCount === 0 && f.unsupportedCount === 0 && f.nestedFolderCount === 0) {
      f.status = 'empty';
    } else if (f.totalAudioCount === 0) f.status = 'empty';
    else f.status = 'scanned';
  }

  const audioFiles = files.filter((f) => f.kind === 'audio');

  if (sortedFolders.length === 0 && files.length > 0) {
    const looseFolder: ScannedFolder<F> = {
      id: 'fd-root',
      name: 'Ingested Music Files',
      path: '',
      rootFolder: '',
      depth: 0,
      status: audioFiles.length > 0 ? 'scanned' : 'empty',
      audioCount: audioFiles.length,
      totalAudioCount: audioFiles.length,
      imageCount: files.filter((f) => f.kind === 'image').length,
      unsupportedCount: files.filter((f) => f.kind === 'unsupported').length,
      nestedFolderCount: 0,
      errors: [],
    };
    sortedFolders.push(looseFolder);
  }

  const roots = sortedFolders.filter((f) => f.depth === 0);

  return {
    folders: sortedFolders,
    files,
    selectedFolderCount: roots.length,
    scannedFolderCount: roots.filter((f) => f.status === 'scanned' || f.status === 'partial').length,
    failedFolderCount: sortedFolders.filter((f) => f.status === 'error').length,
    emptyFolderCount: sortedFolders.filter((f) => f.status === 'empty').length,
    nestedFolderCount: sortedFolders.filter((f) => f.depth > 0).length,
    audioFileCount: audioFiles.length,
    imageFileCount: files.filter((f) => f.kind === 'image').length,
    unsupportedFileCount: files.filter((f) => f.kind === 'unsupported').length,
    totalAudioBytes: audioFiles.reduce((sum, f) => sum + f.sizeBytes, 0),
    overflowFolders,
    fileErrors,
  };
}

// ---------------------------------------------------------------------------
// Public scan entry points
// ---------------------------------------------------------------------------

/** Scans a synchronous drop capture. Every selected folder is traversed; one failure never stops the rest. */
export async function scanDrop<F extends FileLike = File>(
  capture: { roots: FsEntryLike<F>[]; looseFiles: F[] },
  options: ScanOptions = {}
): Promise<FolderScanResult<F>> {
  const maxFolders = options.maxFolders ?? MAX_FOLDERS_PER_BATCH;
  const dirRoots = capture.roots.filter((r): r is FsDirectoryEntryLike<F> => r.isDirectory);
  const fileRoots = capture.roots.filter((r): r is FsFileEntryLike<F> => r.isFile);

  const accepted = dirRoots.slice(0, maxFolders);
  const overflowFolders = dirRoots.slice(maxFolders).map((r) => r.name);

  const ctx: WalkContext<F> = {
    folders: [],
    files: [],
    fileErrors: [],
    onProgress: options.onProgress,
    signal: options.signal,
  };

  // De-duplicate identically-named roots so their paths never collide.
  const usedRootNames = new Map<string, number>();
  const uniqueName = (name: string) => {
    const n = usedRootNames.get(name) ?? 0;
    usedRootNames.set(name, n + 1);
    return n === 0 ? name : `${name} (${n + 1})`;
  };

  await runPool(
    accepted.map((entry) => ({ entry, rootName: uniqueName(entry.name) })),
    options.concurrency ?? 6,
    async ({ entry, rootName }) => {
      await walkDirectory(entry, rootName, rootName, 0, ctx);
    }
  );

  for (const fe of fileRoots) {
    try {
      const file = await new Promise<F>((resolve, reject) => fe.file(resolve, reject));
      ctx.files.push(makeScannedFile(file, '', ''));
    } catch (err) {
      ctx.fileErrors.push({ path: fe.name, error: `Could not read file: ${describeError(err)}` });
    }
  }
  for (const f of capture.looseFiles) ctx.files.push(makeScannedFile(f, '', ''));

  return finalizeScan(ctx.folders, ctx.files, overflowFolders, ctx.fileErrors);
}

/**
 * Builds a scan from a flat `<input webkitdirectory>` FileList. The browser already
 * flattened the tree and exposes `webkitRelativePath` ("Root/Sub/Album/track.mp3").
 */
export function scanFileList<F extends FileLike = File>(
  fileList: F[],
  options: { maxFolders?: number } = {}
): FolderScanResult<F> {
  const maxFolders = options.maxFolders ?? MAX_FOLDERS_PER_BATCH;
  const folderMap = new Map<string, ScannedFolder<F>>();
  const files: ScannedFile<F>[] = [];
  const acceptedRoots = new Set<string>();
  const overflow = new Set<string>();

  const ensureFolder = (path: string, rootFolder: string, depth: number) => {
    let folder = folderMap.get(path);
    if (!folder) {
      folder = {
        id: `fd-${stableHash(path)}`,
        name: path.slice(path.lastIndexOf('/') + 1),
        path,
        rootFolder,
        depth,
        status: 'scanned',
        audioCount: 0,
        totalAudioCount: 0,
        imageCount: 0,
        unsupportedCount: 0,
        nestedFolderCount: 0,
        errors: [],
      };
      folderMap.set(path, folder);
    }
    return folder;
  };

  for (const file of fileList) {
    const rel = (file.webkitRelativePath || '').replace(/\\/g, '/');
    const segments = rel ? rel.split('/').filter(Boolean) : [];
    if (segments.length <= 1) {
      files.push(makeScannedFile(file, '', ''));
      continue;
    }
    const root = segments[0];
    if (!acceptedRoots.has(root)) {
      if (acceptedRoots.size >= maxFolders) {
        overflow.add(root);
        continue;
      }
      acceptedRoots.add(root);
    }
    const dirSegments = segments.slice(0, -1);
    for (let i = 0; i < dirSegments.length; i++) {
      ensureFolder(dirSegments.slice(0, i + 1).join('/'), root, i);
    }
    files.push(makeScannedFile(file, dirSegments.join('/'), root));
  }

  return finalizeScan([...folderMap.values()], files, [...overflow], []);
}

/** Merges two scans (e.g. the admin picks folders one after another). Duplicate files collapse by stable id. */
export function mergeScans<F extends FileLike>(
  a: FolderScanResult<F>,
  b: FolderScanResult<F>,
  maxFolders = MAX_FOLDERS_PER_BATCH
): FolderScanResult<F> {
  const folderMap = new Map<string, ScannedFolder<F>>();
  a.folders.forEach((f) => folderMap.set(f.path, { ...f, errors: [...f.errors] }));
  const rootsInA = new Set(a.folders.filter((f) => f.depth === 0).map((f) => f.path));
  const overflow = new Set([...a.overflowFolders, ...b.overflowFolders]);
  const rejectedRoots = new Set<string>();

  let rootCount = rootsInA.size;
  for (const f of b.folders) {
    if (folderMap.has(f.path)) continue;
    if (!rootsInA.has(f.rootFolder) && !rejectedRoots.has(f.rootFolder)) {
      const isNewRoot = ![...folderMap.values()].some((x) => x.rootFolder === f.rootFolder);
      if (isNewRoot) {
        if (rootCount >= maxFolders) {
          rejectedRoots.add(f.rootFolder);
          overflow.add(f.rootFolder);
          continue;
        }
        rootCount++;
      }
    }
    if (rejectedRoots.has(f.rootFolder)) continue;
    folderMap.set(f.path, { ...f, errors: [...f.errors] });
  }

  const fileMap = new Map<string, ScannedFile<F>>();
  a.files.forEach((f) => fileMap.set(f.id, f));
  b.files.forEach((f) => {
    if (f.rootFolder && rejectedRoots.has(f.rootFolder)) return;
    if (!fileMap.has(f.id)) fileMap.set(f.id, f);
  });

  return finalizeScan([...folderMap.values()], [...fileMap.values()], [...overflow], [...a.fileErrors, ...b.fileErrors]);
}

/** Re-scans every folder that failed to read (using the retained directory entry) and merges the result back. */
export async function retryFailedFolders<F extends FileLike>(
  previous: FolderScanResult<F>,
  options: ScanOptions = {}
): Promise<FolderScanResult<F>> {
  const failed = previous.folders.filter((f) => f.status === 'error' && f.entry);
  if (failed.length === 0) return previous;

  const failedPaths = failed.map((f) => f.path);
  const isUnderFailed = (p: string) => failedPaths.some((fp) => p === fp || p.startsWith(`${fp}/`));

  const keptFolders = previous.folders.filter((f) => !isUnderFailed(f.path));
  const keptFiles = previous.files.filter((f) => !isUnderFailed(f.folderPath));

  const ctx: WalkContext<F> = {
    folders: [],
    files: [],
    fileErrors: [],
    onProgress: options.onProgress,
    signal: options.signal,
  };
  await runPool(failed, options.concurrency ?? 6, async (f) => {
    await walkDirectory(f.entry!, f.path, f.rootFolder, f.depth, ctx);
  });

  return finalizeScan(
    [...keptFolders, ...ctx.folders],
    [...keptFiles, ...ctx.files],
    previous.overflowFolders,
    previous.fileErrors.filter((e) => !isUnderFailed(e.path))
  );
}

// ---------------------------------------------------------------------------
// Upload-readiness summary
// ---------------------------------------------------------------------------

export interface ScanSummary {
  foldersSelected: number;
  foldersScanned: number;
  foldersFailed: number;
  foldersEmpty: number;
  nestedFoldersDiscovered: number;
  audioFilesDiscovered: number;
  totalSizeBytes: number;
  unsupportedFiles: number;
  potentialDuplicates: number;
  filesReadyForUpload: number;
  overflowFolders: string[];
}

/** Fingerprint used for cheap pre-upload duplicate detection (the SHA-256 check happens later, during ingestion). */
export function fingerprintFile(name: string, sizeBytes: number): string {
  return `${normalizeKey(name.replace(/\.[^.]+$/, ''))}|${sizeBytes}`;
}

export function summarizeScan<F extends FileLike>(
  result: FolderScanResult<F>,
  existingFingerprints: Set<string> = new Set()
): ScanSummary {
  const seen = new Set<string>();
  let duplicates = 0;
  const audio = result.files.filter((f) => f.kind === 'audio');
  for (const f of audio) {
    const fp = fingerprintFile(f.name, f.sizeBytes);
    if (existingFingerprints.has(fp) || seen.has(fp)) duplicates++;
    seen.add(fp);
  }
  return {
    foldersSelected: result.selectedFolderCount,
    foldersScanned: result.scannedFolderCount,
    foldersFailed: result.failedFolderCount,
    foldersEmpty: result.emptyFolderCount,
    nestedFoldersDiscovered: result.nestedFolderCount,
    audioFilesDiscovered: result.audioFileCount,
    totalSizeBytes: result.totalAudioBytes,
    unsupportedFiles: result.unsupportedFileCount,
    potentialDuplicates: duplicates,
    // Potential duplicates are still uploaded for review (the admin decides); only unsupported files are excluded.
    filesReadyForUpload: result.audioFileCount,
    overflowFolders: result.overflowFolders,
  };
}
