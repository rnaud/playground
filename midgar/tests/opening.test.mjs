// Run with: node --test midgar/tests/opening.test.mjs
// Exercise the real scene state and input handlers without a browser or canvas dependency.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../scene.js', import.meta.url), 'utf8')
  .replace(/^import .*$/m, '');
function opening(reduced = false) {
  const elements = new Map(), events = {}, frames = [], pieces = [];
  let cancelled = 0, resumes = 0;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      style:{}, checked:false, disabled:false, hidden:false, listeners:{},
      querySelector:element, setAttribute(){}, closest(){return null;},
      addEventListener(type, fn){this.listeners[type] = fn;},
      animate(){return {cancel(){cancelled++;}};}
    });
    return elements.get(id);
  }
  const document = {getElementById:element, activeElement:null, hidden:false};
  const paper = {look(){},step(){return 0;},restart(){},resume(){resumes++;}};
  const H = {rnd:()=>.5,frame:{aspect:16/9}, printGround(){},
    piece(outline,paint,options){const p={...options};pieces.push(p);return p;},
    setHero(){},start(){}};
  runInNewContext(source, {
    createHarness2D:()=>H, document, window:{__papercraft:paper},
    innerWidth:1440, innerHeight:810, matchMedia:()=>({matches:reduced}),
    addEventListener:(type,fn)=>{events[type]=fn;}, requestAnimationFrame:fn=>frames.push(fn)
  });
  const click = () => element('action').listeners.click();
  const key = (overrides={}) => events.keydown({code:'Space',preventDefault(){},...overrides});
  const enter = () => {click();click();};
  const finish = () => {
    for(const seconds of [.8,1.15,.65]) {paper.step(seconds);click();}
    assert.equal(element('title').textContent,'Arrival');
    paper.step(5);
    assert.equal(element('title').textContent,'Cloud Strife');
  };
  return {element,document,paper,pieces,frames,click,key,enter,finish,
    get cancelled(){return cancelled;},get resumes(){return resumes;}};
}

test('a missed signal is retryable; three timed signals reach a stationary landing', () => {
  const o=opening();o.enter();o.click();
  assert.match(o.element('story').textContent,/Nothing lost/);
  assert.match(o.element('chapter').textContent,/1 OF 3/);
  o.finish();
  const cloud=o.pieces.at(-2), landed={...cloud};
  assert.ok(Math.abs(cloud.y)<1e-9);
  o.paper.step(2);
  assert.deepEqual(cloud,landed);
});

test('replay restores the train and both character cards, then completes again', () => {
  const o=opening(), initial=o.pieces.slice(-5).map(p=>({...p}));
  o.enter();o.finish();o.click();
  assert.equal(o.element('title').textContent,'The flower seller');
  assert.deepEqual(o.pieces.slice(-5),initial);
  assert.equal(o.element('controls').hidden,true);
  assert.equal(o.element('action').disabled,false);
  o.enter();o.finish();
});

test('keyboard repeat cannot skip a chapter; native controls retain Space', () => {
  const o=opening();o.key({repeat:true});
  assert.equal(o.element('title').textContent,'The flower seller');
  o.key();assert.equal(o.element('title').textContent,'City of mako');
  o.document.activeElement={closest:()=>true};o.key();
  assert.equal(o.element('title').textContent,'City of mako');
  o.document.activeElement=o.element('action');o.key();
  assert.equal(o.element('title').textContent,'The last train');
});

test('untimed mode preserves all three signals and guards input during arrival', () => {
  const o=opening();o.enter();o.element('assist').checked=true;
  o.element('assist').listeners.change();
  assert.equal(o.element('meter').hidden,true);
  for(let i=0;i<3;i++)o.click();
  assert.equal(o.element('action').disabled,true);
  o.click();o.key();assert.equal(o.element('title').textContent,'Arrival');
  o.paper.step(5);assert.equal(o.element('title').textContent,'Cloud Strife');
  o.click();assert.equal(o.element('assist').checked,true);
});

test('rapid chapter changes cancel the reveal; capture restart restores the opening', () => {
  const o=opening();o.enter();assert.equal(o.cancelled,1);
  o.finish();o.paper.restart();
  assert.equal(o.element('title').textContent,'The flower seller');
  o.enter();o.finish();
});

test('reduced motion completes the same opening and skips the camera animation', () => {
  const o=opening(true);o.enter();o.finish();assert.equal(o.cancelled,0);
});

test('repeated capture resume requests start only one paper loop', () => {
  const o=opening();o.paper.step(0);o.paper.resume();o.paper.resume();
  o.paper.step(0);o.paper.resume();
  const queued=o.frames.splice(0);for(const frame of queued)frame(0);
  assert.equal(o.resumes,1);
});
