import type {ForecastEvent} from '../schema';
export default function ProbabilityHistory({event:e}:{event:ForecastEvent}) {
 const moves=e.history.filter(h=>h.from!=null&&h.to!=null);
 if(!moves.length||e.resolution?.mode==='scenario')return null;
 const points=[{date:moves[0].date,value:moves[0].from!,label:'Before first recorded revision'},...moves.map(h=>({date:h.date,value:h.to!,label:h.change}))];
 return <div className="probability-history"><div className="eyebrow">How the judgment moved</div><div className="probability-steps">{points.map((p,i)=><div key={i}><div className="probability-column"><i style={{height:`${p.value*100}%`}}/></div><strong>{Math.round(p.value*100)}%</strong><time>{p.date}</time><span>{i===0?'Before revision':`Revision ${i}`}</span></div>)}</div><p className="note">Recorded editorial probabilities, in revision order. Equal spacing does not represent elapsed time. The resolution history determines which question each probability can be scored against.</p></div>;
}
