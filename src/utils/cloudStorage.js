import { supabase } from "../supabase.js";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
export const OVERALL_CLOUD_STORAGE_CAP = 45 * 1024 * 1024; // 45 MB total cloud storage capacity

export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Calculates the exact overall cloud data footprint across:
 * 1. Root storage bucket files (images, canvas drawings, pasted media)
 * 2. Drive storage folder files (/drive/*)
 * 3. Database notes payload size
 */
export async function getOverallCloudUsage() {
  try {
    const [rootFilesRes, driveFilesRes, notesRes] = await Promise.all([
      supabase.storage.from("images").list("", { limit: 1000 }),
      supabase.storage.from("images").list("drive", { limit: 1000 }),
      supabase.from("notes").select("id, content, metadata")
    ]);

    const rootFiles = (rootFilesRes.data || []).filter(f => f.name && f.name !== ".emptyFolderPlaceholder" && f.name !== "drive");
    const driveFiles = (driveFilesRes.data || []).filter(f => f.name && f.name !== ".emptyFolderPlaceholder");

    const rootMediaBytes = rootFiles.reduce((acc, f) => acc + (f.metadata?.size || 0), 0);
    const driveFilesBytes = driveFiles.reduce((acc, f) => acc + (f.metadata?.size || 0), 0);
    const dbNotesBytes = (notesRes.data || []).reduce((acc, n) => acc + (n.content?.length || 0) + (JSON.stringify(n.metadata || {}).length), 0);

    const totalCloudBytes = rootMediaBytes + driveFilesBytes + dbNotesBytes;

    return {
      rootFiles,
      driveFiles,
      rootMediaBytes,
      driveFilesBytes,
      dbNotesBytes,
      totalCloudBytes,
      availableBytes: Math.max(0, OVERALL_CLOUD_STORAGE_CAP - totalCloudBytes),
      isQuotaExceeded: totalCloudBytes >= OVERALL_CLOUD_STORAGE_CAP
    };
  } catch (err) {
    console.error("Failed to calculate overall cloud usage:", err);
    return {
      rootFiles: [],
      driveFiles: [],
      rootMediaBytes: 0,
      driveFilesBytes: 0,
      dbNotesBytes: 0,
      totalCloudBytes: 0,
      availableBytes: OVERALL_CLOUD_STORAGE_CAP,
      isQuotaExceeded: false
    };
  }
}
