// T-009 live red-team runner. Usage:
//   node e2e/redteam.mjs <baseUrl> "Miro" "Calendly" "Toggl Track" ...
// Each query is one live run and counts toward the 5/IP/hour rate limit (cache hits do not).
// Prints, per run: status, duration, Composio status, probe count + timestamps, computed difficulty,
// downgrades (with reasons), primary-evidence count, and step errors. It does not inspect the guide's sources:
// check off-domain primaries by hand on /generate/<runId> (T-009 checklist).

const [base, ...queries] = process.argv.slice(2);
if (!base || !queries.length) {
  console.error('Usage: node e2e/redteam.mjs <baseUrl> "<query>" ...');
  process.exit(2);
}

async function run(query) {
  const t0 = Date.now();
  const res = await fetch(`${base}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) return { query, http: res.status, error: await res.text() };

  const out = { query, http: res.status, events: [] };
  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const event = block.match(/^event: (.*)$/m)?.[1];
      const data = JSON.parse(block.match(/^data: (.*)$/m)?.[1] ?? "null");
      if (event === "run") Object.assign(out, { runId: data.runId, mock: data.mock, cached: data.cached });
      if (event === "step") out.events.push(data);
      if (event === "done") Object.assign(out, { status: data.status, error: data.error });
    }
  }
  out.seconds = Math.round((Date.now() - t0) / 1000);
  return out;
}

function summarize(r) {
  if (r.http !== 200) return `${r.query}: HTTP ${r.http} ${String(r.error).slice(0, 200)}`;
  const ev = (step, status = "done") => r.events.find((e) => e.step === step && e.status === status);
  const probes = ev("probe")?.data?.probes ?? [];
  const verify = ev("verify")?.data;
  const lines = [
    `${r.query}: status=${r.status} ${r.seconds}s run=${r.runId} mock=${r.mock} cached=${r.cached}${r.seconds > 180 ? "  ** OVER 3 MIN **" : ""}`,
    `  resolve: ${ev("resolve")?.message ?? "-"}`,
    `  composio: ${ev("composio")?.data?.managed ?? ev("composio", "error")?.message ?? "-"}`,
    `  probes: ${probes.length} (timestamped: ${probes.every((p) => /T\d\d:\d\d/.test(p.at ?? ""))})`,
    `  difficulty(computed): ${verify?.difficulty?.computed ?? "-"}  downgraded: ${verify?.downgraded?.length ?? "-"}/${verify?.checkedClaims ?? "-"}  primaryEvidence: ${verify?.primaryEvidence ?? "-"}`,
    ...(verify?.downgraded ?? []).slice(0, 8).map((d) => `    - ${d.where}: ${d.from} (${d.reason})`),
    ...r.events.filter((e) => e.status === "error").map((e) => `  ERROR ${e.step}: ${e.message}`),
  ];
  return lines.join("\n");
}

for (const q of queries) {
  try {
    console.log(summarize(await run(q)));
  } catch (e) {
    console.log(`${q}: FAILED ${e instanceof Error ? e.message : e}`);
  }
}
