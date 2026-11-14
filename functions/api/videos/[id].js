import { json, readSession } from '../../../lib/auth.js';
import { signedInAdmin, unauthorizedAdmin } from '../../../lib/access.js';
import { driveRequest } from '../../../lib/google-drive.js';

const IDS = new Set(['thankamma','anthony','jose']);

export async function onRequestGet(ctx) {
  if (!await readSession(ctx.env,ctx.request.headers.get('Cookie'))) return new Response('Sign in to view family videos.',{status:401,headers:{'Cache-Control':'no-store'}});
  const id = String(ctx.params.id || '');
  if (!IDS.has(id) || !ctx.env.FAMILY_DB) return new Response('Not found.',{status:404});
  try {
    const row = await ctx.env.FAMILY_DB.prepare('SELECT drive_file_id FROM family_videos WHERE video_id=?').bind(id).first();
    if (!row) return new Response('Not found.',{status:404});
    const headers = new Headers();
    const range = ctx.request.headers.get('Range');
    if (range) headers.set('Range',range);
    const response = await driveRequest(ctx,'https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(row.drive_file_id)+'?alt=media',{headers,redirect:'manual'});
    if (!response.ok && response.status !== 206) return new Response(response.status === 404 ? 'Not found.' : 'Video storage is temporarily unavailable.',{status:response.status === 404 ? 404 : 503,headers:{'Cache-Control':'private, no-store'}});
    const outHeaders = new Headers({
      'Content-Type':'video/mp4',
      'Accept-Ranges':'bytes',
      'Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff',
      'Content-Disposition':'inline'
    });
    for (const name of ['Content-Length','Content-Range','ETag','Last-Modified']) {
      const value = response.headers.get(name);
      if (value) outHeaders.set(name,value);
    }
    return new Response(response.body,{status:response.status,headers:outHeaders});
  } catch {
    return new Response('Video storage is temporarily unavailable.',{status:503,headers:{'Cache-Control':'private, no-store'}});
  }
}

export async function onRequestDelete(ctx) {
  const user = await signedInAdmin(ctx);
  if (!user) return unauthorizedAdmin();
  const id = String(ctx.params.id || '');
  if (!IDS.has(id) || !ctx.env.FAMILY_DB) return json({error:'Video not found.'},404);
  try {
    const row = await ctx.env.FAMILY_DB.prepare('SELECT drive_file_id FROM family_videos WHERE video_id=?').bind(id).first();
    if (!row) return json({error:'This video is already empty.'},404);
    const response = await driveRequest(ctx,'https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(row.drive_file_id),{method:'DELETE'});
    if (!response.ok && response.status !== 404) return json({error:'Google Drive could not remove this video. Try again.'},503);
    await ctx.env.FAMILY_DB.prepare('DELETE FROM family_videos WHERE video_id=?').bind(id).run();
    await ctx.env.FAMILY_DB.prepare('DELETE FROM family_video_uploads WHERE video_id=?').bind(id).run();
    return json({ok:true});
  } catch {
    return json({error:'Video storage is temporarily unavailable. Try again.'},503);
  }
}
