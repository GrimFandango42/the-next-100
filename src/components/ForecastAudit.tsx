import {data} from '../data';
import type {ForecastEvent} from '../schema';

const challenges:Record<string,string>={
 ai:'Capability demonstrations can outrun reliable deployment, independent evaluation and adoption. Progress on a benchmark may not imply the claimed economic or institutional outcome.',
 bio:'Early biological effects can fail to translate into durable clinical benefit. Safety, delivery, trials and access can each delay the outcome even when the underlying technique works.',
 energy:'A physics milestone does not establish an economical, reliable energy system. Construction, maintenance, auxiliary loads and grid integration remain separate tests.',
 climate:'Short-term variation, measurement revisions and policy changes can alter the timing. A single extreme year is not the same as a sustained climate threshold.',
 space:'Demonstrations and announced schedules do not establish sustained operations. Transport, life support, replacement equipment and financing must all work together.',
 society:'Technical feasibility does not establish political adoption or broad access. Institutions, incentives and demographic assumptions may dominate the outcome.',
 risk:'Rare events offer weak base rates, and attribution is difficult. A plausible mechanism is not enough to determine the probability or timing of a catastrophe.',
};
export default function ForecastAudit({event:e}:{event:ForecastEvent}) {
 const urls=[...new Set(e.history.flatMap(h=>h.sources))];
 const publishers=new Set(urls.map(u=>data.citations[u]?.publisher ?? new URL(u).hostname));
 const latest=[...e.history].sort((a,b)=>b.date.localeCompare(a.date))[0];
 return <div className="forecast-audit">
   <div className="eyebrow">Read this forecast critically</div>
   <dl><dt>Basis for the judgment</dt><dd>{latest?.reason ?? e.detail}</dd>
   <dt>The strongest general challenge</dt><dd>{challenges[e.domain]} This is an editorial challenge to the forecast, not a finding from every cited source.</dd>
   <dt>What could change our mind</dt><dd>{e.signals[0] ?? 'A directly measured outcome against the definition.'} The direction and size of any probability change require a new, explained review.</dd>
   <dt>Evidence coverage</dt><dd>{urls.length ? `${urls.length} cited documents from ${publishers.size} named publishers. This counts coverage, not independent confirmations; reports may share the same underlying evidence.` : 'No sources cited for this line yet. Treat it as an unsupported editorial forecast until its evidence is documented.'}</dd>
   <dt>What the percentage means</dt><dd>{e.resolution?.mode==='scenario'?'This narrative is unscored. Any stored numerical weight is an illustrative judgment, not a calibrated probability.':'A subjective judgment, not a measured frequency or a statistical confidence interval. No quantitative base-rate model is recorded for this line; source quality and likelihood are separate questions.'}</dd></dl>
 </div>;
}
