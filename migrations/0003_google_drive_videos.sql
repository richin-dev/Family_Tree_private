ALTER TABLE google_drive_settings ADD COLUMN video_folder_id TEXT;

CREATE TABLE IF NOT EXISTS family_videos (
  video_id TEXT PRIMARY KEY,
  drive_file_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'video/mp4',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS family_video_uploads (
  upload_id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  total_bytes INTEGER NOT NULL,
  next_offset INTEGER NOT NULL DEFAULT 0,
  session_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
