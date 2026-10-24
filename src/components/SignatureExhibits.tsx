import {useId,useState} from 'react';
import population from '../../data/exhibits/population.json';
import arctic from '../../data/exhibits/arctic.json';
import './signature.css';

type Variant=keyof typeof population.variants;
const regions=['Africa','China','India'];
const colors=['#b6d6a4','#e1bb83','#90bfc8'];
const million=(v:number)=>new Intl.NumberFormat('en',{maximumFractionDigits:0}).format(v);
export function crossingYear(variant:Variant) {
 const rows=population.variants[variant];
 return Array.from({length:77},(_,i)=>2024+i).find(y=>rows.find(r=>r.region==='Africa'&&r.year===y)!.working>rows.filter(r=>r.region!=='Africa'&&r.year===y).reduce((s,r)=>s+r.working,0));
}
export default function SignatureExhibits({id}:{id:string}) {
 return id==='africa-largest-working-age-population'?<DemographicCrossing/>:<ArcticExtent/>;
}
export function DemographicCrossing() {
 const [year,setYear]=useState(2058);const [variant,setVariant]=useState<Variant>('medium');const uid=useId();
 const rows=population.variants[variant],current=regions.map(region=>rows.find(r=>r.region===region&&r.year===year)!);
 const cross=crossingYear(variant);
 const x=(y:number)=>36+(y-2024)/76*528,y=(v:number)=>240-v/4000*210;
 const africa=rows.filter(r=>r.region==='Africa');
 const combined=africa.map(r=>({year:r.year,working:rows.filter(s=>s.year===r.year&&s.region!=='Africa').reduce((sum,s)=>sum+s.working,0)}));
 const path=(rs:{year:number;working:number}[])=>rs.map((r,i)=>`${i?'L':'M'}${x(r.year)},${y(r.working)}`).join(' ');
 const ca=current[0].working,ci=current[1].working+current[2].working;
 return <>
  <div className="signature-kicker">POPULATION ATLAS <span>UN WPP 2024</span></div><h3>The future has an age.</h3>
  <p className="signature-deck">Three populations. Three generations. One changing balance.</p>
  <div className="signature-readout" aria-live="polite"><strong>{year}</strong><span>Africa has <b>{million(Math.abs(ca-ci))} million {ca>ci?'more':'fewer'}</b><br/>people aged 15–64 than China + India.</span></div>
  <svg viewBox="0 0 600 278" className="signature-chart" role="img" aria-label={`UN ${variant} projection: working-age population in ${year}, Africa ${million(ca)} million, China and India ${million(ci)} million. Crossing ${cross??'outside range'}.`}>
   {[0,1000,2000,3000,4000].map(v=><g key={v}><path d={`M36 ${y(v)}H564`} stroke="currentColor" opacity=".12"/><text x="30" y={y(v)+4} textAnchor="end">{v/1000}B</text></g>)}
   <rect x={x(2054)} y="20" width={x(2062)-x(2054)} height="220" fill="#e1bb83" opacity=".08"/>
   <path d={path(africa)} stroke={colors[0]} fill="none" strokeWidth="3"/><path d={path(combined)} stroke={colors[1]} fill="none" strokeWidth="2" strokeDasharray="5 5"/>
   <path d={`M${x(year)} 20V240`} stroke="currentColor" opacity=".4"/>{[ca,ci].map((v,i)=><circle key={i} cx={x(year)} cy={y(v)} r="5" fill={colors[i]}/>)}
   {[2024,2040,2060,2080,2100].map(v=><text key={v} x={x(v)} y="265" textAnchor="middle">{v}</text>)}
  </svg>
  <div className="chart-key"><span style={{color:colors[0]}}>━ Africa</span><span style={{color:colors[1]}}>┄ China + India</span><span>Shaded: our 2054–62 window</span></div>
  <label className="signature-slider" htmlFor={uid}>Explore a year <b>{year}</b><input id={uid} type="range" min="2024" max="2100" value={year} onChange={e=>setYear(+e.target.value)}/></label>
  <div className="cohort-rows">{current.map((r,i)=>{const total=r.children+r.working+r.older;return <div className="cohort-row" key={r.region}><div><b>{r.region}</b><span>{million(r.working)}M working-age</span></div><div className="cohort-bar" role="img" aria-label={`${r.region}: ages 0–14 ${million(r.children)} million; ages 15–64 ${million(r.working)} million; ages 65+ ${million(r.older)} million`}>{[r.children,r.working,r.older].map((v,j)=><span key={j} style={{width:`${v/total*100}%`,background:colors[i],opacity:[.28,1,.55][j]}}/>)}</div></div>})}</div>
  <p className="signature-note">Each age bar = 100% of that region: children 0–14 · working-age 15–64 · older 65+. Working-age is an age group, not a count of jobs or workers.</p>
  <div className="exhibit-controls" role="group" aria-label="UN fertility variant">{(['low','medium','high'] as Variant[]).map(v=><button key={v} aria-pressed={variant===v} onClick={()=>setVariant(v)}>{v} fertility</button>)}</div>
  <p className="signature-note" aria-live="polite">Crossing in this variant: <b>{cross??'not by 2100'}</b>. These are UN projections, not observations or confidence intervals. They do not change the site’s forecast probability.</p>
  <Source href={population.source}>UN DESA · WPP 2024 · selected age groups · millions · CC BY 3.0 IGO</Source>
 </>;
}
const mapYears=[1979,2000,2012,2026];
export function ArcticExtent() {
 const [year,setYear]=useState(2026);const [compare,setCompare]=useState(false);
 const value=arctic.points.find(p=>p[0]===year)![1];const first=arctic.points[0][1];
 const x=(v:number)=>30+(v-1979)/47*540,y=(v:number)=>190-v/8*170;
 const path=arctic.points.map(([a,b],i)=>`${i?'L':'M'}${x(a)},${y(b)}`).join(' ');
 return <>
  <div className="signature-kicker">CRYOSPHERE OBSERVATORY <span>SEPTEMBER</span></div><h3>A smaller white world.</h3>
  <div className="ice-map"><img src={`/evidence/arctic-${compare?1979:year}.svg`} alt={`NSIDC September ${compare?1979:year} monthly Arctic sea-ice extent map`} loading="lazy" width="420" height="500"/><div className="ice-map-label"><strong>{compare?1979:year}</strong><span>Observed monthly extent</span></div></div>
  <div className="exhibit-controls" role="group" aria-label="September map year">{mapYears.map(v=><button key={v} aria-pressed={year===v&&!compare} onClick={()=>{setYear(v);setCompare(false);}}>{v}</button>)}</div>
  <button className="compare-ice" aria-pressed={compare} onClick={()=>setCompare(!compare)}>{compare?`Return to ${year}`:'Compare with 1979'} ↔</button>
  <div className="signature-readout" aria-live="polite"><strong>{(compare?first:value).toFixed(2)}<small>M km²</small></strong><span>September monthly mean<br/><b>{compare?'Baseline year':`${Math.round((1-value/first)*100)}% below 1979`}</b></span></div>
  <svg viewBox="0 0 600 225" className="signature-chart" role="img" aria-label="Observed September monthly Arctic sea-ice extent from 1979 to 2026; dashed forecast threshold at one million square kilometres.">
   {[0,2,4,6,8].map(v=><g key={v}><path d={`M30 ${y(v)}H570`} stroke="currentColor" opacity=".12"/><text x="23" y={y(v)+4} textAnchor="end">{v}</text></g>)}
   <path d={path} fill="none" stroke="#a5d7df" strokeWidth="2.5"/><path d={`M30 ${y(1)}H570`} stroke="#e1bb83" strokeDasharray="4 5"/><text x="565" y={y(1)-7} textAnchor="end">Forecast threshold: 1M km²</text>
   <circle cx={x(compare?1979:year)} cy={y(compare?first:value)} r="5" fill="#e1bb83"/>{[1979,2000,2026].map(v=><text x={x(v)} y="218" textAnchor="middle" key={v}>{v}</text>)}
  </svg>
  <p className="signature-note">The bet concerns a <b>September monthly mean below 1M km²</b> in 2036–2050. No future ice boundary is drawn. Daily minimum, monthly mean, extent and ice area are different measures.</p>
  <Source href={arctic.source}>NSIDC · Sea Ice Index v4.0 · September monthly extent, 1979–2026</Source>
 </>;
}
function Source({href,children}:{href:string;children:React.ReactNode}) {return <a className="signature-source" href={href} target="_blank" rel="noreferrer">{children} ↗</a>;}
