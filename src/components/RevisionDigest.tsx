import {useEffect,useState} from 'react';
import {data} from '../data';
import {useStore} from '../store';
const key='next100-reviewed-revisions-v1';
export const revisionKey=(e:{id:string;history:unknown[]})=>JSON.stringify([e.id,e.history]);
export default function RevisionDigest() {
 const {select}=useStore();
 const [seen,setSeen]=useState<Record<string,string>|null>(null);
 const [ready,setReady]=useState(false);
 useEffect(()=>{try{const saved=localStorage.getItem(key);if(saved)setSeen(JSON.parse(saved));}catch{/* private browsing */}setReady(true);},[]);
 const changed=seen?data.events.filter(e=>seen[e.id]!==revisionKey(e)):[];
 const latest=[...data.changelog].reverse().slice(0,3);
 const mark=()=>{const next=Object.fromEntries(data.events.map(e=>[e.id,revisionKey(e)]));setSeen(next);try{localStorage.setItem(key,JSON.stringify(next));}catch{/* remain useful this session */}};
 const upcoming=[...data.events].filter(e=>e.status==='forecast'&&e.resolution?.assessAfter).sort((a,b)=>a.resolution!.assessAfter!.localeCompare(b.resolution!.assessAfter!)).slice(0,3);
 return <section className="revision-digest" aria-labelledby="digest-title"><div className="eyebrow">A living record</div><h2 id="digest-title">What changed?</h2><p>{!ready?'Recent editorial updates':seen?`${changed.length} forecast${changed.length===1?' has':'s have'} changed since you last marked the updates as read.`:'Start here on your next visit. Your reading checkpoint stays on this device.'}</p>
 {seen&&changed.length>0&&<div className="digest-links">{changed.map(e=><button key={e.id} onClick={()=>select(e.id)}>{e.title}<span>{seen[e.id]?'Updated':'New'} ↗</span></button>)}</div>}
 <div className="digest-grid">{latest.map((l,i)=><article key={`${l.date}-${i}`}><time>{l.date}</time><h3>{l.headline}</h3><p>{l.body}</p></article>)}</div>
 <button onClick={mark}>{seen?'Mark current updates as read':'Remember this edition'}</button>
 <details><summary>Next scheduled evidence assessments</summary>{upcoming.map(e=><button className="link" key={e.id} onClick={()=>select(e.id)}>{e.resolution?.assessAfter} · {e.title}</button>)}<p className="note">These are reporting and adjudication dates, not extensions of the event deadlines.</p></details>
 </section>;
}
