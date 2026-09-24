(function(){
'use strict';
const F=window.FrontierFaceData;
const $=id=>document.getElementById(id);

const slots={A:null,B:null};
let activeSlot='B';
let sourceBytes=null,decoded=null,sourceName='',sourceHash=null;
let seed=0,control=0,selectedCategory='eyes_eyewear',usageNonce=0;
let lastSourceMessage='No binary loaded.',lastSourceClass='warn';

/* v0.09 A/B binary workflow. A is reference/read-only; B carries component and base-palette patches. */
const AUTO_SOURCE_FILENAME='Frontier';
const AUTO_SOURCE_URL='https://raw.githubusercontent.com/HoraceAndTheSpider/Frontier-Character-Editor/master/whdload/data/game/Frontier';

function uniqueUrls(urls){
  const seen=new Set(),out=[];
  for(const url of urls){if(!url||seen.has(url))continue;seen.add(url);out.push(url);}
  return out;
}
function autoSourceCandidates(){
  const loc=window.location,urls=[];
  let sameOrigin=null;

  if(/^https?:$/i.test(loc.protocol)){
    try{sameOrigin=new URL('../whdload/data/game/'+AUTO_SOURCE_FILENAME,loc.href).href;}catch(_){}
  }

  // Hosted copies (especially raw.githack.com/rawcdn.githack.com) should try
  // their own repository path first. This avoids an unnecessary cross-origin
  // dependency on raw.githubusercontent.com and is normally the fastest route.
  if(sameOrigin)urls.push(sameOrigin);

  // Known canonical source remains the fallback when the app is mirrored
  // somewhere that does not also host whdload/data/game/Frontier.
  urls.push(AUTO_SOURCE_URL);

  return uniqueUrls(urls);
}
function bytesEqual(a,b){
  if(!a||!b||a.length!==b.length)return false;
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;
  return true;
}
function rangeEqual(a,b,start,length){
  if(!a||!b||start<0||start+length>a.length||start+length>b.length)return false;
  for(let i=start,end=start+length;i<end;i++)if(a[i]!==b[i])return false;
  return true;
}
async function makeSlot(bytes,name,originLabel,{hash=null}={}){
  const raw=bytes instanceof Uint8Array?Uint8Array.from(bytes):new Uint8Array(bytes);
  const decoded=F.decodeAll(raw);
  if(hash==null)try{hash=await F.sha256(raw);}catch(_){hash=null;}
  return {bytes:raw,originalBytes:Uint8Array.from(raw),decoded,basePaletteWords:F.readFaceBasePalette(raw),name:name||AUTO_SOURCE_FILENAME,hash,originLabel,dirtyOffsets:new Set(),dirtyPaletteIndices:new Set(),baseMatchesA:false,differsFromA:false};
}
function cloneSlot(slot,{name=slot?.name||AUTO_SOURCE_FILENAME,originLabel='copied reference'}={}){
  if(!slot)return null;
  const raw=Uint8Array.from(slot.bytes);
  return {bytes:raw,originalBytes:Uint8Array.from(raw),decoded:F.decodeAll(raw),basePaletteWords:F.readFaceBasePalette(raw),name,hash:slot.hash,originLabel,dirtyOffsets:new Set(),dirtyPaletteIndices:new Set(),baseMatchesA:false,differsFromA:false};
}
function syncActiveSource(){
  const slot=slots[activeSlot];
  sourceBytes=slot?.bytes||null;decoded=slot?.decoded||null;sourceName=slot?.name||'';sourceHash=slot?.hash||null;
}
function slotDirty(slot){return !!(slot&&(slot.dirtyOffsets.size||slot.dirtyPaletteIndices.size));}
function activeBasePaletteWords(){return slots[activeSlot]?.basePaletteWords||F.FACE_BASE_PALETTE;}
function updateBComparison(){
  const b=slots.B,a=slots.A;if(!b)return;
  if(!a){b.baseMatchesA=false;b.differsFromA=true;return;}
  if(!slotDirty(b)){b.baseMatchesA=bytesEqual(b.originalBytes,a.bytes);b.differsFromA=!b.baseMatchesA;}
  else b.differsFromA=true;
}
function slotDescription(key){
  const s=slots[key];if(!s)return 'Empty';
  const bits=[s.name,`${s.bytes.length.toLocaleString()} bytes`];
  if(s.hash)bits.push(s.hash.slice(0,12)+'…');
  if(key==='B'&&slotDirty(s))bits.push(`${s.dirtyOffsets.size} component edit${s.dirtyOffsets.size===1?'':'s'}, ${s.dirtyPaletteIndices.size} palette edit${s.dirtyPaletteIndices.size===1?'':'s'}`);
  return bits.join(' · ');
}
function renderSourceUi(){
  const a=slots.A,b=slots.B,active=slots[activeSlot];
  const ba=$('slotABadge'),bb=$('slotBBadge');
  if(ba){ba.textContent=a?'Loaded':'Empty';ba.className='slotBadge'+(a?' loaded':'');}
  if(bb){bb.textContent=b?(slotDirty(b)?'Modified':'Loaded'):'Empty';bb.className='slotBadge'+(b?(slotDirty(b)?' modified':' loaded'):'');}
  for(const [id,on] of [['downloadSlotA',!!a],['downloadSlotB',!!b],['viewSlotA',!!a],['viewSlotB',!!b],['restoreBFromA',!!a]]){const el=$(id);if(el)el.disabled=!on;}
  $('viewSlotA')?.classList.toggle('active',activeSlot==='A'&&!!a);$('viewSlotB')?.classList.toggle('active',activeSlot==='B'&&!!b);
  const status=$('sourceStatus');if(status){
    if(active&&lastSourceClass!=='bad'){status.hidden=true;status.textContent='';}
    else{status.hidden=false;status.className='status compactSourceStatus '+lastSourceClass;status.textContent=lastSourceMessage;}
  }
}

function setActiveSlot(key){
  if(!slots[key])return false;activeSlot=key;syncActiveSource();syncVariantFromSeed();renderAll();renderSourceUi();document.dispatchEvent(new CustomEvent('frontier-face-slot-changed',{detail:{slot:key}}));return true;
}
async function installBinary(bytes,name,originLabel,{target=null}={}){
  lastSourceMessage='Decoding Frontier binary…';lastSourceClass='warn';renderSourceUi();
  try{
    const candidate=await makeSlot(bytes,name,originLabel);
    const changed=[];
    if(!slots.A&&!slots.B){
      slots.A=candidate;slots.B=cloneSlot(candidate,{originLabel:`working copy of ${originLabel}`});slots.B.baseMatchesA=true;slots.B.differsFromA=false;changed.push('A','B');activeSlot='B';
    }else if(target==='A'||target==='B'){
      slots[target]=candidate;changed.push(target);
      if(target==='B'){candidate.baseMatchesA=!!slots.A&&bytesEqual(candidate.originalBytes,slots.A.bytes);candidate.differsFromA=!candidate.baseMatchesA;}
      if(target==='A'&&slots.B)updateBComparison();
      activeSlot=target;
    }else{
      slots.B=candidate;candidate.baseMatchesA=!!slots.A&&bytesEqual(candidate.originalBytes,slots.A.bytes);candidate.differsFromA=!candidate.baseMatchesA;changed.push('B');activeSlot='B';
    }
    syncActiveSource();
    const exact=candidate.hash===F.EXPECTED_SHA256;lastSourceClass=exact?'ok':'warn';lastSourceMessage=exact?`Known Frontier binary verified (${originLabel}).`:`Frontier face tables decoded from ${originLabel}; SHA-256 differs from the analysed retail build.`;
    renderAll();renderSourceUi();document.dispatchEvent(new CustomEvent('frontier-face-loaded',{detail:{slots:changed}}));return true;
  }catch(err){lastSourceClass='bad';lastSourceMessage='Decode failed: '+(err?.message||err);renderSourceUi();return false;}
}
async function tryAutoLoad(){
  if(slots.A||slots.B)return false;
  lastSourceMessage='Trying to load Frontier automatically…';lastSourceClass='warn';renderSourceUi();
  const errors=[];
  for(const url of autoSourceCandidates()){
    if(slots.A||slots.B)return false;
    try{
      const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10000);let response;
      try{response=await fetch(url,{cache:'no-store',mode:'cors',signal:abort.signal});}finally{clearTimeout(timer);}
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const bytes=new Uint8Array(await response.arrayBuffer());if(!bytes.length)throw new Error('empty response');
      const ok=await installBinary(bytes,AUTO_SOURCE_FILENAME,'automatic GitHub/web load');if(ok){slots.A.originLabel=url;slots.B.originLabel=`working copy of ${url}`;renderSourceUi();return true;}
      errors.push(`${url} — unsupported Frontier binary`);
    }catch(err){errors.push(`${url} — ${err?.message||err}`);}
  }
  if(errors.length)console.warn('Frontier automatic load failed:',errors);
  lastSourceClass='warn';lastSourceMessage='Automatic Frontier load was not available. Import a binary manually.';renderSourceUi();return false;
}
function downloadBytes(bytes,name){
  if(!bytes)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));a.download=name||AUTO_SOURCE_FILENAME;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function downloadSlot(key){const s=slots[key];if(s)downloadBytes(s.bytes,s.name||AUTO_SOURCE_FILENAME);}
function restoreBFromA(){
  if(!slots.A)return;const name=slots.B?.name||slots.A.name||AUTO_SOURCE_FILENAME;slots.B=cloneSlot(slots.A,{name,originLabel:'restored from A reference'});slots.B.baseMatchesA=true;slots.B.differsFromA=false;activeSlot='B';syncActiveSource();renderAll();renderSourceUi();document.dispatchEvent(new CustomEvent('frontier-face-loaded',{detail:{slots:['B']}}));
}

const CATEGORY_LABELS=Object.fromEntries(F.CATEGORIES.map(c=>[c.key,c.label]));

const DISPLAY_PALETTE_OPTIONS=Object.freeze([
  Object.freeze({value:'auto',label:'Auto: runtime selection'}),
  Object.freeze({value:'0',label:'Palette 0: Khaki'}),
  Object.freeze({value:'1',label:'Palette 1: Red'}),
  Object.freeze({value:'2',label:'Palette 2: Yellow'}),
  Object.freeze({value:'3',label:'Palette 3: Grey'}),
  Object.freeze({value:'4',label:'Palette 4: Dark Grey'}),
  Object.freeze({value:'5',label:'Palette 5: Pink'}),
  Object.freeze({value:'6',label:'Palette 6: Green'}),
  Object.freeze({value:'7',label:'Palette 7: Blue'}),
  Object.freeze({value:'grey',label:'Indexed greyscale'})
]);
function displayPaletteOption(){
  const slider=$('paletteSlider'),i=Math.max(0,Math.min(DISPLAY_PALETTE_OPTIONS.length-1,Number(slider?.value)||0));
  return DISPLAY_PALETTE_OPTIONS[i];
}
function syncDisplayPaletteControl(){
  const opt=displayPaletteOption(),label=$('paletteChoiceLabel');
  if(label)label.textContent=opt.label;
  return opt;
}

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
function currentRuntimePaletteIndex(face=null){
  face=face||F.composeFace(decoded,seed,control);
  const choice=displayPaletteOption().value;
  return (choice==='auto'||choice==='grey')?face.paletteIndex:(Number(choice)&7);
}
function currentRuntimePaletteWords(face=null){
  return F.runtimePaletteWords(currentRuntimePaletteIndex(face),activeBasePaletteWords());
}
function currentPaletteChoice(face){
  const choice=displayPaletteOption().value;
  if(choice==='grey')return {index:face.paletteIndex,palette:F.displayPalette(face.paletteIndex,true,activeBasePaletteWords()),grey:true,words:currentRuntimePaletteWords(face)};
  const idx=currentRuntimePaletteIndex(face);
  const words=F.runtimePaletteWords(idx,activeBasePaletteWords());
  return {index:idx,palette:F.displayPalette(idx,false,activeBasePaletteWords()),grey:false,words};
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
  $('faceSummary').textContent=`${activeSlot} ${activeSlot==='A'?'reference':'working'} · Bank ${face.bank} · seed $${F.hex(seed,8)} · runtime palette ${face.paletteIndex}${face.headgear===null?'':' · headgear '+face.headgear}`;
  renderSelectors(face);
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
function currentEntry(){
  if(!decoded)return null;
  const bank=F.bankForSeed(seed),variant=currentVariant();
  if(variant===null)return null;
  return F.recordFor(decoded,bank,selectedCategory,variant);
}
function renderComponent(){
  const canvas=$('componentCanvas'),ctx=canvas.getContext('2d');
  if(!decoded){canvas.width=112;canvas.height=64;ctx.fillStyle='#090a0d';ctx.fillRect(0,0,canvas.width,canvas.height);$('componentTitle').textContent='Load Frontier to edit a component.';$('componentMeta').textContent='No component decoded.';return;}
  const bank=F.bankForSeed(seed),variant=currentVariant();
  if(variant===null){canvas.width=112;canvas.height=64;ctx.fillStyle='#090a0d';ctx.fillRect(0,0,canvas.width,canvas.height);$('componentTitle').textContent=`Bank ${bank} (${activeSlot==='A'?'reference':'working'}) · ${CATEGORY_LABELS[selectedCategory]} · no active variant`;$('componentMeta').textContent='No special headgear in the current control state.';return;}
  const entry=F.recordFor(decoded,bank,selectedCategory,variant);
  if(!entry?.record){canvas.width=112;canvas.height=64;ctx.fillStyle='#090a0d';ctx.fillRect(0,0,canvas.width,canvas.height);$('componentTitle').textContent=`Bank ${bank} (${activeSlot==='A'?'reference':'working'}) · ${CATEGORY_LABELS[selectedCategory]} · vari. ${variant}`;$('componentMeta').textContent=`Invalid or unresolved table entry.\nTable word: $${F.hex(entry?.tableWord||0,4)}`;return;}
  const face=F.composeFace(decoded,seed,control),pal=currentPaletteChoice(face),r=entry.record;
  canvas.width=r.width;canvas.height=r.height;
  F.renderIndexed(canvas,r.pixels,r.width,r.height,pal.palette,false);
  $('componentTitle').textContent=`Bank ${bank} (${activeSlot==='A'?'reference':'working'}) · ${CATEGORY_LABELS[selectedCategory]} · vari. ${variant} (${r.width}×${r.height}px)`;
  $('componentMeta').textContent=[
    `table @ $${F.hex(entry.tableEntryOffset,6)} = $${F.hex(entry.tableWord,4)}`,
    `bitmap @ $${F.hex(r.fileOffset,6)} · x=${r.x}, y=${r.y}`,
    `${r.width}×${r.height}px · ${r.widthWords} word(s) wide · ${r.payloadSize} payload bytes`,
    `4 planar bitplanes · index 0 transparent`
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
    `Active binary: ${activeSlot} · ${sourceName}`,
    `Loaded SHA-256: ${sourceHash||'not available'}`,
    `Known build match at load: ${sourceHash===F.EXPECTED_SHA256?'yes':'no / unverified'}`,
    `B patched components: ${slots.B?.dirtyOffsets?.size||0}`,
    `B patched base-palette entries: ${slots.B?.dirtyPaletteIndices?.size||0}`,
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
  renderFace();renderComponent();renderUsage();renderDeveloper();renderSourceUi();
  document.dispatchEvent(new CustomEvent('frontier-face-rendered'));
}

function replaceRecordPixels(fileOffset,pixels,{usage=true}={}){
  if(activeSlot!=='B')throw new Error('Binary A is reference-only. Switch to Edit B to paint.');
  const slot=slots.B;if(!slot?.decoded)throw new Error('No B working binary is loaded.');
  fileOffset=Number(fileOffset);if(!Number.isInteger(fileOffset))throw new Error('Component file offset is invalid.');
  let changed=0,patchRecord=null;
  for(const bank of ['A','B'])for(const def of F.CATEGORIES)for(const e of slot.decoded[bank].categories[def.key]){
    if(e?.record?.fileOffset!==fileOffset)continue;
    if(!pixels||pixels.length!==e.record.width*e.record.height)throw new Error('Edited component dimensions do not match the source record.');
    if(!patchRecord)patchRecord=e.record;
    e.record.pixels=Uint8Array.from(pixels);changed++;
  }
  if(!changed||!patchRecord)throw new Error('Component record is no longer present in the decoded B face tables.');
  slot.bytes=F.patchRecordPixels(slot.bytes,patchRecord,pixels);sourceBytes=slot.bytes;
  if(rangeEqual(slot.bytes,slot.originalBytes,patchRecord.payloadOffset,patchRecord.payloadSize))slot.dirtyOffsets.delete(fileOffset);else slot.dirtyOffsets.add(fileOffset);
  slot.differsFromA=slot.baseMatchesA?slot.dirtyOffsets.size>0:true;
  renderFace();renderComponent();if(usage)renderUsage();renderDeveloper();renderSourceUi();
  if(usage)document.dispatchEvent(new CustomEvent('frontier-face-rendered'));
  return changed;
}

function replaceBasePaletteWord(index,word){
  if(activeSlot!=='B')throw new Error('Binary A is reference-only. Switch to Edit B to change the palette.');
  const slot=slots.B;if(!slot)throw new Error('No B working binary is loaded.');
  index=Number(index);word=Number(word);
  if(!F.EDITABLE_FACE_BASE_PALETTE_INDICES.includes(index))throw new Error(`Palette index ${index.toString(16).toUpperCase()} is locked.`);
  if(!Number.isInteger(word)||word<0||word>0x0FFF)throw new Error('Palette colour must be a 12-bit Amiga $RGB word.');
  slot.bytes=F.patchFaceBasePaletteWord(slot.bytes,index,word);sourceBytes=slot.bytes;
  slot.basePaletteWords=F.readFaceBasePalette(slot.bytes);
  const originalWord=F.readU16(slot.originalBytes,F.FACE_BASE_PALETTE_OFFSET+index*2)&0x0FFF;
  if(slot.basePaletteWords[index]===originalWord)slot.dirtyPaletteIndices.delete(index);else slot.dirtyPaletteIndices.add(index);
  slot.differsFromA=slot.baseMatchesA?slotDirty(slot):true;
  renderAll();renderDeveloper();renderSourceUi();
  document.dispatchEvent(new CustomEvent('frontier-face-palette-changed',{detail:{index,word:slot.basePaletteWords[index]}}));
  return slot.basePaletteWords[index];
}

window.FrontierFaceAppBridge=Object.freeze({
  getDecoded:()=>decoded,
  getSeed:()=>seed>>>0,
  getControl:()=>control&0xFFFF,
  getSelectedCategory:()=>selectedCategory,
  getCurrentVariant:()=>currentVariant(),
  getCurrentEntry:()=>currentEntry(),
  getActiveSlot:()=>activeSlot,
  isEditable:()=>activeSlot==='B'&&!!slots.B,
  getSlotBytes:key=>slots[key]?.bytes?Uint8Array.from(slots[key].bytes):null,
  getBasePaletteWords:()=>Array.from(activeBasePaletteWords()),
  getRuntimePaletteWords:()=>decoded?Array.from(currentRuntimePaletteWords()):F.runtimePaletteWords(0,F.FACE_BASE_PALETTE),
  getDisplayPalette:()=>{if(!decoded)return F.displayPalette(0,true,F.FACE_BASE_PALETTE);const face=F.composeFace(decoded,seed,control);return currentPaletteChoice(face).palette;},
  replaceRecordPixels,
  replaceBasePaletteWord,
  refreshAll:()=>renderAll()
});

async function loadFile(file,{target=null}={}){
  if(!file)return;const ab=await file.arrayBuffer();await installBinary(new Uint8Array(ab),file.name,'local file',{target});
}

function initCategories(){
  const sel=$('categorySelect');
  for(const def of F.CATEGORIES){
    const opt=document.createElement('option');opt.value=def.key;opt.textContent=def.label;sel.appendChild(opt);
  }
  sel.value=selectedCategory;syncVariantFromSeed();
}
$('loadSlotA')?.addEventListener('click',()=>$('slotAInput')?.click());
$('loadSlotB')?.addEventListener('click',()=>$('slotBInput')?.click());
$('slotAInput')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadFile(f,{target:'A'});e.target.value='';});
$('slotBInput')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadFile(f,{target:'B'});e.target.value='';});
$('downloadSlotA')?.addEventListener('click',()=>downloadSlot('A'));
$('downloadSlotB')?.addEventListener('click',()=>downloadSlot('B'));
$('viewSlotA')?.addEventListener('click',()=>setActiveSlot('A'));
$('viewSlotB')?.addEventListener('click',()=>setActiveSlot('B'));
$('restoreBFromA')?.addEventListener('click',restoreBFromA);
$('bankSelect').addEventListener('change',()=>setSeed(F.setBank(seed,$('bankSelect').value)));
$('seedInput').addEventListener('change',()=>setSeed(parseHex($('seedInput').value,32)));
$('controlInput').addEventListener('change',()=>setControl(parseHex($('controlInput').value,16)));
$('prevFace').addEventListener('click',()=>setSeed((seed-2)>>>0));
$('nextFace').addEventListener('click',()=>setSeed((seed+2)>>>0));
$('randomFace').addEventListener('click',()=>{let s=(Math.random()*0x100000000)>>>0;s=F.setBank(s,F.bankForSeed(seed));setSeed(s);});
$('paletteSlider')?.addEventListener('input',()=>{syncDisplayPaletteControl();renderAll();});
$('showBounds').addEventListener('change',renderFace);
$('categorySelect').addEventListener('change',()=>{selectedCategory=$('categorySelect').value;syncVariantFromSeed();renderAll();});
$('variantSelect').addEventListener('change',()=>{const variant=Number($('variantSelect').value);if(selectedCategory==='special_headgear'){setControl(F.setHeadgear(control,variant));return;}setSeed(F.setVariant(seed,selectedCategory,variant));});
$('refreshUsage').addEventListener('click',()=>{usageNonce++;renderUsage();});

for(const key of ['A','B']){
  const dz=$(`dropSlot${key}`);if(!dz)continue;
  for(const ev of ['dragenter','dragover'])dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('drag');});
  for(const ev of ['dragleave','drop'])dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('drag');});
  dz.addEventListener('drop',e=>{const f=e.dataTransfer?.files?.[0];if(f)loadFile(f,{target:key});});
}

initCategories();
syncDisplayPaletteControl();
renderAll();
tryAutoLoad();
})();
