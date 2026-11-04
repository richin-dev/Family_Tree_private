import { json } from '../../lib/auth.js';
import { signedInAdmin, unauthorizedAdmin } from '../../lib/access.js';

const THEMES = new Set(['classic', 'classic-glass']);

export async function onRequestGet(ctx) {
  if (!ctx.env.FAMILY_DB) return json({theme:'classic'});
  try {
    const row = await ctx.env.FAMILY_DB.prepare('SELECT payload FROM family_tree WHERE id=1').first();
    if (!row) return json({theme:'classic'});
    const saved = JSON.parse(row.payload).theme;
    return json({theme:THEMES.has(saved) ? saved : 'classic'});
  } catch { return json({error:'Could not load the website theme.'},500); }
}

export async function onRequestPut(ctx) {
  const user = await signedInAdmin(ctx);
  if (!user) return unauthorizedAdmin();
  if (!ctx.env.FAMILY_DB) return json({error:'Database is not configured.'},503);
  let body;
  try { body = await ctx.request.json(); }
  catch { return json({error:'Invalid JSON.'},400); }
  if (!THEMES.has(body.theme)) return json({error:'Choose Classic or Classic Glass.'},400);

  try {
    let row = await ctx.env.FAMILY_DB.prepare('SELECT payload FROM family_tree WHERE id=1').first();
    if (!row) {
      const response = await ctx.env.ASSETS.fetch(new Request(new URL('/data.json',ctx.request.url)));
      if (!response.ok) return json({error:'Initial family data could not be loaded.'},500);
      const initial = await response.json();
      if (!Array.isArray(initial.files) || !Array.isArray(initial.tree)) return json({error:'Initial family data is invalid.'},500);
      await ctx.env.FAMILY_DB.prepare('INSERT OR IGNORE INTO family_tree(id,payload,updated_by) VALUES(1,?,?)').bind(JSON.stringify(initial),user.u).run();
    }
    await ctx.env.FAMILY_DB.prepare("UPDATE family_tree SET payload=json_set(payload,'$.theme',?),updated_at=CURRENT_TIMESTAMP,updated_by=? WHERE id=1").bind(body.theme,user.u).run();
    return json({theme:body.theme});
  } catch { return json({error:'Could not save the website theme.'},500); }
}

export async function onRequest(ctx) {
  if (ctx.request.method === 'GET') return onRequestGet(ctx);
  if (ctx.request.method === 'PUT') return onRequestPut(ctx);
  return json({error:'Method not allowed.'},405,{Allow:'GET, PUT'});
}
