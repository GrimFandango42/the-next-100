import { useId, useState } from 'react';
import { FusionLab, QuantumLab, GeneLab } from './ExhibitLabs';
import { data } from '../data';
import { fmt, lerp, metricKF } from '../lib';
import type { Branch, ForecastEvent } from '../schema';

type Topic = 'quantum' | 'gene' | 'power' | 'drugs' | 'population' | 'fusion';
export const exhibitFor = (e: ForecastEvent): Topic | undefined => ({
  'quantum-chemistry-advantage': 'quantum', 'in-vivo-editing-common-disease': 'gene',
  'data-centres-tenth-us-power': 'power', 'ai-drugs-phase-iii': 'drugs',
  'population-peak': 'population', 'population-declining': 'population', 'world-2100': 'population',
  'fusion-net-grid': 'fusion',
} as Record<string, Topic>)[e.id];
const stages = {
  quantum: [
    ['Encode', 'Reported demonstration', 'IBM and UChicago report a verified circuit with 70 logical qubits. This is a benchmark result, not a useful chemistry result.'],
    ['Correct', 'Engineering bottleneck', 'Useful computations need sufficiently accurate logical operations over the whole circuit. A qubit count alone cannot establish that.'],
    ['Calculate', 'Application test', 'Compute a chemically meaningful energy or material property. Compare accuracy and full computational cost with a named classical method.'],
    ['Verify', 'Our forecast', 'An outside group must verify the advantage, and classical methods must not match it for 12 months. This is what the forecast bets on.'],
  ],
  gene: [
    ['Edit', 'Approved precedent', 'Casgevy edits blood stem cells outside the body. It establishes a clinical precedent for CRISPR, not approval for an in-body editor.'],
    ['Deliver', 'Different problem', 'An in-body editor must reach the right cells at a useful dose. Delivery, tissue targeting and unintended edits are central constraints.'],
    ['Treat', 'Clinical evidence', 'A molecular change must translate into patient benefit, with acceptable safety and durability. Success in one disease does not prove benefit in another.'],
    ['Reach patients', 'Our forecast', 'Approval for a common indication is the milestone here. Manufacturing, eligibility and access determine the benefit after approval.'],
  ],
  drugs: [
    ['Design', 'Discovery', 'AI can propose a molecule. That is the beginning of a drug program, not evidence that it works in people.'],
    ['Phase I', 'Safety and dose', 'Early human studies examine safety and dosing. A successful design still has to survive biology.'],
    ['Phase II', 'Evidence of benefit', 'Does the treatment help the intended patients? Promising early findings can fail in larger studies.'],
    ['Phase III', 'Our forecast', 'The forecast requires at least 12 AI-generated molecules to clear Phase III in a single year. Trial entry does not count as success.'],
    ['Approval', 'Separate milestone', 'Regulators evaluate benefit, risk and manufacturing. Phase III success is not automatically an approval. No invented attrition rates are shown.'],
  ],
  fusion: [
    ['Plasma', 'Physics milestone', 'Fusion energy output can exceed the energy delivered to the fuel. That does not include all of the facility’s electricity consumption.'],
    ['Capture', 'Engineering milestone', 'Recover the energy in a form that can produce electricity. Different fusion designs use different conversion systems.'],
    ['Export', 'Grid milestone', 'Metered electricity leaves the plant. A short export can still coexist with net electricity consumption over the year.'],
    ['Net year', 'Our forecast', 'Annual electricity exported must exceed annual electricity imported. Availability, maintenance and auxiliary power all count.'],
  ],
};
const titles: Record<Topic,string> = { quantum:'From qubits to chemistry',gene:'An edit is only the beginning',power:'The grid behind the intelligence',drugs:'A molecule is not yet a medicine',population:'One planet. Diverging futures.',fusion:'From a star to a socket' };

export default function Exhibit({ev, branch, active}: {ev:ForecastEvent;branch:Branch;active:boolean}) {
  const topic = exhibitFor(ev)!;
  const steps = topic === 'fusion' && ev.id === 'helion-delivers-microsoft' ? stages.fusion.map((s,i)=>i===2 ? [s[0], 'This forecast', 'Metered Orion electricity delivered under the Microsoft agreement counts here. Net annual electricity is a separate forecast.'] : i===3 ? [s[0], 'Separate forecast', s[2]] : s) : topic === 'power' || topic === 'population' ? [] : stages[topic];
  const [step, setStep] = useState(0);
  const uid = useId().replace(/:/g,'');
  return <div className={`figure exhibit ${active?'live':''} exhibit-${topic}`} aria-label={`${titles[topic]} interactive exhibit`}>
    <h3>{titles[topic]}</h3>
    {topic === 'population' ? <Population branch={branch} initial={ev.year} uid={uid}/> : topic === 'power' ? <Power ev={ev} uid={uid}/> : <>
      <Schematic topic={topic} step={step} uid={uid}/>
      <div className="exhibit-controls" role="group" aria-label={`Explore ${topic} stages`}>
        {steps.map((s,i)=><button key={s[0]} aria-pressed={step===i} onClick={()=>setStep(i)}><span>{String(i+1).padStart(2,'0')}</span>{s[0]}</button>)}
      </div>
      <div className="exhibit-reading" aria-live="polite"><span className="exhibit-tag">{steps[step][1]}</span><p>{steps[step][2]}</p></div>
      {topic === 'fusion' ? <FusionLab/> : topic === 'quantum' ? <QuantumLab/> : topic === 'gene' ? <GeneLab/> : null}
    </>}
  </div>;
}

function Schematic({topic,step,uid}:{topic:'quantum'|'gene'|'drugs'|'fusion';step:number;uid:string}) {
 const glow=`glow-${uid}`;
 return <svg className="exhibit-canvas" viewBox="0 0 600 330" role="img" aria-label={`${topic} schematic, stage ${step+1}`}>
  <defs><radialGradient id={glow}><stop stopColor="var(--d)" stopOpacity=".3"/><stop offset="1" stopColor="var(--d)" stopOpacity="0"/></radialGradient></defs>
  <ellipse cx="300" cy="165" rx="250" ry="155" fill={`url(#${glow})`}/>
  {Array.from({length:45},(_,i)=><circle key={i} cx={25+(i*137)%550} cy={15+(i*83)%300} r="1" fill="currentColor" opacity=".18"/>)}
  {topic==='quantum' && <g>
    {[0,1,2,3,4].map(i=><g key={i}><path d={`M40 ${75+i*42} H320 Q365 ${75+i*42} 410 165`} className="diagram-wire"/><text x="28" y={80+i*42} className="diagram-label">{i}</text>{[0,1,2].map(j=><g key={j} opacity={step>=j?1:.24}><rect x={85+j*72} y={61+i*42} width="28" height="28" rx="5" className="diagram-gate"/><text x={99+j*72} y={80+i*42} textAnchor="middle" className="diagram-label">{j===0?'H':j===1?'↺':'Z'}</text></g>)}</g>)}
    <g className="molecule" opacity={step>=2?1:.25}>{[[425,135],[480,108],[520,157],[485,213],[430,196]].map(([x,y],i,ps)=><g key={i}><line x1={x} y1={y} x2={ps[(i+1)%ps.length][0]} y2={ps[(i+1)%ps.length][1]} stroke="var(--d)" strokeWidth="3"/><circle cx={x} cy={y} r={i%2?12:18} className="diagram-atom"/></g>)}</g>
    <text x="300" y="310" textAnchor="middle" className="diagram-label">{['LOGICAL CIRCUIT','CONTROL THE ERRORS','A MEANINGFUL MOLECULE','REQUIRES INDEPENDENT VERIFICATION'][step]}</text>
  </g>}
  {topic==='gene' && step===0 && <g>{Array.from({length:29},(_,i)=>{const x=50+i*18,a=Math.sin(i*.45+step*.5),y=165+a*70,z=165-a*70;return <g key={i}><line x1={x} x2={x} y1={y} y2={z} stroke={i>11&&i<17?'#ead19c':'var(--d)'} strokeWidth={i>11&&i<17?4:2} opacity={.3+Math.abs(a)*.5}/><circle cx={x} cy={y} r={5+Math.max(0,a)*3} className="diagram-atom"/><circle cx={x} cy={z} r={5+Math.max(0,-a)*3} fill="#ead19c" opacity=".8"/></g>})}<circle cx={300} cy={165} r={85+step*12} className="diagram-ring"/><path d="M270 48v-12h60v12 M270 282v12h60v-12" stroke="#ead19c" fill="none"/><text x="300" y="318" textAnchor="middle" className="diagram-label">{['TARGET AN EDIT','REACH THE RIGHT CELLS','DEMONSTRATE BENEFIT','APPROVAL → ACCESS'][step]}</text></g>}
  {topic==='gene' && step>0 && <g>
    <circle cx="300" cy="160" r="112" fill="var(--d)" fillOpacity=".06" stroke="var(--d)" strokeDasharray={step===1?"7 8":undefined}/>
    {step===1 ? <><circle cx="300" cy="160" r="48" className="diagram-ring"/><path d="M50 160H240m-14-12 14 12-14 12" className="diagram-wire"/>{[80,125,170].map(x=><g key={x}><circle cx={x} cy="160" r="12" fill="var(--d)" fillOpacity=".25" stroke="var(--d)"/><path d={`M${x-4} 155l8 10m0-10-8 10`} stroke="#ead19c"/></g>)}<text x="300" y="165" textAnchor="middle" className="diagram-label">TARGET</text><text x="300" y="300" textAnchor="middle" className="diagram-label">DELIVERY MUST CROSS THE CELL BARRIER</text></> : step===2 ? <>{[0,1,2].map((i)=><g key={i}><circle cx={240+i*60} cy="130" r="13" fill="none" stroke="var(--d)"/><path d={`M${240+i*60} 145v45m-16-25h32m-16 25-14 25m14-25 14 25`} className="diagram-wire"/></g>)}<text x="300" y="258" textAnchor="middle" className="diagram-label">SAFETY · BENEFIT · DURABILITY</text><text x="300" y="300" textAnchor="middle" className="diagram-label">PATIENT OUTCOMES, NOT JUST MOLECULAR CHANGE</text></> : <>{Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return <g key={i}><path d={`M300 160L${300+130*Math.cos(a)} ${160+110*Math.sin(a)}`} className="diagram-wire" strokeDasharray="3 6"/><circle cx={300+130*Math.cos(a)} cy={160+110*Math.sin(a)} r="12" fill="#12241e" stroke="var(--d)"/></g>})}<circle cx="300" cy="160" r="50" fill="#12241e" stroke="var(--d)"/><text x="300" y="165" textAnchor="middle" className="diagram-label">APPROVAL</text><text x="300" y="310" textAnchor="middle" className="diagram-label">THEN MANUFACTURE · ELIGIBILITY · ACCESS</text></>}
  </g>}
  {topic==='fusion' && <g><g className="reactor"><ellipse cx="290" cy="165" rx="175" ry="112" className="diagram-ring"/><ellipse cx="290" cy="165" rx="150" ry="88" fill="none" stroke="var(--d)" strokeWidth="28" opacity=".12"/><ellipse cx="290" cy="165" rx="150" ry="88" fill="none" stroke="var(--d)" strokeWidth="3" className="plasma-flow"/>{Array.from({length:14},(_,i)=>{const a=i*Math.PI/7;return <ellipse key={i} cx={290+150*Math.cos(a)} cy={165+88*Math.sin(a)} rx="12" ry="26" transform={`rotate(${i*25.7} ${290+150*Math.cos(a)} ${165+88*Math.sin(a)})`} fill="none" stroke="#ead19c" opacity=".35"/>})}<ellipse cx="290" cy="165" rx="95" ry="52" fill="#101f1a" stroke="var(--d)" opacity=".7"/></g><path d="M465 165h65v65h35" className="diagram-wire" strokeDasharray={step<2?'4 8':undefined}/><path d="M547 210v20m15-20v20m-20 0h25v13q-12 20-25 0Z" stroke="var(--d)" fill="none" strokeWidth="3"/><text x="290" y="162" textAnchor="middle" className="diagram-number">{['Q','HEAT','MW','MWh'][step]}</text><text x="290" y="185" textAnchor="middle" className="diagram-label">{['FUEL GAIN','CONVERSION','POWER','ANNUAL BALANCE'][step]}</text><text x="300" y="318" textAnchor="middle" className="diagram-label">ILLUSTRATIVE MAGNETIC DESIGN · OTHER ROUTES EXIST</text></g>}
  {topic==='drugs' && <g>{Array.from({length:5},(_,i)=><g key={i} opacity={i<=step?1:.22}><path d={`M${65+i*110} 80 Q${110+i*110} 165 ${65+i*110} 250`} fill="none" stroke="var(--d)" strokeWidth="2"/><rect x={42+i*110} y={115} width="46" height="100" rx="23" fill={i===step?'var(--d)':'#172e26'} stroke="var(--d)"/><path d={`M${43+i*110} 165h44`} stroke="#101f1a"/><text x={65+i*110} y="285" textAnchor="middle" className="diagram-label">{['DESIGN','I','II','III','APPROVE'][i]}</text>{i<4&&<path d={`M${93+i*110} 165h52m-6-5 6 5-6 5`} className="diagram-wire"/>}</g>)}<text x="300" y="35" textAnchor="middle" className="diagram-label">EACH GATE ASKS A DIFFERENT QUESTION</text></g>}
 </svg>;
}

function Power({ev,uid}:{ev:ForecastEvent;uid:string}) {
 const bars=ev.hero!.bars!; const [selected,setSelected]=useState(2); const b=bars[selected];
 return <><svg viewBox="0 0 600 300" className="exhibit-canvas" role="img" aria-label={`${b.label}: ${b.value}% of US electricity`}>
   <defs><radialGradient id={uid+'-power'}><stop stopColor="var(--d)" stopOpacity=".3"/><stop offset="1" stopColor="var(--d)" stopOpacity="0"/></radialGradient></defs><ellipse cx="300" cy="140" rx="290" ry="140" fill={`url(#${uid}-power)`}/>
   {Array.from({length:100},(_,i)=>{const x=30+(i%20)*28,y=30+Math.floor(i/20)*36,on=i<b.value;return <g key={i}><path d={`M${x} ${y}h28m-28 0v36`} stroke="var(--d)" opacity=".12"/><rect x={x} y={y} width="17" height="23" rx="3" fill={on?'var(--d)':'#25392f'} opacity={on?Math.min(1,b.value-i):.65}/></g>})}
   <text x="35" y="270" className="diagram-number">{b.value}%</text><text x="210" y="253" className="diagram-label">US ELECTRICITY</text><text x="210" y="277" className="diagram-label">100 CELLS = 100% · FRACTIONAL CELL DIMMED</text>
 </svg><div className="exhibit-controls power-controls" role="group" aria-label="Electricity demand scenarios">{bars.map((r,i)=><button key={r.label} aria-pressed={selected===i} onClick={()=>setSelected(i)}>{r.label}<strong>{r.value}%</strong></button>)}</div><div className="exhibit-reading" aria-live="polite"><span className="exhibit-tag">{b.kind==='observed'?'Historical estimate':b.kind==='reference'?'Outside projection':'Our forecast threshold'}</span><p>{b.note ?? (b.kind==='reference'?'LBNL / DOE scenario for 2030. Scenarios describe different assumptions; they are not confidence intervals.':'The forecast resolves on the reported share for calendar 2030, not on an announcement of planned capacity.')}</p></div><div className="exhibit-foot">Share of annual electricity use · not generating capacity</div></>;
}
function Population({branch,initial,uid}:{branch:Branch;initial:number;uid:string}) {
 const m=data.metrics.find(m=>m.id==='population')!;
 const [year,setYear]=useState(Math.min(2100,Math.max(2026,initial)));
 const a=metricKF(m,branch),ref=m.reference[0];
 const other=metricKF(m,branch==='pluralism'?'concentration':'pluralism');
 const x=(y:number)=>45+(y-2026)/74*510, y=(v:number)=>260-(v-5)/7*210;
 const path=(k:[number,number][])=>Array.from({length:75},(_,i)=>`${i?'L':'M'}${x(2026+i)},${y(lerp(k,2026+i))}`).join(' ');
 const value=lerp(a,year),base=ref?lerp(ref.points as [number,number][],year):null;
 return <><svg viewBox="0 0 600 320" className="exhibit-canvas" role="img" aria-label={`Population in ${year}: forecast ${fmt(m,value).value}${fmt(m,value).unit}${base!==null?`, UN reference ${fmt(m,base).value}${fmt(m,base).unit}`:''}`}>
 {[6,8,10,12].map(v=><g key={v}><path d={`M45 ${y(v)}h510`} stroke="currentColor" opacity=".12"/><text x="32" y={y(v)+4} textAnchor="end" className="diagram-label">{v}B</text></g>)}
 {!m.keyframes && <path d={path(other)} fill="none" stroke="var(--d)" opacity=".4" strokeDasharray="5 5"/>}
 <path d={path(a)+` L555 260H45Z`} fill="var(--d)" opacity=".09"/><path d={path(a)} fill="none" stroke="var(--d)" strokeWidth="3"/>
 {ref&&<path d={path(ref.points as [number,number][])} fill="none" stroke="#ead19c" strokeWidth="2" strokeDasharray="2 6"/>}
 <path d={`M${x(year)} 35V260`} stroke="currentColor" opacity=".5"/><circle cx={x(year)} cy={y(value)} r="6" fill="var(--d)"/>{base!==null&&<circle cx={x(year)} cy={y(base)} r="5" fill="#ead19c"/>}
 <text x="45" y="295" className="diagram-label">2026</text><text x="555" y="295" textAnchor="end" className="diagram-label">2100</text>
 </svg><label className="exhibit-slider" htmlFor={uid+'-year'}><span>Explore the year <strong>{year}</strong></span><input id={uid+'-year'} type="range" min="2026" max="2100" value={year} onChange={e=>setYear(Number(e.target.value))}/></label>
 <div className="population-values" aria-live="polite"><div><span>Our {m.keyframes ? "forecast" : `${branch} path`}</span><strong>{fmt(m,value).value}{fmt(m,value).unit}</strong></div>{base!==null&&<div><span>UN WPP 2024 reference</span><strong>{fmt(m,base).value}{fmt(m,base).unit}</strong></div>}</div>
 <div className="exhibit-foot">Solid: our forecast · {m.keyframes ? "" : "dashed: other path · "}dotted gold: UN</div></>;
}
