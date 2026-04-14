use serde::{Deserialize, Serialize};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

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

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FolderEntry {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub file_count: u64,
    pub folder_count: u64,
    pub children: Vec<FolderChild>,
    pub depth: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum FolderChild {
    #[serde(rename = "folder")]
    Folder(FolderEntry),
    #[serde(rename = "file")]
    File(FileEntry),
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

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub total_size: u64,
    pub file_count: u64,
    pub folder_count: u64,
    pub largest_file: Option<FileEntry>,
    pub largest_folder: Option<FolderEntry>,
    pub issue_count: u32,
    pub tree: FolderEntry,
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
    files_found: u64,
    total_size: u64,
    largest_file: Option<FileEntry>,
    start_ms: u64,
}

fn scan_dir_recursive(
    dir: &Path,
    depth: u32,
    rules: &[ExcludeRule],
    state: &mut ScanState,
    app: &AppHandle,
) -> FolderEntry {
    let name = dir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| dir.to_string_lossy().to_string());

    let mut folder = FolderEntry {
        path: dir.to_string_lossy().to_string(),
        name,
        size: 0,
        file_count: 0,
        folder_count: 0,
        children: Vec::new(),
        depth,
    };

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return folder,
    };

    let mut sub_entries: Vec<std::fs::DirEntry> = entries.flatten().collect();
    sub_entries.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

    for entry in sub_entries {
        let path = entry.path();
        if should_exclude(&path, rules) {
            continue;
        }

        let ft = match entry.file_type() {
            Ok(t) => t,
            Err(_) => continue,
        };

        if ft.is_dir() {
            state.files_found += 1;
            if state.files_found % 200 == 0 {
                let elapsed = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0)
                    .saturating_sub(state.start_ms);
                let _ = app.emit(
                    "scan-progress",
                    ScanProgress {
                        files_found: state.files_found,
                        total_size: state.total_size,
                        current_path: path.to_string_lossy().to_string(),
                        elapsed_ms: elapsed,
                        mode: "compat".to_string(),
                    },
                );
            }

            let sub = scan_dir_recursive(&path, depth + 1, rules, state, app);
            folder.size += sub.size;
            folder.file_count += sub.file_count;
            folder.folder_count += 1 + sub.folder_count;
            folder.children.push(FolderChild::Folder(sub));
        } else if ft.is_file() {
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

            if state.largest_file.as_ref().map(|f| size > f.size).unwrap_or(true) {
                state.largest_file = Some(file.clone());
            }

            folder.size += size;
            folder.file_count += 1;
            state.files_found += 1;
            state.total_size += size;
            folder.children.push(FolderChild::File(file));
        }
    }

    // Sort children by size descending for treemap
    folder.children.sort_by(|a, b| {
        let sa = match a {
            FolderChild::Folder(f) => f.size,
            FolderChild::File(f) => f.size,
        };
        let sb = match b {
            FolderChild::Folder(f) => f.size,
            FolderChild::File(f) => f.size,
        };
        sb.cmp(&sa)
    });

    folder
}

// ── Tauri commands ───────────────────────────────────────────────────────────

#[tauri::command]
async fn scan_folder(
    app: AppHandle,
    roots: Vec<String>,
    exclude_rules: Vec<ExcludeRule>,
) -> Result<ScanResult, String> {
    let start_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let mut state = ScanState {
        files_found: 0,
        total_size: 0,
        largest_file: None,
        start_ms,
    };

    let tree = if roots.len() == 1 {
        let root_path = Path::new(&roots[0]);
        scan_dir_recursive(root_path, 0, &exclude_rules, &mut state, &app)
    } else {
        let mut virtual_root = FolderEntry {
            path: roots.join(", "),
            name: "Selected Folders".to_string(),
            size: 0,
            file_count: 0,
            folder_count: 0,
            children: Vec::new(),
            depth: 0,
        };
        for root in &roots {
            let root_path = Path::new(root);
            let sub = scan_dir_recursive(root_path, 1, &exclude_rules, &mut state, &app);
            virtual_root.size += sub.size;
            virtual_root.file_count += sub.file_count;
            virtual_root.folder_count += 1 + sub.folder_count;
            virtual_root.children.push(FolderChild::Folder(sub));
        }
        virtual_root
    };

    let largest_folder = tree
        .children
        .iter()
        .filter_map(|c| {
            if let FolderChild::Folder(f) = c {
                Some(f.clone())
            } else {
                None
            }
        })
        .max_by_key(|f| f.size);

    Ok(ScanResult {
        total_size: state.total_size,
        file_count: state.files_found,
        folder_count: tree.folder_count,
        largest_file: state.largest_file,
        largest_folder,
        issue_count: 0,
        tree,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![scan_folder])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
