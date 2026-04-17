use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

// ── Managed state ─────────────────────────────────────────────────────────────

struct AppState {
    files: Mutex<Vec<FileEntry>>,
}

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub path: String,
    pub name: String,
    pub ext: String,
    pub size: u64,
    pub size_on_disk: u64,
    pub modified_at: u64,
    pub created_at: u64,
    pub file_type: String,
    pub is_hidden: bool,
}

/// Slim folder tree — no FileEntry leaves, only folder structure.
/// This is what gets sent over IPC (~5 MB for a full C: scan).
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SlimFolderEntry {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub file_count: u64,
    pub folder_count: u64,
    pub children: Vec<SlimFolderEntry>,
    pub depth: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TypeStat {
    pub file_type: String,
    pub size: u64,
    pub count: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ResidueStatEntry {
    pub rule_id: String,
    pub total_size: u64,
    pub count: u64,
    pub files: Vec<FileEntry>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PrecomputedStats {
    pub type_stats: Vec<TypeStat>,
    pub top_files: Vec<FileEntry>,
    pub old_files_count: u64,
    pub old_files_size: u64,
    /// Top 8 extensions within the "unknown" category: [(ext, size)]
    pub unknown_ext_stats: Vec<(String, u64)>,
    /// Builtin residue rule matches — precomputed to avoid O(n×rules) in the frontend
    pub residue_stats: Vec<ResidueStatEntry>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SlimScanResult {
    pub total_size: u64,
    pub file_count: u64,
    pub folder_count: u64,
    pub largest_file: Option<FileEntry>,
    pub largest_folder: Option<SlimFolderEntry>,
    pub issue_count: u32,
    pub tree: SlimFolderEntry,
    pub stats: PrecomputedStats,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileChunk {
    pub files: Vec<FileEntry>,
    pub total: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub files_found: u64,
    pub total_size: u64,
    pub current_path: String,
    pub elapsed_ms: u64,
    pub mode: String,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ExcludeRule {
    pub pattern: String,
    #[serde(rename = "type")]
    pub rule_type: String,
    pub enabled: bool,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn unix_ms(t: SystemTime) -> u64 {
    t.duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn classify_ext(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        // Images
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "svg" | "ico" | "tiff" | "tif"
        | "heic" | "heif" | "avif" | "jxl" | "raw" | "cr2" | "cr3" | "nef" | "arw"
        | "dng" | "orf" | "rw2" | "ppm" | "pgm" | "pbm" | "exr" | "hdr" => "image",

        // Video
        "mp4" | "mkv" | "avi" | "mov" | "wmv" | "flv" | "webm" | "m4v" | "mpg" | "mpeg"
        | "mts" | "m2ts" | "vob" | "3gp" | "3g2" | "rmvb" | "rm" | "ogv"
        | "divx" | "xvid" => "video",

        // Audio
        "mp3" | "flac" | "wav" | "aac" | "ogg" | "m4a" | "wma" | "opus" | "ape" | "alac"
        | "aiff" | "aif" | "mid" | "midi" | "mka" | "ra" | "amr" => "audio",

        // Documents
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "md" | "rtf"
        | "odt" | "ods" | "odp" | "pages" | "numbers" | "key" | "epub" | "mobi" | "azw"
        | "azw3" | "djvu" | "tex" | "rst" | "org" | "nfo" | "csv" | "tsv" => "document",

        // Archives
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "zst" | "lz4" | "lzma"
        | "cab" | "iso" | "img" | "dmg" | "pkg" | "z" | "lzh" | "arj" | "ace"
        | "tar.gz" | "tar.bz2" | "tar.xz" | "tar.zst" => "archive",

        // Installers / executables
        "exe" | "msi" | "msix" | "appx" | "deb" | "rpm" | "appimage" | "flatpak" | "snap"
        | "apk" | "ipa" | "xap" | "crx" => "installer",

        // Code & config
        "rs" | "py" | "js" | "ts" | "tsx" | "jsx" | "go" | "java" | "c" | "cpp" | "cc"
        | "cxx" | "h" | "hpp" | "cs" | "rb" | "php" | "swift" | "kt" | "kts" | "scala"
        | "clj" | "cljs" | "elm" | "ex" | "exs" | "erl" | "hrl" | "hs" | "lhs" | "lua"
        | "pl" | "pm" | "r" | "jl" | "nim" | "zig" | "v" | "dart" | "groovy" | "gradle"
        | "sh" | "bash" | "zsh" | "fish" | "ps1" | "psm1" | "bat" | "cmd"
        | "html" | "htm" | "css" | "scss" | "sass" | "less" | "styl"
        | "json" | "json5" | "yaml" | "yml" | "toml" | "xml" | "ini" | "cfg" | "conf"
        | "env" | "properties" | "lock" | "sum" | "mod"
        | "vue" | "svelte" | "astro" | "mdx" => "code",

        // Database
        "db" | "sqlite" | "sqlite3" | "mdb" | "accdb" | "frm" | "myd" | "myi"
        | "ibd" | "dbf" | "ndf" | "ldf" | "mdf" => "database",

        // Design & creative
        "psd" | "psb" | "ai" | "indd" | "idml" | "sketch" | "fig" | "xd" | "afdesign"
        | "afphoto" | "afpub" | "cdr" | "xcf" | "clip" | "csp" | "procreate"
        | "blend" | "c4d" | "max" | "maya" | "ma" | "mb" => "design",

        // 3-D models & game assets
        "glb" | "gltf" | "fbx" | "obj" | "dae" | "stl" | "ply" | "3ds" | "x3d"
        | "abc" | "usd" | "usda" | "usdc" | "usdz"
        | "unity" | "prefab" | "asset" | "pak" | "vpk" | "bsp" | "pk3" => "model",

        // Fonts
        "ttf" | "otf" | "woff" | "woff2" | "eot" | "fon" | "bdf" | "pfb" | "pfm" => "font",

        // Virtual machines & disk images (already in archive but these are big/specific)
        "vmdk" | "vhd" | "vhdx" | "vdi" | "qcow" | "qcow2" | "ovf" | "ova" => "disk_image",

        // System / binary / unknown-binary
        "dll" | "so" | "dylib" | "sys" | "drv" | "ocx" | "ax"
        | "bin" | "hex" | "dat" | "data" | "dump" | "dmp"
        | "bak" | "old" | "orig" | "swp" | "swo" => "system",

        // Cache / temp
        "cache" | "tmp" | "temp" | "log" | "part" | "crdownload" | "partial"
        | "thumbnails" | "ds_store" => "cache",

        _ => "unknown",
    }
}

fn is_hidden_name(name: &str) -> bool {
    name.starts_with('.')
}

fn should_exclude(path: &Path, rules: &[ExcludeRule]) -> bool {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    for rule in rules {
        if !rule.enabled {
            continue;
        }
        match rule.rule_type.as_str() {
            "glob" => {
                let pat = rule.pattern.trim_end_matches('/');
                if name == pat {
                    return true;
                }
                // Simple *.ext wildcard
                if let Some(suffix) = pat.strip_prefix('*') {
                    if name.ends_with(suffix) {
                        return true;
                    }
                }
            }
            "path" => {
                if name == rule.pattern.as_str() {
                    return true;
                }
            }
            _ => {}
        }
    }
    false
}

// ── Recursive scan ───────────────────────────────────────────────────────────

struct ScanState {
    files_found: AtomicU64,
    total_size: AtomicU64,
    start_ms: u64,
    app: AppHandle,
}

/// Compute PrecomputedStats from the flat file list in a single pass.
fn compute_residue(files: &[FileEntry]) -> Vec<ResidueStatEntry> {
    type MatchFn = fn(&FileEntry) -> bool;
    let rules: &[(&str, MatchFn)] = &[
        ("ds_store",         |f| f.name == ".DS_Store"),
        ("dot_underscore",   |f| f.name.starts_with("._")),
        ("thumbs_db",        |f| f.name.to_lowercase() == "thumbs.db"),
        ("desktop_ini",      |f| f.name.to_lowercase() == "desktop.ini"),
        ("tmp",              |f| matches!(f.ext.to_lowercase().as_str(), "tmp" | "temp")),
        ("download_partial", |f| matches!(f.ext.to_lowercase().as_str(), "crdownload" | "part" | "partial")),
    ];
    rules
        .iter()
        .filter_map(|(id, matcher)| {
            let matched: Vec<FileEntry> = files.iter().filter(|f| matcher(f)).cloned().collect();
            if matched.is_empty() {
                return None;
            }
            let total_size: u64 = matched.iter().map(|f| f.size).sum();
            let count = matched.len() as u64;
            Some(ResidueStatEntry { rule_id: id.to_string(), total_size, count, files: matched })
        })
        .collect()
}

fn compute_stats(files: &[FileEntry]) -> PrecomputedStats {
    let one_year_ago = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
        .saturating_sub(365 * 24 * 3600 * 1000);

    let mut type_map: HashMap<&str, (u64, u64)> = HashMap::new(); // type → (size, count)
    let mut unknown_ext_map: HashMap<String, u64> = HashMap::new();
    let mut old_files_count = 0u64;
    let mut old_files_size = 0u64;

    for f in files {
        let e = type_map.entry(f.file_type.as_str()).or_insert((0, 0));
        e.0 += f.size;
        e.1 += 1;
        if f.file_type == "unknown" {
            *unknown_ext_map.entry(f.ext.clone()).or_insert(0) += f.size;
        }
        if f.modified_at < one_year_ago {
            old_files_count += 1;
            old_files_size += f.size;
        }
    }

    let mut type_stats: Vec<TypeStat> = type_map
        .into_iter()
        .map(|(ft, (size, count))| TypeStat { file_type: ft.to_string(), size, count })
        .collect();
    type_stats.sort_by(|a, b| b.size.cmp(&a.size));

    let mut unknown_ext_stats: Vec<(String, u64)> = unknown_ext_map.into_iter().collect();
    unknown_ext_stats.sort_by(|a, b| b.1.cmp(&a.1));
    unknown_ext_stats.truncate(8);

    let mut top_files: Vec<FileEntry> = files
        .iter()
        .filter(|f| f.size > 0)
        .cloned()
        .collect();
    top_files.sort_by(|a, b| b.size.cmp(&a.size));
    top_files.truncate(20);

    let residue_stats = compute_residue(files);

    PrecomputedStats { type_stats, top_files, old_files_count, old_files_size, unknown_ext_stats, residue_stats }
}

/// Only parallelize shallow levels; deep directories fall back to sequential
/// to avoid spawning hundreds of thousands of rayon tasks (e.g. WinSxS).
const PARALLEL_DEPTH_LIMIT: u32 = 3;

/// Returns true if the entry is a reparse point (junction, symlink) on Windows,
/// or a symlink on other platforms. These must be skipped to avoid cycles.
fn is_reparse_point(entry: &std::fs::DirEntry) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
        entry
            .metadata()
            .map(|m| m.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0)
            .unwrap_or(false)
    }
    #[cfg(not(windows))]
    {
        entry.file_type().map(|ft| ft.is_symlink()).unwrap_or(false)
    }
}

/// Returns (SlimFolderEntry, flat Vec<FileEntry> collected from this subtree).
fn scan_dir_parallel(
    dir: &Path,
    depth: u32,
    rules: &[ExcludeRule],
    state: &Arc<ScanState>,
) -> (SlimFolderEntry, Vec<FileEntry>) {
    let t0 = std::time::Instant::now();
    let dir_str = dir.to_string_lossy().to_string();

    if depth <= 1 {
        eprintln!("[scan] → depth={depth}  {dir_str}");
    }

    let name = dir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| dir.to_string_lossy().to_string());

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) => {
            if depth <= 1 {
                eprintln!("[scan] ✗ read_dir failed ({e})  {dir_str}");
            }
            return (SlimFolderEntry {
                path: dir_str,
                name,
                size: 0,
                file_count: 0,
                folder_count: 0,
                children: Vec::new(),
                depth,
            }, vec![]);
        }
    };

    let mut file_entries: Vec<std::fs::DirEntry> = Vec::new();
    let mut dir_entries: Vec<std::fs::DirEntry> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if should_exclude(&path, rules) {
            continue;
        }
        if is_reparse_point(&entry) {
            continue;
        }
        let ft = match entry.file_type() {
            Ok(t) => t,
            Err(_) => continue,
        };
        if ft.is_dir() {
            dir_entries.push(entry);
        } else if ft.is_file() {
            file_entries.push(entry);
        }
    }

    // Log if just listing the directory entries was slow
    let list_elapsed = t0.elapsed();
    if list_elapsed.as_secs() >= 2 {
        eprintln!(
            "[scan] SLOW list  {:.1}s  files={} dirs={}  {dir_str}",
            list_elapsed.as_secs_f32(),
            file_entries.len(),
            dir_entries.len()
        );
    }

    file_entries.sort_by(|a, b| a.file_name().cmp(&b.file_name()));
    dir_entries.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

    // Process files sequentially (metadata-only, fast)
    let mut local_files: Vec<FileEntry> = Vec::new();
    let mut folder_size: u64 = 0;
    let mut folder_file_count: u64 = 0;

    for entry in &file_entries {
        let path = entry.path();
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let size = meta.len();
        let modified_at = meta.modified().map(unix_ms).unwrap_or(0);
        let created_at = meta.created().map(unix_ms).unwrap_or(0);
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let ext = path
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default();
        let file_type = classify_ext(&ext).to_string();
        let is_hidden = is_hidden_name(&name);

        let file = FileEntry {
            path: path.to_string_lossy().to_string(),
            size,
            size_on_disk: size,
            modified_at,
            created_at,
            file_type,
            is_hidden,
            name,
            ext,
        };

        let count = state.files_found.fetch_add(1, Ordering::Relaxed) + 1;
        state.total_size.fetch_add(size, Ordering::Relaxed);

        if count % 200 == 0 {
            let elapsed = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0)
                .saturating_sub(state.start_ms);
            let _ = state.app.emit(
                "scan-progress",
                ScanProgress {
                    files_found: count,
                    total_size: state.total_size.load(Ordering::Relaxed),
                    current_path: path.to_string_lossy().to_string(),
                    elapsed_ms: elapsed,
                    mode: "compat".to_string(),
                },
            );
        }

        folder_size += size;
        folder_file_count += 1;
        local_files.push(file);
    }

    // Process subdirs: parallel for shallow levels, sequential for deep ones
    let sub_results: Vec<(SlimFolderEntry, Vec<FileEntry>)> = if depth < PARALLEL_DEPTH_LIMIT {
        dir_entries
            .par_iter()
            .map(|entry| {
                let count = state.files_found.fetch_add(1, Ordering::Relaxed) + 1;
                if count % 200 == 0 {
                    let elapsed = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0)
                        .saturating_sub(state.start_ms);
                    let _ = state.app.emit(
                        "scan-progress",
                        ScanProgress {
                            files_found: count,
                            total_size: state.total_size.load(Ordering::Relaxed),
                            current_path: entry.path().to_string_lossy().to_string(),
                            elapsed_ms: elapsed,
                            mode: "compat".to_string(),
                        },
                    );
                }
                scan_dir_parallel(&entry.path(), depth + 1, rules, state)
            })
            .collect()
    } else {
        dir_entries
            .iter()
            .map(|entry| {
                let count = state.files_found.fetch_add(1, Ordering::Relaxed) + 1;
                if count % 200 == 0 {
                    let elapsed = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0)
                        .saturating_sub(state.start_ms);
                    let _ = state.app.emit(
                        "scan-progress",
                        ScanProgress {
                            files_found: count,
                            total_size: state.total_size.load(Ordering::Relaxed),
                            current_path: entry.path().to_string_lossy().to_string(),
                            elapsed_ms: elapsed,
                            mode: "compat".to_string(),
                        },
                    );
                }
                scan_dir_parallel(&entry.path(), depth + 1, rules, state)
            })
            .collect()
    };

    let mut folder_folder_count: u64 = 0;
    let mut slim_children: Vec<SlimFolderEntry> = Vec::new();

    for (sub_slim, sub_files) in sub_results {
        folder_size += sub_slim.size;
        folder_file_count += sub_slim.file_count;
        folder_folder_count += 1 + sub_slim.folder_count;
        local_files.extend(sub_files);
        slim_children.push(sub_slim);
    }

    // Sort slim children by size descending for treemap
    slim_children.sort_by(|a, b| b.size.cmp(&a.size));

    let total_elapsed = t0.elapsed();
    if depth <= 1 {
        eprintln!(
            "[scan] ✓ depth={depth}  {:.1}s  files={} dirs={}  size={:.0}MB  {dir_str}",
            total_elapsed.as_secs_f32(),
            folder_file_count,
            folder_folder_count,
            folder_size as f64 / 1_048_576.0,
        );
    } else if total_elapsed.as_secs() >= 3 {
        eprintln!(
            "[scan] SLOW depth={depth}  {:.1}s  files={} dirs={}  {dir_str}",
            total_elapsed.as_secs_f32(),
            folder_file_count,
            folder_folder_count,
        );
    }

    (SlimFolderEntry {
        path: dir.to_string_lossy().to_string(),
        name,
        size: folder_size,
        file_count: folder_file_count,
        folder_count: folder_folder_count,
        children: slim_children,
        depth,
    }, local_files)
}


// ── Tauri commands ───────────────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateCluster {
    pub id: String,
    pub hash: String,
    pub file_size: u64,
    pub file_paths: Vec<String>,
    pub reclaimable: u64,
    pub suggested_keep: String,
}

fn quick_hash(path: &str, size: u64) -> Option<Vec<u8>> {
    let mut f = std::fs::File::open(path).ok()?;
    let cap = (65536_u64).min(size) as usize;
    let mut buf = vec![0u8; cap];
    f.read_exact(&mut buf).ok()?;
    Some(blake3::hash(&buf).as_bytes().to_vec())
}

fn full_hash(path: &str) -> Option<String> {
    let mut hasher = blake3::Hasher::new();
    let mut f = std::fs::File::open(path).ok()?;
    let mut buf = vec![0u8; 1024 * 1024];
    loop {
        let n = f.read(&mut buf).ok()?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    Some(hasher.finalize().to_hex().to_string())
}

#[tauri::command]
async fn scan_folder(
    app: AppHandle,
    app_state: tauri::State<'_, AppState>,
    roots: Vec<String>,
    exclude_rules: Vec<ExcludeRule>,
) -> Result<SlimScanResult, String> {
    let start_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    eprintln!("[scan] start  roots={:?}", roots);

    // Clear previous scan files
    app_state.files.lock().unwrap().clear();

    let scan_state = Arc::new(ScanState {
        files_found: AtomicU64::new(0),
        total_size: AtomicU64::new(0),
        start_ms,
        app: app.clone(),
    });

    let scan_state_clone = Arc::clone(&scan_state);
    // Spawn on a thread with a large stack — the recursive scan_dir_parallel can
    // go hundreds of levels deep (node_modules, WinSxS …) and overflows the
    // default ~1 MB Windows stack.  64 MB gives plenty of headroom.
    let (slim_tree, all_files) = tauri::async_runtime::spawn_blocking(move || {
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::Builder::new()
            .stack_size(64 * 1024 * 1024)
            .spawn(move || {
                let result = if roots.len() == 1 {
                    let root_path = std::path::PathBuf::from(&roots[0]);
                    scan_dir_parallel(&root_path, 0, &exclude_rules, &scan_state_clone)
                } else {
                    let mut virtual_slim = SlimFolderEntry {
                        path: roots.join(", "),
                        name: "Selected Folders".to_string(),
                        size: 0,
                        file_count: 0,
                        folder_count: 0,
                        children: Vec::new(),
                        depth: 0,
                    };
                    let mut all: Vec<FileEntry> = Vec::new();
                    for root in &roots {
                        let root_path = std::path::PathBuf::from(root);
                        let (sub_slim, sub_files) =
                            scan_dir_parallel(&root_path, 1, &exclude_rules, &scan_state_clone);
                        virtual_slim.size += sub_slim.size;
                        virtual_slim.file_count += sub_slim.file_count;
                        virtual_slim.folder_count += 1 + sub_slim.folder_count;
                        virtual_slim.children.push(sub_slim);
                        all.extend(sub_files);
                    }
                    (virtual_slim, all)
                };
                let _ = tx.send(result);
            })
            .expect("failed to spawn scan thread")
            .join()
            .expect("scan thread panicked");
        rx.recv().expect("scan result channel closed")
    })
    .await
    .map_err(|e| e.to_string())?;

    let files_found = scan_state.files_found.load(Ordering::Relaxed);
    let total_size = scan_state.total_size.load(Ordering::Relaxed);
    eprintln!(
        "[scan] tree built  files={}  size={:.1}GB — computing stats...",
        files_found,
        total_size as f64 / 1_073_741_824.0
    );

    let stats = compute_stats(&all_files);
    let largest_file = stats.top_files.first().cloned();
    let largest_folder = slim_tree.children.iter().max_by_key(|f| f.size).cloned();

    // Store flat file list in managed state for on-demand access
    *app_state.files.lock().unwrap() = all_files;
    eprintln!("[scan] done — returning slim result");

    Ok(SlimScanResult {
        total_size,
        file_count: files_found,
        folder_count: slim_tree.folder_count,
        largest_file,
        largest_folder,
        issue_count: 0,
        tree: slim_tree,
        stats,
    })
}

/// Returns a paginated slice of the flat file list stored in managed state.
#[tauri::command]
async fn get_files_chunk(
    app_state: tauri::State<'_, AppState>,
    offset: u64,
    limit: u64,
) -> Result<FileChunk, String> {
    let files = app_state.files.lock().unwrap();
    let total = files.len() as u64;
    let start = (offset as usize).min(files.len());
    let end = ((offset + limit) as usize).min(files.len());
    Ok(FileChunk { files: files[start..end].to_vec(), total })
}

/// Returns all FileEntry objects whose parent directory equals `path`.
/// Used by TreemapCanvas to lazy-load file leaves for the current folder.
#[tauri::command]
async fn get_folder_files(
    app_state: tauri::State<'_, AppState>,
    path: String,
) -> Result<Vec<FileEntry>, String> {
    let files = app_state.files.lock().unwrap();
    let result: Vec<FileEntry> = files
        .iter()
        .filter(|f| {
            std::path::Path::new(&f.path)
                .parent()
                .map(|p| p.to_string_lossy() == path.as_str())
                .unwrap_or(false)
        })
        .cloned()
        .collect();
    Ok(result)
}

#[tauri::command]
async fn find_duplicates(
    app: AppHandle,
    app_state: tauri::State<'_, AppState>,
) -> Result<Vec<DuplicateCluster>, String> {
    use rayon::prelude::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    let paths: Vec<String> = app_state
        .files
        .lock()
        .unwrap()
        .iter()
        .map(|f| f.path.clone())
        .collect();

    // ── Phase 1: group by size (metadata only, very fast) ────────────────────
    let mut size_groups: HashMap<u64, Vec<String>> = HashMap::new();
    for path in &paths {
        if let Ok(meta) = std::fs::metadata(path) {
            let size = meta.len();
            if size > 0 {
                size_groups.entry(size).or_default().push(path.clone());
            }
        }
    }

    let candidates: Vec<(u64, Vec<String>)> = size_groups
        .into_iter()
        .filter(|(_, p)| p.len() >= 2)
        .collect();

    if candidates.is_empty() {
        return Ok(vec![]);
    }

    let total_candidates: usize = candidates.iter().map(|(_, p)| p.len()).sum();
    let processed = Arc::new(AtomicUsize::new(0));

    // ── Phase 2: quick hash in parallel (first 64 KB per file) ───────────────
    // Flatten all candidate paths with their sizes for parallel processing
    let flat: Vec<(u64, String)> = candidates
        .iter()
        .flat_map(|(size, paths)| paths.iter().map(move |p| (*size, p.clone())))
        .collect();

    let app_ref = &app;
    let processed_ref = &processed;

    let quick_results: Vec<(u64, String, Vec<u8>)> = flat
        .par_iter()
        .filter_map(|(size, path)| {
            let h = quick_hash(path, *size)?;
            let done = processed_ref.fetch_add(1, Ordering::Relaxed) + 1;
            if done % 200 == 0 {
                let _ = app_ref.emit("dup-progress", serde_json::json!({
                    "processed": done, "total": total_candidates * 2
                }));
            }
            Some((*size, path.clone(), h))
        })
        .collect();

    // Group by (size, quick_hash) to find quick-hash collisions
    let mut quick_groups: HashMap<(u64, Vec<u8>), Vec<String>> = HashMap::new();
    for (size, path, h) in quick_results {
        quick_groups.entry((size, h)).or_default().push(path);
    }

    let full_candidates: Vec<(u64, Vec<String>)> = quick_groups
        .into_iter()
        .filter(|(_, p)| p.len() >= 2)
        .map(|((size, _quick_hash), paths)| (size, paths))
        .collect();

    // ── Phase 3: full hash in parallel (only quick-hash collisions) ──────────
    let full_flat: Vec<(u64, String)> = full_candidates
        .iter()
        .flat_map(|(size, paths)| paths.iter().map(move |p| (*size, p.clone())))
        .collect();

    let full_results: Vec<(u64, String, String)> = full_flat
        .par_iter()
        .filter_map(|(size, path)| {
            let h = full_hash(path)?;
            let done = processed_ref.fetch_add(1, Ordering::Relaxed) + 1;
            if done % 50 == 0 {
                let _ = app_ref.emit("dup-progress", serde_json::json!({
                    "processed": done, "total": total_candidates * 2
                }));
            }
            Some((*size, path.clone(), h))
        })
        .collect();

    // Group by (size, full_hash)
    let mut hash_groups: HashMap<String, Vec<String>> = HashMap::new();
    for (size, path, h) in full_results {
        let key = format!("{}-{}", size, h);
        hash_groups.entry(key).or_default().push(path);
    }

    // ── Build clusters ────────────────────────────────────────────────────────
    let mut clusters: Vec<DuplicateCluster> = hash_groups
        .into_iter()
        .filter(|(_, p)| p.len() >= 2)
        .enumerate()
        .map(|(i, (hash, mut file_paths))| {
            file_paths.sort_by(|a, b| {
                let ta = std::fs::metadata(a).and_then(|m| m.modified()).ok();
                let tb = std::fs::metadata(b).and_then(|m| m.modified()).ok();
                tb.cmp(&ta)
            });
            let file_size = std::fs::metadata(&file_paths[0]).map(|m| m.len()).unwrap_or(0);
            let reclaimable = file_size * (file_paths.len() as u64 - 1);
            let suggested_keep = file_paths[0].clone();
            DuplicateCluster { id: format!("dup-{}", i), hash, file_size, reclaimable, suggested_keep, file_paths }
        })
        .collect();

    clusters.sort_by(|a, b| b.reclaimable.cmp(&a.reclaimable));
    let _ = app.emit("dup-progress", serde_json::json!({
        "processed": total_candidates * 2, "total": total_candidates * 2
    }));
    Ok(clusters)
}

#[tauri::command]
async fn move_to_trash(paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut failed: Vec<String> = vec![];
    for path in &paths {
        if let Err(e) = trash::delete(path) {
            failed.push(format!("{}: {}", path, e));
        }
    }
    Ok(failed)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState { files: Mutex::new(vec![]) })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_folder,
            get_files_chunk,
            get_folder_files,
            find_duplicates,
            move_to_trash
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
