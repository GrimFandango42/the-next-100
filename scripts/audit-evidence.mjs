/** Structural evidence inventory, NOT a fact checker or a probability model.
 * Run: node scripts/audit-evidence.mjs [--json]
 * Missing citations mean no event-history citation, not no evidence in the world.
 */
import { readFileSync } from 'node:fs';
const read = name => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const events = read('events'), registry = read('sources'), metrics = read('metrics');
const meta = read('meta'), scenarios = read('scenarios'), indicators = read('indicators');
const rows = [...events].sort((a,b) => a.year-b.year).map(e => ({
  id:e.id, title:e.title, year:e.year, yearEnd:e.yearEnd ?? null,
  probability:e.probability ?? null, confidence:e.confidence,
  citationURLs:[...new Set((e.history ?? []).flatMap(h => h.sources ?? []))],
  signalCount:(e.signals ?? []).length,
  dependencyCount:(e.leadsTo ?? []).length,
  hasStructuredResolution:Object.hasOwn(e,'resolution'),
  hasStructuredProbabilityHistory:Object.hasOwn(e,'probabilityHistory'),
}));
const entries = Object.values(registry.domains).flat();
const countBy = (items, key) => items.reduce((acc,item) => {
  acc[item[key]] = (acc[item[key]] ?? 0)+1; return acc;
},{});
const report = {
  scope:'Local structure only. URLs are counted, not opened; source quality and claim support require review.',
  counts:{events:rows.length, domainRegistryEntries:entries.length,
    uniqueDomainRegistryURLs:new Set(entries.map(e=>e.url)).size,
    eventsWithHistoryCitations:rows.filter(e=>e.citationURLs.length).length,
    eventsWithoutHistoryCitations:rows.filter(e=>!e.citationURLs.length).length,
    eventsWithoutSignals:rows.filter(e=>!e.signalCount).length,
    structuredResolution:rows.filter(e=>e.hasStructuredResolution).length,
    structuredProbabilityHistory:rows.filter(e=>e.hasStructuredProbabilityHistory).length,
    metricsWithObservedAnchors:metrics.filter(m=>m.observed?.length).length,
    metrics:metrics.length, indicators:indicators.length,
    indicatorsWithSourceFields:indicators.filter(i=>i.sources?.length).length},
  domains:countBy(events,'domain'), registryTiers:countBy(entries,'tier'),
  missingCitationIds:rows.filter(e=>!e.citationURLs.length).map(e=>e.id),
  missingSignalIds:rows.filter(e=>!e.signalCount).map(e=>e.id),
  hinge:{eventProbability:events.find(e=>e.id==='hinge-resolves')?.probability,
    pluralismProbability:meta.hinge.pluralismProbability,
    note:'These fields need explicitly distinct meanings or one canonical value. Current revision wording suggests drift.'},
  scenarioMixtures:scenarios.map(s=>({id:s.id,stored:s.unconditional,
    implied:Number((meta.hinge.pluralismProbability*s.byBranch.pluralism+(1-meta.hinge.pluralismProbability)*s.byBranch.concentration).toFixed(4))})),
  events:rows,
};
if(process.argv.includes('--json')) console.log(JSON.stringify(report,null,2));
else {
  console.log(report.scope);
  console.table(report.counts);
  console.log('No event-history citations:',report.missingCitationIds.join(', '));
  console.log('No watch signals:',report.missingSignalIds.join(', '));
  console.log('Hinge:',JSON.stringify(report.hinge));
  console.table(report.scenarioMixtures);
}
