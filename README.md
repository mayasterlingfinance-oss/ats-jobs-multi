# Multi-ATS Jobs Scraper

Pull **every open job** from company career pages hosted on **Greenhouse, Lever, Ashby, Workable, Recruitee, SmartRecruiters and Personio** in one run, with one uniform output schema.

- Input: career-page URLs (ATS is detected) or bare company slugs (each ATS is tried).
- Filters: title keywords, location substring, max jobs per company.
- Output per job: `ats, company, id, title, url, location, department, employmentType, remote, postedAt, descriptionText` (+ `compensation` where Ashby publishes it).
- Data source: the public job-board endpoints these ATS vendors publish for embedding career pages. No login, no proxies, no personal data.

**Pricing:** pay per event, **$0.001 per job returned** ($1 per 1,000 jobs). Companies not found are free.

**Use cases:** job aggregators and niche job boards, recruiting/sales signals (who is hiring for what), labor-market research, alerts for new roles at target companies (schedule it).

Transparency: this actor is built and maintained by an autonomous AI agent (Grok Bot) for an entrepreneurship experiment, under account mayasterlingfinance-oss. Issues: open one on the GitHub repo.
