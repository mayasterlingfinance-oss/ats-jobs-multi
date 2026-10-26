// Fetch public job-board JSON/XML endpoints that ATS vendors publish for embedding career pages.
import { XMLParser } from 'fast-xml-parser';
const UA = { 'User-Agent': 'ats-jobs-multi (Apify actor; operated by an AI agent)', Accept: 'application/json, text/xml' };
async function get(url, json = true) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return json ? r.json() : r.text();
}
const strip = (h) => (h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g, ' ').trim();
const unesc = (s) => (s || '').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
const job = (o) => ({ ats: null, company: null, id: null, title: null, url: null, location: null, department: null, employmentType: null, remote: null, postedAt: null, descriptionText: null, ...o });

export const FETCHERS = {
  async greenhouse(s) {
    const d = await get(`https://boards-api.greenhouse.io/v1/boards/${s}/jobs?content=true`); if (!d) return null;
    return d.jobs.map((j) => job({ ats: 'greenhouse', company: s, id: String(j.id), title: j.title, url: j.absolute_url, location: j.location?.name,
      department: j.departments?.map((x) => x.name).join(', ') || null, postedAt: j.first_published || j.updated_at, descriptionText: strip(unesc(j.content)) }));
  },
  async lever(s) {
    let d = await get(`https://api.lever.co/v0/postings/${s}?mode=json`);
    if (!d || !Array.isArray(d)) d = await get(`https://api.eu.lever.co/v0/postings/${s}?mode=json`);
    if (!d || !Array.isArray(d)) return null;
    return d.map((j) => job({ ats: 'lever', company: s, id: j.id, title: j.text, url: j.hostedUrl, location: j.categories?.location || j.categories?.allLocations?.join(', '),
      department: j.categories?.team || j.categories?.department, employmentType: j.categories?.commitment, remote: j.workplaceType ? j.workplaceType === 'remote' : null,
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null, descriptionText: j.descriptionPlain || strip(j.description) }));
  },
  async ashby(s) {
    const d = await get(`https://api.ashbyhq.com/posting-api/job-board/${s}?includeCompensation=true`); if (!d || !d.jobs) return null;
    return d.jobs.map((j) => job({ ats: 'ashby', company: s, id: j.id, title: j.title, url: j.jobUrl, location: j.location, department: j.department || j.team,
      employmentType: j.employmentType, remote: j.isRemote ?? null, postedAt: j.publishedAt, descriptionText: j.descriptionPlain || strip(j.descriptionHtml),
      compensation: j.compensation?.compensationTierSummary || null }));
  },
  async workable(s) {
    const d = await get(`https://apply.workable.com/api/v1/widget/accounts/${s}?details=true`); if (!d || !d.jobs) return null;
    return d.jobs.map((j) => job({ ats: 'workable', company: s, id: j.shortcode, title: j.title, url: j.url || j.shortlink,
      location: [j.city, j.state, j.country].filter(Boolean).join(', ') || null, department: j.department, employmentType: j.employment_type,
      remote: j.telecommuting ?? null, postedAt: j.published_on || j.created_at, descriptionText: strip(j.description) || null }));
  },
  async recruitee(s) {
    const d = await get(`https://${s}.recruitee.com/api/offers`); if (!d || !d.offers) return null;
    return d.offers.map((j) => job({ ats: 'recruitee', company: s, id: String(j.id), title: j.title, url: j.careers_url, location: j.location,
      department: j.department, employmentType: j.employment_type_code, remote: j.remote ?? null, postedAt: j.published_at || j.created_at,
      descriptionText: strip(j.description + ' ' + (j.requirements || '')) }));
  },
  async smartrecruiters(s) {
    const out = []; let offset = 0;
    for (;;) {
      const d = await get(`https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=100&offset=${offset}`); if (!d) return null;
      for (const j of d.content || []) out.push(job({ ats: 'smartrecruiters', company: s, id: j.id, title: j.name,
        url: `https://jobs.smartrecruiters.com/${s}/${j.id}`, location: j.location?.fullLocation || [j.location?.city, j.location?.country].filter(Boolean).join(', '),
        department: j.department?.label, employmentType: j.typeOfEmployment?.label, remote: j.location?.remote ?? null, postedAt: j.releasedDate }));
      offset += 100; if (!d.content?.length || offset >= (d.totalFound || 0) || offset >= 5000) break;
    }
    return out.length ? out : null;
  },
  async personio(s) {
    const x = await get(`https://${s}.jobs.personio.de/xml`, false); if (!x || !x.includes('<workzag-jobs')) return null;
    const d = new XMLParser().parse(x); let p = d['workzag-jobs']?.position || []; if (!Array.isArray(p)) p = [p];
    return p.map((j) => { let jd = j.jobDescriptions?.jobDescription || []; if (!Array.isArray(jd)) jd = [jd];
      return job({ ats: 'personio', company: s, id: String(j.id), title: j.name, url: `https://${s}.jobs.personio.de/job/${j.id}`, location: j.office,
        department: j.department || null, employmentType: j.employmentType || j.schedule, postedAt: j.createdAt,
        descriptionText: strip(jd.map((x) => `${x.name}: ${x.value}`).join(' ')) || null }); });
  },
};

// Detect ATS + slug from a careers URL; returns {ats, slug} or {ats:'auto', slug}
export function parseTarget(t) {
  t = String(t).trim(); const m = (re) => t.match(re);
  let r;
  if ((r = m(/(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([\w-]+)/i))) return { ats: 'greenhouse', slug: r[1] };
  if ((r = m(/jobs(?:\.eu)?\.lever\.co\/([\w-]+)/i))) return { ats: 'lever', slug: r[1] };
  if ((r = m(/jobs\.ashbyhq\.com\/([\w.%-]+)/i))) return { ats: 'ashby', slug: r[1] };
  if ((r = m(/apply\.workable\.com\/([\w-]+)/i)) || (r = m(/([\w-]+)\.workable\.com/i))) return { ats: 'workable', slug: r[1] };
  if ((r = m(/([\w-]+)\.recruitee\.com/i))) return { ats: 'recruitee', slug: r[1] };
  if ((r = m(/(?:jobs|careers)\.smartrecruiters\.com\/([\w-]+)/i))) return { ats: 'smartrecruiters', slug: r[1] };
  if ((r = m(/([\w-]+)\.jobs\.personio\.(?:de|com)/i))) return { ats: 'personio', slug: r[1] };
  if (/^[\w.-]+$/.test(t)) return { ats: 'auto', slug: t };
  return null;
}
