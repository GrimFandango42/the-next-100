import {useId, useState} from 'react';

export const annualBalance = (grossMW:number, availability:number, auxiliaryMW:number) => ({
  generated: grossMW * availability / 100 * 8760,
  consumed: auxiliaryMW * 8760,
  net: (grossMW * availability / 100 - auxiliaryMW) * 8760,
});

/** A transparent thought experiment, never a projection of a named plant. */
export function FusionLab() {
  const [availability,setAvailability]=useState(50);
  const [auxiliary,setAuxiliary]=useState(40);
  const id=useId();
  const result=annualBalance(100,availability,auxiliary);
  return <details className="exhibit-lab"><summary>Can this plant actually power the grid?</summary>
    <p>Try an illustrative 100 MW generator. Auxiliary demand runs all year, including downtime. These inputs are invented for learning, not estimates for a real plant.</p>
    <label htmlFor={id+'-availability'}>Operating availability <b>{availability}%</b></label><input id={id+'-availability'} type="range" min="0" max="100" step="5" value={availability} onChange={e=>setAvailability(+e.target.value)}/>
    <label htmlFor={id+'-aux'}>Continuous auxiliary load <b>{auxiliary} MW</b></label><input id={id+'-aux'} type="range" min="0" max="100" step="5" value={auxiliary} onChange={e=>setAuxiliary(+e.target.value)}/>
    <div className="energy-ledger" aria-live="polite">{[['Generation',result.generated],['Plant consumption',result.consumed]].map(([label,value])=><div key={label}><span>{label}</span><i style={{width:`${Number(value)/8760}%`}}/><b>{Math.round(Number(value)/1000)} GWh</b></div>)}<strong className={result.net>0?'net-positive':'net-negative'}>{result.net>0?'+':''}{Math.round(result.net/1000)} GWh net / year</strong><span>{result.net>0?'Positive in this simplified model. Real verification requires metered imports and exports.':'A generator can produce electricity and still be a net consumer.'}</span></div>
    <p className="exhibit-foot">Net = (100 MW × availability − auxiliary MW) × 8,760 hours. Ignores storage, transmission losses and variable operating loads.</p>
  </details>;
}
const checks=[
 ['Useful question','A chemically meaningful result, with accuracy specified before testing.'],
 ['Fair comparison','A named, competitive classical method, including the full computational cost.'],
 ['Independent replication','An outside group verifies the result.'],
 ['Durable advantage','Classical methods do not match the result for 12 months.'],
];
export function QuantumLab() {
 const [selected,setSelected]=useState<boolean[]>([false,false,false,false]);
 const count=selected.filter(Boolean).length;
 return <details className="exhibit-lab"><summary>Would this result count?</summary><p>Build a hypothetical evidence package. Checking these boxes changes this exercise only; it does not mark the forecast achieved.</p>
 <div className="verification-grid">{checks.map(([title,detail],i)=><label key={title}><input type="checkbox" checked={selected[i]} onChange={e=>setSelected(s=>s.map((v,j)=>j===i?e.target.checked:v))}/><span><b>{title}</b><small>{detail}</small></span></label>)}</div>
 <div className="verification-result" aria-live="polite"><b>{count} / 4 requirements</b><p>{count===4?'This hypothetical package meets the four evidence requirements. The publication and verification windows must also be met; read “What counts” for the complete test.':`Still missing: ${checks.filter((_,i)=>!selected[i]).map(c=>c[0].toLowerCase()).join(', ')}.`}</p></div></details>;
}
const tissues=[
 {name:'Blood, outside the body',route:'Cells → editing → checks → reinfusion',constraint:'Cells can be collected and edited outside the body. Treatment still requires a clinical process, monitoring and eligibility.',test:'This route is the approved precedent described above; it does not satisfy the in-body forecast.'},
 {name:'Liver, inside the body',route:'Dose → bloodstream → liver cells',constraint:'The editor must reach the intended cells at an effective dose while limiting immune effects and unintended changes.',test:'Delivery is one gate. Durable patient benefit, safety and approval for a common indication are separate gates.'},
 {name:'Other tissues',route:'Dose → tissue barrier → target cell',constraint:'A delivery method that works in one tissue cannot be assumed to work in another. Distribution and cell targeting have to be established for each application.',test:'This is an open engineering and clinical question, not evidence that all organs can already be edited safely.'},
];
export function GeneLab() {
 const [target,setTarget]=useState(1);const t=tissues[target];
 return <details className="exhibit-lab"><summary>Why does the target tissue matter?</summary><div className="exhibit-controls" role="group" aria-label="Compare delivery routes">{tissues.map((t,i)=><button key={t.name} aria-pressed={target===i} onClick={()=>setTarget(i)}>{t.name}</button>)}</div><div className="delivery-route" aria-live="polite"><b>{t.route}</b><p>{t.constraint}</p><p>{t.test}</p></div><p className="exhibit-foot">Conceptual comparison · not medical guidance or a treatment simulation.</p></details>;
}
