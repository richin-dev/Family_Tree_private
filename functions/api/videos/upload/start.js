import { json } from '../../../../lib/auth.js';
import { signedInAdmin, unauthorizedAdmin } from '../../../../lib/access.js';
import { driveRequest, driveVideoFolderId } from '../../../../lib/google-drive.js';

const SPECS = {
  thankamma:{fileName:'Thankamma_Kochappan.mp4',displayName:'Thankamma_Kochappan.mp4'},
  anthony:{fileName:'Anthony kadavy.mp4',displayName:'Anthony kadavy.mp4'},
  jose:{fileName:'Jose Kadavy.mp4',displayName:'Jose Kadavy.MOV'}
};
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const MAX_BYTES = 1_500_000_000;
const CHUNK_SIZE = 8 * 1024 * 1024;

export async function onRequestPost(ctx) {
  const user = await signedInAdmin(ctx);
  if (!user) return unauthorizedAdmin();
  if (!ctx.env.FAMILY_DB) return json({error:'Family video storage requires the D1 database binding.'},503);
  let body; try { body = await ctx.request.json(); } catch { return json({error:'Invalid upload details.'},400); }
  const spec = SPECS[body.id], size = Number(body.size);
  if (!spec || !Number.isSafeInteger(size) || size < 1 || size > MAX_BYTES) return json({error:'Choose one of the three family videos, up to 1.5 GB.'},400);
  const displayName = String(body.displayName || '').replace(/[\\/]/g,' ').replace(/\.[^.]+$/,'').trim().slice(0,120);
  if (!displayName) return json({error:'The selected video needs a name.'},400);
  try {
    const folderId = await driveVideoFolderId(ctx);
    const response = await driveRequest(ctx,UPLOAD_API+'/files?uploadType=resumable&fields=id,name',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-Upload-Content-Type':'video/mp4','X-Upload-Content-Length':String(size)},
      body:JSON.stringify({name:spec.fileName,mimeType:'video/mp4',parents:[folderId]})
    });
    const sessionUrl = response.headers.get('Location');
    if (!response.ok || !sessionUrl) return json({error:'Google Drive could not start the video upload. Check its connection and storage quota.'},503);
    await ctx.env.FAMILY_DB.prepare('DELETE FROM family_video_uploads WHERE video_id=?').bind(body.id).run();
    const uploadId = crypto.randomUUID();
    await ctx.env.FAMILY_DB.prepare('INSERT INTO family_video_uploads(upload_id,video_id,display_name,total_bytes,next_offset,session_url) VALUES(?,?,?,?,0,?)')
      .bind(uploadId,body.id,displayName,size,sessionUrl).run();
    return json({uploadId,chunkSize:CHUNK_SIZE});
  } catch (error) { return json({error:error.message || 'Google Drive is unavailable.'},503); }
}
