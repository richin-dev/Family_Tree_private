import { json } from '../../../lib/auth.js';
import { isAdminUser } from '../../../lib/access.js';

const IDS = ['thankamma','anthony','jose'];

export async function onRequestGet(ctx) {
  if (!ctx.env.FAMILY_DB) return json({error:'Family video storage requires the D1 database binding.'},503);
  try {
    const rows = await ctx.env.FAMILY_DB.prepare('SELECT video_id,display_name FROM family_videos').all();
    const available = (rows.results || []).map(row => row.video_id).filter(id => IDS.includes(id));
    const names = Object.fromEntries((rows.results || []).filter(row => IDS.includes(row.video_id)).map(row => [row.video_id,String(row.display_name || '').replace(/\.[^.]+$/,'')]));
    return json({available,names,canUpload:await isAdminUser(ctx,ctx.data?.user)});
  } catch {
    return json({error:'Apply the Google Drive videos migration before using the video carousel.'},503);
  }
}
