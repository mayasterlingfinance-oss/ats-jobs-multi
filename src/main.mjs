import { Actor, log } from 'apify';
import { FETCHERS, parseTarget } from './ats.mjs';
await Actor.init();
const inp = (await Actor.getInput()) || {};
const targets = inp.companies || [];
const kw = (inp.keywords || []).map((k) => k.toLowerCase());
const loc = (inp.locationContains || '').toLowerCase();
const max = inp.maxJobsPerCompany || 0;
const withDesc = inp.includeDescription !== false;
const order = ['greenhouse', 'lever', 'ashby', 'workable', 'recruitee', 'smartrecruiters', 'personio'];
let total = 0;
for (const t of targets) {
  const p = parseTarget(t);
  if (!p) { await Actor.pushData({ input: t, error: 'unrecognized input (give a careers URL or company slug)' }); continue; }
  const list = p.ats === 'auto' ? order : [p.ats];
  let jobs = null, ats = null, err = null;
  for (const a of list) {
    try { jobs = await FETCHERS[a](p.slug); } catch (e) { err = e.message; jobs = null; }
    if (jobs) { ats = a; break; }
  }
  if (!jobs) { await Actor.pushData({ input: t, error: err || 'no public job board found for this company on supported ATS (free, not charged)' }); continue; }
  let f = jobs.filter((j) => (!kw.length || kw.some((k) => (j.title || '').toLowerCase().includes(k))) && (!loc || (j.location || '').toLowerCase().includes(loc)));
  if (max) f = f.slice(0, max);
  log.info(`${t}: ${ats}/${p.slug} ${jobs.length} jobs, ${f.length} after filters`);
  for (const j of f) {
    if (!withDesc) delete j.descriptionText;
    await Actor.pushData({ input: t, ...j, scrapedAt: new Date().toISOString() });
    const c = await Actor.charge({ eventName: 'job-result' });
    total++;
    if (c?.eventChargeLimitReached) { log.warning('Max charge reached, stopping.'); await Actor.exit(); }
  }
}
log.info(`Done, ${total} jobs.`);
await Actor.exit();
