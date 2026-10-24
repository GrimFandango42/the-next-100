import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const events=JSON.parse(readFileSync(new URL('../data/events.json',import.meta.url)));
const citations=JSON.parse(readFileSync(new URL('../data/citations.json',import.meta.url)));
const rows=events.map(e=>{const urls=[...new Set(e.history.flatMap(h=>h.sources??[]))];return {id:e.id,mode:e.resolution?.mode,definition:e.resolution?.version,citedUrls:urls.length,missingMetadata:urls.filter(u=>!citations[u]),checkedThisPass:urls.filter(u=>citations[u]?.checked==='2026-10-24'),signals:e.signals.length};});
const result={reviewDate:'2026-10-24',scope:'Coverage inventory for all lines; primary-source spot checks for the new exhibits. Metadata presence is not verification of a claim or its probability.',summary:{lines:rows.length,testable:rows.filter(r=>r.mode==='testable').length,scenarios:rows.filter(r=>r.mode==='scenario').length,withoutCitations:rows.filter(r=>!r.citedUrls).length,missingMetadata:rows.reduce((n,r)=>n+r.missingMetadata.length,0)},rows};
mkdirSync(new URL('../docs/',import.meta.url),{recursive:true});
writeFileSync(new URL('../docs/evidence-coverage-2026-10-24.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(result.summary);
