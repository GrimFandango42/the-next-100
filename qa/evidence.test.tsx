import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {data} from '../src/data';
import Figure from '../src/components/Figure';
import {scoreEvent,type Scorable,type Vintage} from '../scripts/scoring';
const figure=(id:string)=>renderToStaticMarkup(<Figure ev={data.events.find(e=>e.id===id)!} year={2030} branch="pluralism" active/>);
test('hiring figure communicates the measured gap rather than destroyed jobs',()=>{
 const html=figure('entry-level-hiring-contracts');assert.match(html,/19%/);assert.match(html,/Relative employment shortfall/);assert.doesNotMatch(html,/50 of 100|roles.*gone/);
});
test('probability figures follow current data, not historical overrides',()=>{
 for(const id of ['ai-runs-rd-programs','mass-casualty-event']) {
  const e=data.events.find(e=>e.id===id)!;assert.ok(figure(id).includes(`${Math.round(e.probability!*100)} of 100 futures`));
 }
});
test('all six exhibits expose meaningful controls and avoid invented numeric thresholds',()=>{
 for(const id of ['quantum-chemistry-advantage','in-vivo-editing-common-disease','fusion-net-grid','ai-drugs-phase-iii','data-centres-tenth-us-power'])assert.match(figure(id),/aria-pressed/);
 assert.match(figure('population-peak'),/type="range"/);
 assert.match(figure('data-centres-tenth-us-power'),/15.3%/);
 assert.doesNotMatch(figure('quantum-chemistry-advantage'),/1000|1,000/);
});
const e:Scorable={id:'deadline',title:'A deadline',year:2030,yearEnd:2032,timing:'window',status:'late',resolvedOn:'2034-01-01',resolution:{version:'v2',mode:'testable',test:'new question'},adjudication:{definitionVersion:'v2',outcome:0,rationale:'Missed the event deadline',sources:['https://example.org/report']}};
const vintages:Vintage[]=[{date:'2026-01-01',events:{deadline:{probability:.9,title:e.title,year:2030,yearEnd:2031,timing:'window',resolution:{version:'v1',mode:'testable',test:'old question'}}}},{date:'2027-01-01',events:{deadline:{...e,probability:.8}}}];
test('a late deadline miss scores zero outcome against the matching question',()=>{
 const r=scoreEvent(e,vintages);assert.equal(r.score,.8**2);assert.match(r.caveat??'',/Revised-question/);
});
test('status, changed windows, versions and retrospective odds cannot substitute for adjudication',()=>{
 for(const status of ['happened','early','late','missed'])assert.equal(scoreEvent({...e,status,adjudication:undefined},vintages).score,null);
 assert.equal(scoreEvent({...e,yearEnd:2033},vintages).score,null);
 assert.equal(scoreEvent({...e,timing:'by'},vintages).score,null);
 assert.equal(scoreEvent({...e,branch:'concentration'},vintages).score,null);
 assert.equal(scoreEvent({...e,adjudication:{...e.adjudication!,definitionVersion:'v1'}},vintages).score,null);
 assert.equal(scoreEvent({...e,resolvedOn:'2026-06-01'},vintages).score,null);
 assert.equal(scoreEvent({...e,resolution:{...e.resolution!,mode:'scenario'}},vintages).score,null);
});
test('a wording change needs a matching frozen definition even if its title is unchanged',()=>{
 assert.equal(scoreEvent({...e,resolution:{...e.resolution!,test:'easier question'}},vintages).score,null);
});
test('every forecast states a versioned test or explicit scenario limitation, and real signals',()=>{
 for(const e of data.events){assert.ok(e.resolution?.version,e.id);assert.ok(e.signals.length,e.id);assert.ok(!e.signals.some(s=>/published resolution definition/.test(s)),e.id)}
});

test('annual grid balance counts downtime and continuous auxiliary consumption',async()=>{
 const {annualBalance}=await import('../src/components/ExhibitLabs');
 assert.equal(annualBalance(100,50,40).net,87600);
 assert.equal(annualBalance(100,40,40).net,0);
 assert.ok(annualBalance(100,25,40).net<0);
 assert.equal(annualBalance(100,0,40).generated,0);
});

test('population extract covers every year and region and preserves UN variant crossings',async()=>{
 const pop=(await import('../data/exhibits/population.json')).default;
 for(const [variant,expected] of [['low',2057],['medium',2058],['high',2059]] as const){
  const rows=pop.variants[variant];assert.equal(rows.length,231);
  let crossing:number|undefined;
  for(let year=2024;year<=2100;year++){
   const r=rows.filter(p=>p.year===year);assert.equal(new Set(r.map(p=>p.region)).size,3);
   assert.ok(r.every(p=>p.working>0&&p.children>0&&p.older>0));
   if(!crossing&&r.find(p=>p.region==='Africa')!.working>r.filter(p=>p.region!=='Africa').reduce((s,p)=>s+p.working,0))crossing=year;
  }
  assert.equal(crossing,expected);
 }
});
test('Arctic chart preserves monthly observations and does not invent future extent',async()=>{
 const ice=(await import('../data/exhibits/arctic.json')).default;
 assert.match(ice.measure,/monthly mean.*extent/);assert.equal(ice.points.length,48);
 assert.deepEqual(ice.points[0],[1979,7.05]);assert.deepEqual(ice.points.at(-1),[2026,4.81]);
 assert.equal(ice.points.find(p=>p[0]===2012)![1],3.57);
 assert.ok(ice.points.every(([year,value],i)=>year===1979+i&&value>0));
});
test('external Taiwan projection is attributed and incompatible denominators stay separate',()=>{
 const e=data.events.find(e=>e.id==='taiwan-leading-edge-share-falls')??data.events.find(e=>e.id.includes('taiwan'))!;
 const bars=e.hero?.bars??[];assert.ok(bars.length);
 assert.equal(bars[2].kind,'reference');assert.notEqual(bars[0].comparisonGroup,bars[2].comparisonGroup);
});
