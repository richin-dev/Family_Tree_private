import { json } from '../../lib/auth.js';
import { signedInAdmin, unauthorizedAdmin } from '../../lib/access.js';

const THEMES = new Set(['classic', 'light-glass', 'dark-glass']);
const DEFAULT_THEME = 'classic';

function cleanTheme(value) {
  return THEMES.has(value) ? value : DEFAULT_THEME;
}

async function readPayload(ctx) {
  const row = await ctx.env.FAMILY_DB.prepare('SELECT payload FROM family_tree WHERE id=1').first();
  if (row) {
    try { return JSON.parse(row.payload); }
    catch { throw new Error('Saved family data is invalid.'); }
  }
  const response = await ctx.env.ASSETS.fetch(new Request(new URL('/data.json', ctx.request.url)));
  if (!response.ok) throw new Error('Initial family data could not be loaded.');
  const payload = await response.json();
  if (!Array.isArray(payload.files) || !Array.isArray(payload.tree)) throw new Error('Initial family data is invalid.');
  return payload;
}

export async function onRequestGet(ctx) {
  if (!ctx.env.FAMILY_DB) return json({theme: DEFAULT_THEME});
  try {
    const row = await ctx.env.FAMILY_DB.prepare('SELECT payload FROM family_tree WHERE id=1').first();
    if (!row) return json({theme: DEFAULT_THEME});
    const payload = JSON.parse(row.payload);
    return json({theme: cleanTheme(payload.theme)});
  } catch {
    return json({error:'Could not load the website theme.'}, 500);
  }
}

export async function onRequestPut(ctx) {
  const user = await signedInAdmin(ctx);
  if (!user) return unauthorizedAdmin();
  if (!ctx.env.FAMILY_DB) return json({error:'Database is not configured.'},503);
  let body;
  try { body = await ctx.request.json(); }
  catch { return json({error:'Invalid JSON.'},400); }
  if (!THEMES.has(body.theme)) return json({error:'Choose one of the available themes.'},400);

  try {
    const current = await readPayload(ctx);
    if (!Array.isArray(current.files) || !Array.isArray(current.tree)) return json({error:'Saved family data is invalid.'},500);
    const serialized = JSON.stringify({...current, theme:body.theme});
    await ctx.env.FAMILY_DB.prepare('INSERT INTO family_tree(id,payload,updated_by) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=json_set(family_tree.payload,\'$.theme\',?),updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by')
      .bind(serialized,user.u,body.theme).run();
    return json({theme:body.theme});
  } catch (error) {
    return json({error:error.message || 'Could not save the website theme.'},500);
  }
}

export async function onRequest(ctx) {
  if (ctx.request.method === 'GET') return onRequestGet(ctx);
  if (ctx.request.method === 'PUT') return onRequestPut(ctx);
  return json({error:'Method not allowed.'},405,{Allow:'GET, PUT'});
}
