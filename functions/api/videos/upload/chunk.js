import { json } from '../../../../lib/auth.js';
import { signedInAdmin, unauthorizedAdmin } from '../../../../lib/access.js';
import { driveRequest } from '../../../../lib/google-drive.js';

const CHUNK_SIZE = 8 * 1024 * 1024;
const RANGE = /^bytes (\d+)-(\d+)\/(\d+)$/;

export async function onRequestPost(ctx) {
  const user = await signedInAdmin(ctx);
  if (!user) return unauthorizedAdmin();
  const id = ctx.request.headers.get('X-Upload-Id') || '', match = RANGE.exec(ctx.request.headers.get('Content-Range') || '');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !match) return json({error:'Invalid upload chunk details.'},400);
  const start = Number(match[1]), end = Number(match[2]), total = Number(match[3]), length = end - start + 1;
  if (!Number.isSafeInteger(length) || length < 1 || length > CHUNK_SIZE || end < start) return json({error:'Upload chunks must be 8 MB or smaller.'},413);
  const declared = Number(ctx.request.headers.get('Content-Length') || 0);
  if (declared && declared !== length) return json({error:'Upload chunk size does not match its range.'},400);
  try {
    const row = await ctx.env.FAMILY_DB.prepare('SELECT * FROM family_video_uploads WHERE upload_id=?').bind(id).first();
    if (!row || row.total_bytes !== total) return json({error:'This upload session expired. Start the upload again.'},404);
    if (start !== row.next_offset || end >= total || (end + 1 < total && length % (256 * 1024) !== 0)) return json({error:'Upload chunk is out of order or not aligned. Start the upload again.'},409);
    const result = await driveRequest(ctx,row.session_url,{method:'PUT',redirect:'manual',headers:{'Content-Type':'video/mp4','Content-Length':String(length),'Content-Range':'bytes '+start+'-'+end+'/'+total},body:ctx.request.body});
    if (result.status === 308) {
      const received = /^bytes=0-(\d+)$/.exec(result.headers.get('Range') || '');
      const nextOffset = received ? Number(received[1]) + 1 : 0;
      await ctx.env.FAMILY_DB.prepare('UPDATE family_video_uploads SET next_offset=? WHERE upload_id=?').bind(nextOffset,id).run();
      return json({done:false,nextOffset});
    }
    if (!result.ok) return json({error:'Google Drive could not save a video chunk. Retry the upload.'},503);
    const file = await result.json();
    if (!file.id) return json({error:'Google Drive did not confirm the completed video.'},503);
    const existing = await ctx.env.FAMILY_DB.prepare('SELECT drive_file_id FROM family_videos WHERE video_id=?').bind(row.video_id).first();
    await ctx.env.FAMILY_DB.prepare('INSERT INTO family_videos(video_id,drive_file_id,display_name,mime_type) VALUES(?,?,?,?) ON CONFLICT(video_id) DO UPDATE SET drive_file_id=excluded.drive_file_id,display_name=excluded.display_name,mime_type=excluded.mime_type,created_at=CURRENT_TIMESTAMP')
      .bind(row.video_id,file.id,row.display_name,'video/mp4').run();
    await ctx.env.FAMILY_DB.prepare('DELETE FROM family_video_uploads WHERE upload_id=?').bind(id).run();
    if (existing && existing.drive_file_id !== file.id) driveRequest(ctx,'https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(existing.drive_file_id),{method:'DELETE'}).catch(()=>{});
    return json({done:true,nextOffset:total});
  } catch {
    return json({error:'Google Drive is temporarily unavailable. Retry the upload.'},503);
  }
}
