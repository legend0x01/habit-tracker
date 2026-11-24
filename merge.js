/* Three-way merge of one year of habit data, used when two devices edited the same year.
   B = the last copy this device and the cloud agreed on (null if none), L = this device, R = the cloud.
   Loaded by index.html (functions become globals) and by tests/merge.test.js (module.exports). */
(function(root){
"use strict";
const isObj=v=>v&&typeof v==="object"&&!Array.isArray(v);
function same(a,b){ // deep equality that ignores key order (Postgres jsonb reorders keys)
  if(a===b)return true;
  if(Array.isArray(a)){if(!Array.isArray(b)||a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(!same(a[i],b[i]))return false;return true}
  if(isObj(a)&&isObj(b)){const ka=Object.keys(a);if(ka.length!==Object.keys(b).length)return false;for(const k of ka)if(!(k in b)||!same(a[k],b[k]))return false;return true}
  return false}
const sameY=(a,b)=>same({...a,updatedAt:0},{...b,updatedAt:0});
function pick(b,l,r,text){ // one value: whichever side changed it wins; if both did, this device wins
  if(same(l,r))return l;
  if(b!=null){if(same(l,b))return r;return l}
  return text?(String(r||"").length>=String(l||"").length?r:l):r} // no shared history: trust the cloud (longer note)
function mergeBits(b,l,r){ // '0'/'1' tick strings, merged day by day
  l=l||"";r=r||"";const n=Math.max(l.length,r.length);l=l.padEnd(n,"0");r=r.padEnd(n,"0");let s="";
  if(b==null){for(let i=0;i<n;i++)s+=l[i]==="1"||r[i]==="1"?"1":"0";return s} // no history: keep every tick
  b=b.padEnd(n,"0");for(let i=0;i<n;i++)s+=l[i]!==b[i]?l[i]:r[i];return s}
function mergeBitsMap(b,l,r,keep){const o={};for(const k of new Set([...Object.keys(l),...Object.keys(r)]))if(keep.has(k))o[k]=mergeBits(b?b[k]??null:null,l[k],r[k]);return o}
function mergeList(b,l,r,fn){ // habit lists, matched by id
  const bm=new Map((b||[]).map(x=>[x.id,x])),rm=new Map(r.map(x=>[x.id,x])),lm=new Set(l.map(x=>x.id)),out=[];
  for(const x of l){const y=rm.get(x.id);
    if(y)out.push(fn(bm.get(x.id),x,y));
    else if(!bm.has(x.id)||!same(x,bm.get(x.id)))out.push(x)} // added here (or edited here after the other device deleted it)
  r.forEach((y,i)=>{if(lm.has(y.id))return;const bx=bm.get(y.id);if(bx&&same(y,bx))return; // deleted here
    out.splice(Math.min(i,out.length),0,y)}); // added on another device
  return out}
function mergeYear(B,L,R){
  const o={...R,...L};
  o.carry=pick(B&&B.carry,L.carry,R.carry);
  // a base habit/category saved before categories existed has no cat/col field: treat it as "" so it still counts as shared history
  o.cats=mergeList(B&&B.cats,L.cats||[],R.cats||[],(b,l,r)=>({...r,...l,name:pick(b&&b.name,l.name,r.name),col:pick(b?b.col??"":null,l.col,r.col)}));
  o.habits=mergeList(B&&B.habits,L.habits,R.habits,(b,l,r)=>({...r,...l,name:pick(b&&b.name,l.name,r.name),cat:pick(b?b.cat??"":null,l.cat??"",r.cat??""),goals:l.goals.map((g,i)=>pick(b&&b.goals[i],g,r.goals[i]))}));
  o.weekly=mergeList(B&&B.weekly,L.weekly,R.weekly,(b,l,r)=>({...r,...l,name:pick(b&&b.name,l.name,r.name),months:l.months.map((v,i)=>pick(b&&b.months[i],v,r.months[i]))}));
  o.checks=mergeBitsMap(B&&B.checks,L.checks,R.checks,new Set(o.habits.map(h=>h.id)));
  o.wchecks=mergeBitsMap(B&&B.wchecks,L.wchecks,R.wchecks,new Set(o.weekly.map(w=>w.id)));
  o.notes=L.notes.map((t,i)=>pick(B&&B.notes&&B.notes[i],t,R.notes[i],true));
  o.updatedAt=Math.max(L.updatedAt||0,R.updatedAt||0);
  return o}

const api={isObj,same,sameY,pick,mergeBits,mergeBitsMap,mergeList,mergeYear};
if(typeof module==="object"&&module.exports)module.exports=api;else Object.assign(root,api);
})(typeof globalThis!=="undefined"?globalThis:this);
