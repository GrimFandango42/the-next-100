import {data} from '../data';
const threads=[{id:'ai',label:'Intelligence',color:'#91b8dc'},{id:'hinge',label:'Institutions',color:'#e1bb83'},{id:'demography',label:'People',color:'#b6d6a4'},{id:'planet',label:'Planet',color:'#8ccfc7'}];
export default function ChapterWeave({index,onThread}:{index:number;onThread:(id:string)=>void}) {
 const era=data.eras[index];
 return <div className="chapter-weave"><div className="signature-kicker">FOUR THREADS <span>CHAPTER {String(index+1).padStart(2,'0')}</span></div><h3>Nothing changes alone.</h3>
 <svg viewBox="0 0 600 390" role="img" aria-label={`Four topic strands through five chapters; chapter ${index+1} highlighted. Lines are narrative connections, not a causal model.`}>
  {data.eras.map((er,i)=><g key={er.id}><path d={`M${60+i*120} 35V345`} stroke="currentColor" opacity={i===index ? .22 : .07}/><text x={60+i*120} y="375" textAnchor="middle" fill={i===index?'#e1bb83':'#91a598'} fontSize="14" fontFamily="monospace">{er.from}</text></g>)}
  {threads.map((t,j)=>{const ys=[85+j*62,130+((j+1)%4)*50,90+((j+2)%4)*65,100+((j+1)%4)*60,75+j*70];const d=ys.map((y,i)=>i?`C${60+(i-1)*120+60} ${ys[i-1]} ${60+i*120-60} ${y} ${60+i*120} ${y}`:`M60 ${y}`).join(' ');return <g key={t.id}><path d={d} fill="none" stroke={t.color} strokeWidth="2" opacity=".6"/>{ys.map((y,i)=><g key={i}><circle cx={60+i*120} cy={y} r={i===index?12:4} fill={i===index?t.color:'#101d19'} stroke={t.color} strokeWidth="2"/>{i===index&&<circle cx={60+i*120} cy={y} r="23" fill="none" stroke={t.color} opacity=".25"/>}</g>)}</g>})}
 </svg>
 <div className="thread-buttons">{threads.map(t=>{const count=data.events.filter(e=>e.force===t.id&&e.year>=era.from&&(e.year<era.to||index===data.eras.length-1)).length;return <button key={t.id} onClick={()=>onThread(t.id)} style={{['--thread' as any]:t.color}}><i/><span><b>{t.label}</b><small>{count} forecast{count===1?'':'s'} in this chapter</small></span><span aria-hidden="true">↗</span></button>})}</div>
 <p className="weave-note">Follow a thread across the book. Lines show themes, not measured influence; positions mark chapter order.</p>
 </div>;
}
