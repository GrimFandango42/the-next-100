/** Score only evidence-backed outcomes against an unchanged, frozen question. */
export type Question = {
 title?: string; year?: number; yearEnd?: number | null; timing?: string; branch?: string | null;
 resolution?: {version?: string; mode?: string; test?: string} | null;
};
export type Scorable = Question & {
 id:string; title:string; year:number; status?:string; resolvedOn?:string;
 adjudication?:{definitionVersion?:string; outcome:0|1; rationale:string; sources:string[]};
};
export type Vintage = {date:string; events:Record<string,Question & {probability:number|null}>};
export function sameQuestion(a:Question,b:Question) {
 return !!a.resolution?.version && !!a.resolution.test && a.resolution.version===b.resolution?.version
  && a.resolution.test===b.resolution.test && a.resolution.mode===b.resolution.mode
  && a.year===b.year && (a.yearEnd??null)===(b.yearEnd??null)
  && (a.timing??'around')===(b.timing??'around') && (a.branch??null)===(b.branch??null);
}
export function scoreEvent(e:Scorable,vintages:Vintage[]) {
 const unscored=(reason:string)=>({id:e.id,score:null as number|null,caveat:null as string|null,reason});
 if(e.resolution?.mode==='scenario')return unscored('Narrative scenario; no binary test, never scored.');
 if(!e.status || e.status==='forecast')return unscored('Still open.');
 if(['partial','retired'].includes(e.status))return unscored(`${e.status}: listed, not scored.`);
 const a=e.adjudication;
 if(!a || !e.resolvedOn || !a.rationale.trim() || !a.sources.length)return unscored('Needs an explicit outcome, rationale and evidence. Early/late status alone is not an outcome.');
 if(a.definitionVersion!==e.resolution?.version)return unscored('Adjudication refers to a different question version.');
 const previous=[...vintages].sort((a,b)=>a.date.localeCompare(b.date)).filter(v=>v.date<e.resolvedOn! && v.events[e.id]);
 const v=previous.find(v=>sameQuestion(e,v.events[e.id]) && v.events[e.id].probability!=null);
 if(!v)return unscored('No pre-resolution probability for this exact definition and time window. Historical odds remain visible but unscoreable against this question.');
 const p=v.events[e.id].probability!;
 const original=previous[0]===v;
 return {id:e.id,score:(p-a.outcome)**2,caveat:original?null:'Revised-question score. Earlier founding odds are preserved, not retrofitted.',reason:`${original?'Original':'Revised'} question ${e.resolution!.version}; vintage ${v.date}; probability ${p}; adjudicated outcome ${a.outcome}`};
}
