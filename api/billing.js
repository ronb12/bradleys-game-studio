export const config = { maxDuration: 60 };

function monthRangeUTC() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return { starting_at: iso(start), ending_at: iso(end), monthKey: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}` };
}

async function anthropicGet(path, adminKey, query = '') {
  const url = `https://api.anthropic.com${path}${query ? `?${query}` : ''}`;
  const res = await fetch(url, {
    headers: { 'x-api-key': adminKey, 'anthropic-version': '2023-06-01' },
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  return { ok: res.ok, status: res.status, data };
}

function sumCostBuckets(buckets) {
  let cents = 0;
  for (const bucket of buckets || []) {
    for (const r of bucket.results || []) {
      cents += parseFloat(r.amount || 0) || 0;
    }
  }
  return cents / 100;
}

async function fetchMonthCost(adminKey, starting_at, ending_at) {
  const buckets = [];
  let page = '';
  let hasMore = true;
  let guard = 0;
  while (hasMore && guard++ < 24) {
    const q = new URLSearchParams({ starting_at, ending_at, bucket_width: '1d', limit: '31' });
    if (page) q.set('page', page);
    const report = await anthropicGet('/v1/organizations/cost_report', adminKey, q.toString());
    if (!report.ok) return { error: report.data?.error?.message || `Cost report failed (${report.status})` };
    buckets.push(...(report.data?.data || []));
    hasMore = !!report.data?.has_more;
    page = report.data?.next_page || '';
  }
  return { monthCostUsd: sumCostBuckets(buckets) };
}

async function fetchPrepaidCredits(adminKey, orgId) {
  if (!orgId) return null;
  try {
    const res = await fetch(`https://console.anthropic.com/api/organizations/${encodeURIComponent(orgId)}/prepaid/credits`, {
      headers: { 'x-api-key': adminKey, 'anthropic-version': '2023-06-01', Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.amount == null) return null;
    return (parseFloat(data.amount) || 0) / 100;
  } catch (_) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: { message: 'Method not allowed' } }); return; }

  try {
    const { _adminKey } = req.body || {};
    if (!_adminKey || !_adminKey.startsWith('sk-ant-admin')) {
      res.status(401).json({ error: { message: 'Admin API key required (starts with sk-ant-admin). Create at console.anthropic.com/settings/admin-keys' } });
      return;
    }

    const me = await anthropicGet('/v1/organizations/me', _adminKey);
    if (!me.ok) {
      res.status(me.status).json({ error: { message: me.data?.error?.message || 'Invalid admin key or missing org admin role' } });
      return;
    }

    const range = monthRangeUTC();
    const cost = await fetchMonthCost(_adminKey, range.starting_at, range.ending_at);
    if (cost.error) {
      res.status(502).json({ error: { message: cost.error } });
      return;
    }

    const prepaidCreditsUsd = await fetchPrepaidCredits(_adminKey, me.data?.id);

    res.status(200).json({
      organization: me.data,
      monthKey: range.monthKey,
      monthCostUsd: cost.monthCostUsd,
      prepaidCreditsUsd,
      source: 'anthropic',
      fetchedAt: Date.now(),
    });
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
}
