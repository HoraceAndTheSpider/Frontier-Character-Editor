(function(){
'use strict';
const F=window.FrontierFaceData;
const $=id=>document.getElementById(id);

let sourceBytes=null,decoded=null,sourceName='',sourceHash=null;
let seed=0,control=0,selectedCategory='eyes_eyewear',usageNonce=0;


/* v0.02 automatic source loading. Manual loading remains the fallback. */
const AUTO_SOURCE_FILENAME='Frontier';

function uniqueUrls(urls){
  const seen=new Set(),out=[];
  for(const url of urls){if(!url||seen.has(url))continue;seen.add(url);out.push(url);}
  return out;
}

function autoSourceCandidates(){
  const urls=[],loc=window.location;
  if(/^https?:$/i.test(loc.protocol)){
    try{urls.push(new URL('../'+AUTO_SOURCE_FILENAME,loc.href).href);}catch(_){}
    try{urls.push(new URL(AUTO_SOURCE_FILENAME,loc.href).href);}catch(_){}
  }
  if(/\.github\.io$/i.test(loc.hostname)){
    const owner=loc.hostname.split('.')[0],parts=loc.pathname.split('/').filter(Boolean),repo=parts[0];
    if(owner&&repo)for(const branch of ['main','master'])urls.push(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${AUTO_SOURCE_FILENAME}`);
  }
  return uniqueUrls(urls);
}

async function loadBytes(bytes,name,originLabel='file'){
  sourceBytes=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  sourceName=name||AUTO_SOURCE_FILENAME;
  $('sourceStatus').className='status warn';$('sourceStatus').textContent='Decoding…';
  try{
    decoded=F.decodeAll(sourceBytes);
    try{sourceHash=await F.sha256(sourceBytes);}catch(_){sourceHash=null;}
    const exact=sourceHash===F.EXPECTED_SHA256;
    $('sourceStatus').className='status '+(exact?'ok':'warn');
    $('sourceStatus').textContent=exact?`Known Frontier executable verified (${originLabel}).`:`Face tables decoded from ${originLabel}, but this is not the exact known SHA-256 build (or hashing is unavailable).`;
    $('sourceMeta').textContent=`${sourceName} · ${sourceBytes.length.toLocaleString()} bytes${sourceHash?' · '+sourceHash.slice(0,12)+'…':''}`;
    renderAll();return true;
  }catch(err){
    decoded=null;$('sourceStatus').className='status bad';$('sourceStatus').textContent='Decode failed: '+(err?.message||err);
    $('sourceMeta').textContent=`${sourceName} · ${sourceBytes.length.toLocaleString()} bytes`;renderAll();return false;
  }
}

async function tryAutoLoad(){
  const candidates=autoSourceCandidates();
  if(!candidates.length){
    $('sourceStatus').className='status warn';
    $('sourceStatus').textContent='Automatic GitHub load is unavailable from this local page. Load Frontier manually.';
    return false;
  }
  $('sourceStatus').className='status warn';$('sourceStatus').textContent='Trying to load Frontier automatically…';
  const errors=[];
  for(const url of candidates){
    try{
      const response=await fetch(url,{cache:'no-store',mode:'cors'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const bytes=new Uint8Array(await response.arrayBuffer());
      if(!bytes.length)throw new Error('empty response');
      const ok=await loadBytes(bytes,AUTO_SOURCE_FILENAME,'automatic GitHub/web load');
      if(ok){$('sourceMeta').textContent+=`\n${url}`;return true;}
      errors.push(`${url} — unsupported Frontier executable`);
    }catch(err){errors.push(`${url} — ${err?.message||err}`);}
  }
  sourceBytes=null;decoded=null;sourceName='';sourceHash=null;
  $('sourceStatus').className='status warn';$('sourceStatus').textContent='Automatic Frontier load was not available. Load the executable manually.';
  $('sourceMeta').textContent=errors.length?`Auto-load tried ${errors.length} location${errors.length===1?'':'s'}.`:'';
  renderAll();return false;
}

const CATEGORY_LABELS=Object.fromEntries(F.CATEGORIES.map(c=>[c.key,c.label]));

function parseHex(text,bits){
  const cleaned=String(text||'').trim().replace(/^0x/i,'').replace(/[^0-9a-f]/gi,'');
  if(!cleaned)return 0;
  const n=parseInt(cleaned,16);
  if(!Number.isFinite(n))return 0;
  return bits===16?n&0xFFFF:n>>>0;
}
function setSeed(value){
  seed=value>>>0;
  $('seedInput').value=F.hex(seed,8);
  $('bankSelect').value=F.bankForSeed(seed);
  syncVariantFromSeed();
  renderAll();
}
function setControl(value){
  control=value&0xFFFF;
  $('controlInput').value=F.hex(control,4);
  syncVariantFromSeed();
  renderAll();
}
function currentPaletteChoice(face){
  const choice=$('paletteSelect').value;
  if(choice==='grey')return {index:face.paletteIndex,palette:F.displayPalette(face.paletteIndex,true),grey:true};
  const idx=choice==='auto'?face.paletteIndex:Number(choice)&7;
  return {index:idx,palette:F.displayPalette(idx,false),grey:false};
}
function currentVariant(){
  if(selectedCategory==='special_headgear')return F.headgearForControl(control);
  return F.variantFor(seed,selectedCategory);
}
function syncVariantFromSeed(){
  const select=$('variantSelect'),def=F.categoryDef(selectedCategory);
  select.innerHTML='';
  const count=def?.variants||8,current=currentVariant();
  for(let i=0;i<count;i++){
    const opt=document.createElement('option');
    opt.value=String(i);opt.textContent=`${i}`;
    select.appendChild(opt);
  }
  if(current!==null&&current<count)select.value=String(current);
  updateComponentUse();
}
function updateComponentUse(){
  const v=currentVariant();
  if(selectedCategory==='special_headgear'){
    $('componentUse').textContent=v===null?'Current face uses no special headgear.':'Current face uses special headgear variant '+v+'.';
  }else if(selectedCategory==='left_cheek_ear'||selectedCategory==='right_cheek_ear'){
    $('componentUse').textContent=`Variant ${v}; left and right cheek/ear records share the same runtime selector.`;
  }else{
    $('componentUse').textContent=`Current face uses variant ${v}.`;
  }
}

function drawBounds(canvas,entry){
  if(!$('showBounds').checked||!entry?.record)return;
  const ctx=canvas.getContext('2d');
  ctx.save();
  ctx.strokeStyle='#ffffff';ctx.lineWidth=1;ctx.setLineDash([2,2]);
  ctx.strokeRect(entry.record.x+.5,entry.record.y+.5,entry.record.width-1,entry.record.height-1);
  ctx.restore();
}
function renderFace(){
  const canvas=$('faceCanvas');
  if(!decoded){
    const ctx=canvas.getContext('2d');ctx.fillStyle='#090a0d';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#9aa1ad';ctx.font='8px sans-serif';ctx.fillText('Load Frontier',35,72);
    $('faceSummary').textContent='Load the Frontier executable to decode the original graphics.';
    return;
  }
  const face=F.composeFace(decoded,seed,control),pal=currentPaletteChoice(face);
  F.renderIndexed(canvas,face.pixels,face.width,face.height,pal.palette,false);
  const v=currentVariant(),entry=v===null?null:F.recordFor(decoded,face.bank,selectedCategory,v);
  drawBounds(canvas,entry);
  $('faceSummary').textContent=`Bank ${face.bank} · seed $${F.hex(seed,8)} · runtime palette ${face.paletteIndex}${face.headgear===null?'':' · headgear '+face.headgear}`;
  renderPalette(face,pal);
  renderSelectors(face);
}
function renderPalette(face,pal){
  const exact=F.DYNAMIC_PALETTES[pal.index];
  $('paletteInfo').textContent=pal.grey
    ?`Indexed greyscale display. Runtime palette selector resolves to ${face.paletteIndex}.`
    :`Palette ${pal.index}: exact runtime colours for indices 1–4. Indices 5–13 remain neutral reference colours pending full palette tracing.`;
  const host=$('paletteSwatches');host.innerHTML='';
  exact.forEach((word,i)=>{
    const c=F.rgb12(word),d=document.createElement('div');
    d.className='swatch';d.style.background=`rgb(${c[0]},${c[1]},${c[2]})`;
    d.textContent=`${i+1}: $${word.toString(16).toUpperCase().padStart(3,'0')}`;
    host.appendChild(d);
  });
}
function renderSelectors(face){
  const v=F.variantsForSeed(seed);
  $('selectorSummary').textContent=[
    `Bank: ${face.bank} (seed bit 0)`,
    `Hair / outer head: ${v.hair_head_outline}`,
    `Upper face / hairline: ${v.upper_face_hairline}`,
    `Neck / clothing: ${v.neck_shoulders_clothing}`,
    `Cheeks / ears: ${v.left_cheek_ear}`,
    `Lower face / chin: ${v.lower_face_chin}`,
    `Mouth: ${v.mouth}`,
    `Nose: ${v.nose}`,
    `Eyes / eyewear: ${v.eyes_eyewear}`,
    `Palette: ${face.paletteIndex}`,
    `Headgear: ${face.headgear===null?'none':face.headgear}`
  ].join('\n');
}
function renderComponent(){
  const canvas=$('componentCanvas'),ctx=canvas.getContext('2d');
  ctx.fillStyle='#090a0d';ctx.fillRect(0,0,canvas.width,canvas.height);
  if(!decoded){$('componentMeta').textContent='No component decoded.';return;}
  const bank=F.bankForSeed(seed),variant=currentVariant();
  if(variant===null){$('componentMeta').textContent='No special headgear in the current control state.';return;}
  const entry=F.recordFor(decoded,bank,selectedCategory,variant);
  if(!entry?.record){
    $('componentMeta').textContent=`Bank ${bank} / ${CATEGORY_LABELS[selectedCategory]} / variant ${variant}\nInvalid or unresolved table entry.\nTable word: $${F.hex(entry?.tableWord||0,4)}`;
    return;
  }
  const face=F.composeFace(decoded,seed,control),pal=currentPaletteChoice(face);
  F.renderIndexed(canvas,entry.record.pixels,entry.record.width,entry.record.height,pal.palette,true);
  const r=entry.record;
  $('componentMeta').textContent=[
    `Bank ${bank} · ${CATEGORY_LABELS[selectedCategory]}`,
    `Variant ${variant}`,
    `table @ $${F.hex(entry.tableEntryOffset,6)} = $${F.hex(entry.tableWord,4)}`,
    `bitmap @ $${F.hex(r.fileOffset,6)}`,
    `x=${r.x}, y=${r.y}`,
    `${r.width}×${r.height}px · ${r.widthWords} word(s) wide`,
    `payload ${r.payloadSize} bytes · 4 planar bitplanes`
  ].join('\n');
}
function makeRepresentativeSeed(i){
  let x=(seed ^ Math.imul(usageNonce+1,0x9E3779B9) ^ Math.imul(i+1,0x85EBCA6B))>>>0;
  x=(Math.imul(x^ (x>>>16),1664525)+1013904223)>>>0;
  x=(Math.imul(x^ (x>>>13),2246822519)+3266489917)>>>0;
  x=F.setBank(x,F.bankForSeed(seed));
  const variant=currentVariant();
  if(selectedCategory!=='special_headgear'&&variant!==null)x=F.setVariant(x,selectedCategory,variant);
  // Bank A hair selector 6 is the one unresolved/invalid table entry. Do not let
  // unrelated random examples look broken because of that known anomaly.
  if(F.bankForSeed(x)==='A'&&F.variantFor(x,'hair_head_outline')===6&&selectedCategory!=='hair_head_outline'){
    x=F.setVariant(x,'hair_head_outline',(i+2)&7);
    if(F.variantFor(x,'hair_head_outline')===6)x=F.setVariant(x,'hair_head_outline',0);
  }
  return x>>>0;
}
function renderUsage(){
  const host=$('usageGrid');host.innerHTML='';
  if(!decoded)return;
  for(let i=0;i<8;i++){
    const s=makeRepresentativeSeed(i),card=document.createElement('div'),canvas=document.createElement('canvas'),cap=document.createElement('div');
    canvas.width=128;canvas.height=144;
    const face=F.composeFace(decoded,s,control),pal=currentPaletteChoice(face);
    F.renderIndexed(canvas,face.pixels,128,144,pal.palette,false);
    card.className='usageCard';cap.className='seed';cap.textContent='$'+F.hex(s,8);
    card.append(canvas,cap);card.addEventListener('click',()=>setSeed(s));host.appendChild(card);
  }
}
function renderDeveloper(){
  if(!decoded){$('developerInfo').textContent='Known build SHA-256:\n'+F.EXPECTED_SHA256;return;}
  let valid=0,invalid=0,unique=new Set();
  for(const bank of ['A','B'])for(const def of F.CATEGORIES)for(const e of decoded[bank].categories[def.key]){
    if(e.record){valid++;unique.add(e.fileOffset);}else invalid++;
  }
  $('developerInfo').textContent=[
    `Source: ${sourceName}`,
    `SHA-256: ${sourceHash||'not available'}`,
    `Known build match: ${sourceHash===F.EXPECTED_SHA256?'yes':'no / unverified'}`,
    `Bank A table: $${F.hex(F.BANK_TABLES.A,6)}`,
    `Bank B table: $${F.hex(F.BANK_TABLES.B,6)}`,
    `Decoded table slots: ${valid} valid / ${invalid} invalid`,
    `Unique bitmap records: ${unique.size}`,
    `Face payloads: direct, uncompressed 4-bitplane data`,
    `Write-back rule: fixed dimensions can be patched in-place; resize/relocation is not yet supported.`
  ].join('\n');
}
function renderAll(){
  $('bankSelect').value=F.bankForSeed(seed);
  renderFace();renderComponent();renderUsage();renderDeveloper();
}

async function loadFile(file){
  if(!file)return;
  const ab=await file.arrayBuffer();
  await loadBytes(new Uint8Array(ab),file.name,'local file');
}

function initCategories(){
  const sel=$('categorySelect');
  for(const def of F.CATEGORIES){
    const opt=document.createElement('option');opt.value=def.key;opt.textContent=def.label;sel.appendChild(opt);
  }
  sel.value=selectedCategory;syncVariantFromSeed();
}
$('fileInput').addEventListener('change',e=>loadFile(e.target.files?.[0]));
$('bankSelect').addEventListener('change',()=>setSeed(F.setBank(seed,$('bankSelect').value)));
$('seedInput').addEventListener('change',()=>setSeed(parseHex($('seedInput').value,32)));
$('controlInput').addEventListener('change',()=>setControl(parseHex($('controlInput').value,16)));
$('prevFace').addEventListener('click',()=>setSeed((seed-2)>>>0));
$('nextFace').addEventListener('click',()=>setSeed((seed+2)>>>0));
$('randomFace').addEventListener('click',()=>{
  let s=(Math.random()*0x100000000)>>>0;s=F.setBank(s,F.bankForSeed(seed));setSeed(s);
});
$('paletteSelect').addEventListener('change',renderAll);
$('showBounds').addEventListener('change',renderFace);
$('categorySelect').addEventListener('change',()=>{
  selectedCategory=$('categorySelect').value;syncVariantFromSeed();renderAll();
});
$('variantSelect').addEventListener('change',updateComponentUse);
$('useVariant').addEventListener('click',()=>{
  const variant=Number($('variantSelect').value);
  if(selectedCategory==='special_headgear'){setControl(F.setHeadgear(control,variant));return;}
  setSeed(F.setVariant(seed,selectedCategory,variant));
});
$('refreshUsage').addEventListener('click',()=>{usageNonce++;renderUsage();});

const dz=$('dropZone');
for(const ev of ['dragenter','dragover'])dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag');});
for(const ev of ['dragleave','drop'])dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag');});
dz.addEventListener('drop',e=>loadFile(e.dataTransfer?.files?.[0]));

initCategories();
renderAll();
tryAutoLoad();
})();
