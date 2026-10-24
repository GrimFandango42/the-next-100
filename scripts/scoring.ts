/** Score only an explicit, evidence-backed adjudication against the same frozen question. */
export type Scorable = {
 id: string; status?: string; resolvedOn?: string;
 resolution?: {version?: string; mode?: string};
 adjudication?: {definitionVersion: string; outcome: 0|1; rationale: string; sources: string[]};
};
export type Vintage = {date:string; events:Record<string,{probability:number|null; resolution?:{version?:string;mode?:string}}>};
export function scoreEvent(e:Scorable, vintages:Vintage[]) {
 const unscored=(reason:string)=>({id:e.id,score:null as number|null,reason});
 if(e.resolution?.mode==='scenario')return unscored('Narrative scenario; no agreed binary test.');
 if(!e.adjudication || !e.resolvedOn || !e.adjudication.rationale || !e.adjudication.sources.length)return unscored('Needs explicit outcome and evidence; status alone is insufficient.');
 if(e.adjudication.definitionVersion!==e.resolution?.version)return unscored('Adjudication refers to a different definition.');
 const v=[...vintages].sort((a,b)=>a.date.localeCompare(b.date)).find(v=>v.date<e.resolvedOn! && v.events[e.id]?.resolution?.version===e.adjudication!.definitionVersion);
 if(!v)return unscored('No pre-resolution vintage with this exact definition. Legacy odds are not retrofitted.');
 const p=v.events[e.id].probability;
 if(p==null)return unscored('No probability in the matching vintage.');
 return {id:e.id,score:(p-e.adjudication.outcome)**2,reason:`Definition ${e.adjudication.definitionVersion}; vintage ${v.date}; outcome ${e.adjudication.outcome}`};
}
