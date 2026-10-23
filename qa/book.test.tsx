import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { data } from "../src/data";
import StoryJourney from "../src/components/StoryJourney";
import { ART_PLANS } from "../src/components/PredictionArt";
import { StoreProvider } from "../src/store";

function render(search = "") {
  Object.defineProperty(globalThis,"location",{value:new URL(`https://forecast.test/${search}`),configurable:true});
  return renderToStaticMarkup(<StoreProvider><StoryJourney/></StoreProvider>);
}

test("every forecast has exactly one illustrated page, in chronological order",()=>{
  const html=render();
  const ids=[...html.matchAll(/data-event-id="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,data.events.length);
  assert.equal(new Set(ids).size,data.events.length);
  assert.deepEqual(new Set(ids),new Set(data.events.map(e=>e.id)));
  const years=ids.map(id=>data.events.find(e=>e.id===id)!.year);
  assert.deepEqual(years,[...years].sort((a,b)=>a-b));
  assert.equal((html.match(/class="guide-scene chapter-scene/g)||[]).length,data.eras.length);
});

test("all in-page destinations exist and no HTML/SVG ids collide",()=>{
  const html=render();
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,"Duplicate anchor or SVG definition");
  // Evidence is owned by App rather than the book component.
  const destinations=new Set([...ids,"explore"]);
  for(const m of html.matchAll(/href="#([^"]+)"/g)) assert.ok(destinations.has(m[1]),`Missing anchor: ${m[1]}`);
});

test("every current prediction has purpose-selected artwork",()=>{
  for(const event of data.events){
    if(["agents-default-knowledge-work","hinge-resolves"].includes(event.id))continue;
    assert.ok(ART_PLANS[event.id],`Choose artwork for ${event.id}`);
  }
  assert.ok(new Set(Object.values(ART_PLANS).map(p=>p.kind)).size>=25,"The journey should not repeat a handful of generic visuals");
});

test("scenario deep links preserve the selected fork",()=>{
  const html=render("?b=concentration");
  assert.match(html,/class="future-option concentration" aria-pressed="true"/);
  assert.match(html,/Following the <b>concentration<\/b> path/);
});
