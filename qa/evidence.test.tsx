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
const e:Scorable={id:'deadline',title:'A deadline line',year:2030,status:'late',resolvedOn:'2032-01-01',resolution:{version:'v2',mode:'testable',test:'new wording'},adjudication:{definitionVersion:'v2',outcome:0,rationale:'Occurred after deadline',sources:['https://example.org']}};
const vintages:Vintage[]=[{date:'2026-01-01',events:{deadline:{probability:.9,title:'A deadline line',year:2030,resolution:{version:'v1',test:'old wording'}}}},{date:'2027-01-01',events:{deadline:{probability:.8,title:'A deadline line',year:2030,resolution:{version:'v2',test:'new wording'}}}}];
test('a late deadline miss scores as a miss against the EARLIEST vintage that holds the question',()=>{
 const r=scoreEvent(e,vintages);assert.equal(r.score,.9**2);assert.match(r.caveat??'',/reworded/);
});
test('scenarios, open lines, partial/retired and retitled questions are not scored',()=>{
 assert.equal(scoreEvent({...e,resolution:{version:'v1',mode:'scenario'}},vintages).score,null);
 assert.equal(scoreEvent({...e,status:'forecast'},vintages).score,null);
 assert.equal(scoreEvent({...e,status:'partial'},vintages).score,null);
 assert.equal(scoreEvent({...e,title:'A different question'},vintages).score,null);
 assert.equal(scoreEvent({...e,resolvedOn:'2025-06-01'},vintages).score,null);
});
test('a status without adjudication still scores, with a caveat',()=>{
 const r=scoreEvent({...e,adjudication:undefined,status:'happened'},vintages);assert.equal(r.score,(.9-1)**2);assert.match(r.caveat??'',/no adjudication sources/);
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
