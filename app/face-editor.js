(function(root){
'use strict';

/* Frontier component paint adapter — v0.07.
 * Uses the resource-neutral Indy Heat layer/brush engines without its custom
 * brush catalogue/manager or track-specific resource plumbing.
 */
const F=root.FrontierFaceData,A=root.FrontierFaceAppBridge,L=root.IndyHeatLayerTools,B=root.IndyHeatBrushTools,P=root.FrontierIndexedPng;
if(!F||!A||!L||!B||!P)return;
const $=id=>document.getElementById(id),PALETTE_SIZE=16,GAME_TRANSPARENT=0;
let drawTool='freehand',paintColour=1,brushTransparency=0,brushSize=1,brushShape='square',brush=null,captureMode=null,gesture=null,hover=null,lastKey=null;
const baselineByOffset=new Map(),undoByOffset=new Map();

function entry(){const e=A.getCurrentEntry();return e?.record?e:null;}
function record(){return entry()?.record||null;}
function offset(){return record()?.fileOffset??null;}
function sourceKey(){const o=offset();return o==null?null:`${A.getActiveSlot?.()||'B'}:${o}`;}
function editable(){return !!A.isEditable?.();}
function dims(){const r=record();return r?{w:r.width,h:r.height}:null;}
function currentPixels(){const r=record();return r?Uint8Array.from(r.pixels):null;}
function palette(){return A.getDisplayPalette();}
function paletteRgb(i){const c=palette()?.[Number(i)];return c||[255,0,255,255];}
function setState(text,bad=false){const e=$('facePaintState');if(!e)return;e.textContent=text||'';e.classList.toggle('bad',!!bad);}
function sourceUndo(){const k=sourceKey();if(k==null)return [];if(!undoByOffset.has(k))undoByOffset.set(k,[]);return undoByOffset.get(k);}
function ensureBaseline(){const r=record(),k=sourceKey();if(!r||k==null)return;if(!baselineByOffset.has(k))baselineByOffset.set(k,Uint8Array.from(r.pixels));}
function pushUndo(pixels){const st=sourceUndo();st.push(Uint8Array.from(pixels));if(st.length>40)st.shift();syncUi();}
function replacePixels(pixels,{usage=true}={}){const r=record();if(!r)return false;A.replaceRecordPixels(r.fileOffset,pixels,{usage});return true;}
function restorePixels(pixels,{usage=true}={}){try{return replacePixels(pixels,{usage});}catch(err){setState(`ERROR: ${err.message}`,true);return false;}}
function undoPaint(){const prev=sourceUndo().pop();if(!prev)return;restorePixels(prev,{usage:true});setState('Component edit undone.');syncUi();}
function restoreLoaded(){const k=sourceKey(),base=k==null?null:baselineByOffset.get(k),cur=currentPixels();if(!base||!cur||!editable())return;pushUndo(cur);restorePixels(base,{usage:true});setState('Component restored to its loaded B pixels.');syncUi();}

const LOCKED_BASE_PALETTE=new Set([0,1,2,3,4,13,14,15]);
function runtimePaletteWords(){return A.getRuntimePaletteWords?.()||F.runtimePaletteWords(0,F.FACE_BASE_PALETTE);}
function paletteEditableIndex(i){return editable()&&!LOCKED_BASE_PALETTE.has(Number(i));}
function wordRgbHex(word){const r=(word>>>8)&15,g=(word>>>4)&15,b=word&15;return '#'+[r,g,b].map(v=>(v*17).toString(16).padStart(2,'0')).join('').toUpperCase();}
function paletteEditorWord(){return Number(runtimePaletteWords()[paintColour]||0)&0x0FFF;}
function syncPaletteEditor(){
  const word=paletteEditorWord(),r=(word>>>8)&15,g=(word>>>4)&15,b=word&15,can=paletteEditableIndex(paintColour);
  if($('facePaletteEditIndex'))$('facePaletteEditIndex').textContent='$'+paintColour.toString(16).toUpperCase();
  if($('facePaletteWord'))$('facePaletteWord').textContent='$'+word.toString(16).toUpperCase().padStart(3,'0');
  if($('facePaletteRgbHex'))$('facePaletteRgbHex').textContent=wordRgbHex(word);
  for(const [id,v] of [['facePaletteR',r],['facePaletteG',g],['facePaletteB',b]]){const e=$(id);if(e){e.value=String(v);e.disabled=!can;}}
  for(const [id,v] of [['facePaletteRValue',r],['facePaletteGValue',g],['facePaletteBValue',b]])if($(id))$(id).textContent=String(v);
  const picker=$('facePaletteColourPicker');if(picker){picker.value=wordRgbHex(word);picker.disabled=!can;}
  const lock=$('facePaletteEditLock');if(lock){lock.textContent=can?'Editable in B':(editable()?'Locked':'Reference');lock.classList.toggle('editable',can);}
}
function commitPaletteControls(){
  if(!paletteEditableIndex(paintColour))return;
  const r=Number($('facePaletteR')?.value)||0,g=Number($('facePaletteG')?.value)||0,b=Number($('facePaletteB')?.value)||0,word=((r&15)<<8)|((g&15)<<4)|(b&15);
  try{A.replaceBasePaletteWord(paintColour,word);setState(`Palette index $${paintColour.toString(16).toUpperCase()} patched to Amiga $${word.toString(16).toUpperCase().padStart(3,'0')} in binary B.`);syncPaletteEditor();}
  catch(err){setState(`ERROR: ${err.message}`,true);}
}
function commitPalettePicker(){
  if(!paletteEditableIndex(paintColour))return;const hex=$('facePaletteColourPicker')?.value||'#000000';
  const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),n=c.map(v=>Math.max(0,Math.min(15,Math.round(v/17))));
  if($('facePaletteR'))$('facePaletteR').value=String(n[0]);if($('facePaletteG'))$('facePaletteG').value=String(n[1]);if($('facePaletteB'))$('facePaletteB').value=String(n[2]);commitPaletteControls();
}
function componentPngName(){
  const e=entry(),bank=e?.bank||'A',cat=A.getSelectedCategory?.()||'component',variant=A.getCurrentVariant?.();
  return `frontier_${bank}_${cat}_${variant==null?'none':variant}.png`;
}
function downloadBlob(bytes,name,type='application/octet-stream'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function exportComponentPng(){
  const r=record();if(!r)return;
  try{
    const pal=runtimePaletteWords().map(F.rgb12).map(c=>c.slice(0,3)),bytes=P.encodeIndexedPng(Uint8Array.from(r.pixels),r.width,r.height,pal);
    downloadBlob(bytes,componentPngName(),'image/png');setState(`Exported indexed 16-colour PNG · ${r.width}×${r.height}px.`);
  }catch(err){setState(`ERROR: ${err.message}`,true);}
}
async function importComponentPng(file){
  const r=record();if(!r||!editable()||!file)return;
  try{
    const png=await P.decodeIndexedPng(new Uint8Array(await file.arrayBuffer()));
    if(png.width!==r.width||png.height!==r.height)throw new Error(`PNG is ${png.width}×${png.height}; selected component is ${r.width}×${r.height}.`);
    const before=currentPixels();pushUndo(before);replacePixels(png.pixels,{usage:true});setState(`Imported indexed PNG · ${png.width}×${png.height}px · palette indices preserved.`);
  }catch(err){setState(`ERROR: ${err.message}`,true);}
}

function editorColour(i){return Number(i)===0?[80,80,80,255]:paletteRgb(i);}
function renderPalette(){
  const host=$('facePaintPalette');if(!host)return;host.innerHTML='';const pal=palette();
  for(let i=0;i<PALETTE_SIZE;i++){
    const b=document.createElement('button');b.type='button';b.dataset.faceColour=String(i);const c=pal?.[i]||[255,0,255,255];
    if(i===GAME_TRANSPARENT)b.classList.add('gameTransparent');else b.style.background=`rgb(${c[0]},${c[1]},${c[2]})`;
    b.title=`Palette index ${i}${i===GAME_TRANSPARENT?' · Frontier game transparency':''} · left-click paint · right-click set editor brush transparency`;
    b.addEventListener('click',()=>setPaintColour(i));b.addEventListener('contextmenu',e=>{e.preventDefault();e.stopImmediatePropagation();setBrushTransparency(i);});host.appendChild(b);
  }
  renderPaletteSelection();syncTransparencyUi();syncPaletteEditor();
}
function renderPaletteSelection(){document.querySelectorAll('#facePaintPalette [data-face-colour]').forEach(b=>{const i=Number(b.dataset.faceColour);b.classList.toggle('selected',i===paintColour);b.classList.toggle('transparentIndex',i===brushTransparency);});}
function syncTransparencyUi(){const value=$('faceTransparentValue');if(value)value.textContent=String(brushTransparency);const sw=$('faceTransparentSwatch'),c=editorColour(brushTransparency);if(sw)sw.style.background=brushTransparency===0?'repeating-conic-gradient(#222 0 25%,#555 0 50%) 50% / 8px 8px':`rgb(${c[0]},${c[1]},${c[2]})`;}
function setBrushTransparency(v){v=Number(v);if(!Number.isInteger(v)||v<0||v>=PALETTE_SIZE)return;brushTransparency=v;renderPaletteSelection();syncTransparencyUi();drawOverlay();setState(`Editor brush transparency set to index ${v}. Brush pickup ignores this colour; right-click drawing writes it. Frontier game transparency remains index 0.`);}
function setPaintColour(v){v=Number(v);if(!Number.isInteger(v)||v<0||v>=PALETTE_SIZE)return;paintColour=v;renderPaletteSelection();syncPaletteEditor();drawOverlay();setState(`Paint colour set to index ${v}${v===0?' (Frontier game-transparent when composited)':''}.`);}

function syncCanvasScale(){const base=$('componentCanvas'),over=$('componentOverlay'),stage=$('componentStage');if(!base||!over||!stage)return;const zoom=Math.max(1,Number($('componentZoom')?.value)||8),w=base.width||112,h=base.height||64,cssW=w*zoom,cssH=h*zoom;if(over.width!==w)over.width=w;if(over.height!==h)over.height=h;for(const c of [base,over]){c.style.width=`${cssW}px`;c.style.height=`${cssH}px`;}stage.style.width=`${cssW}px`;stage.style.height=`${cssH}px`;const zt=$('componentZoomText');if(zt)zt.textContent=`${Math.round(zoom*100)}%`;drawOverlay();}
function installViewport(){const v=$('componentViewport'),b=$('componentViewportToggle');if(!v||!b)return;let saved={w:0,h:0};const save=()=>{if(!v.classList.contains('fixed'))return;const r=v.getBoundingClientRect();if(r.width>0&&r.height>0){saved={w:Math.round(r.width),h:Math.round(r.height)};v.dataset.fixedWidth=String(saved.w);v.dataset.fixedHeight=String(saved.h);}};b.addEventListener('click',()=>{const fixed=!v.classList.contains('fixed');if(fixed){const r=v.getBoundingClientRect();saved.w=Number(v.dataset.fixedWidth)||Math.round(r.width);saved.h=Number(v.dataset.fixedHeight)||Math.round(r.height);v.classList.add('fixed');v.style.width=`${saved.w}px`;v.style.height=`${saved.h}px`;b.classList.add('active');b.setAttribute('aria-pressed','true');}else{save();v.classList.remove('fixed');v.style.width='';v.style.height='';b.classList.remove('active');b.setAttribute('aria-pressed','false');}});if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>save()).observe(v);}

function syncUi(){
  const active=!!record(),canEdit=active&&editable();document.querySelectorAll('[data-face-tool]').forEach(b=>{b.disabled=!canEdit;b.classList.toggle('active',b.dataset.faceTool===drawTool&&!captureMode);});document.querySelectorAll('[data-face-capture]').forEach(b=>{b.disabled=!canEdit;b.classList.toggle('active',b.dataset.faceCapture===captureMode);});document.querySelectorAll('[data-face-brush-shape]').forEach(b=>b.classList.toggle('active',b.dataset.faceBrushShape===brushShape&&!brush));
  const size=$('faceBrushSize');if(size){size.disabled=!canEdit||!!brush;size.value=String(brushSize);}if($('faceBrushSizeText'))$('faceBrushSizeText').textContent=brush?`${brush.width}×${brush.height}`:String(brushSize);
  if($('faceBrushClear'))$('faceBrushClear').disabled=!brush;if($('faceBrushSave'))$('faceBrushSave').disabled=!brush;document.querySelectorAll('[data-face-brush-rotate],[data-face-brush-flip]').forEach(b=>b.disabled=!brush);
  if($('faceBrushDims'))$('faceBrushDims').textContent=brush?`${brush.width}×${brush.height} · ${brush.visiblePixels} visible px · hotspot ${brush.hotspotX},${brush.hotspotY}`:`Standard ${brushShape} brush · ${brushSize}px`;
  if($('facePaintUndo'))$('facePaintUndo').disabled=!canEdit||!sourceUndo().length;if($('facePaintRestore'))$('facePaintRestore').disabled=!canEdit||!baselineByOffset.has(sourceKey());
  if($('componentPngImport'))$('componentPngImport').disabled=!canEdit;if($('componentPngExport'))$('componentPngExport').disabled=!active;
  $('componentOverlay').style.pointerEvents=canEdit?'auto':'none';syncPaletteEditor();
}
function toolLabel(tool){return B.DRAW_TOOL_DEFS.find(d=>d.value===tool)?.title||tool;}
function selectTool(tool){if(!B.DRAW_TOOL_DEFS.some(d=>d.value===tool))return;drawTool=tool;captureMode=null;gesture=null;hover=null;syncUi();if(tool==='curve')setState('Curve: click start, click end, then move and click to set the bend.');else if(tool==='freeform')setState('Free-form: click vertices; close within 3 pixels of the start to commit.');else if(tool==='pick')setState('Pick: click a component pixel to select its palette index.');else setState(`${toolLabel(tool)} selected${brush?` with captured ${brush.width}×${brush.height} brush`:''}.`);drawOverlay();}
function selectCapture(mode){captureMode=mode;gesture=null;hover=null;syncUi();if(mode==='polygon')setState('Brush pickup: click vertices and close near the start.');else if(mode==='trace')setState('Brush pickup: hold and trace a freeform lasso; release to capture.');else setState(`Brush pickup: drag a ${mode==='ellipse'?'circle/ellipse':'square/rectangle'} around pixels to collect.`);drawOverlay();}
function setBrushShape(shape){if(brush)return;brushShape=shape==='circle'?'circle':'square';syncUi();drawOverlay();}
function clearBrush(){brush=null;captureMode=null;gesture=null;drawTool='freehand';syncUi();setState('Captured brush cleared. Standard brush restored.');drawOverlay();}
function activateBrush(b,message){brush=b;captureMode=null;gesture=null;drawTool='freehand';syncUi();setState(`${message} Pencil selected; the same brush also works with line, shapes and fill.`);drawOverlay();}
function rotateBrush(deg){if(!brush)return;try{brush=B.transformRasterBrush(brush,{rotation:deg});syncUi();setState(`Brush rotated ${deg}°.`);drawOverlay();}catch(err){setState(`ERROR: ${err.message}`,true);}}
function flipBrush(axis){if(!brush)return;try{brush=B.transformRasterBrush(brush,axis==='h'?{flipH:true}:{flipV:true});syncUi();setState(`Brush flipped ${axis==='h'?'horizontally':'vertically'}.`);drawOverlay();}catch(err){setState(`ERROR: ${err.message}`,true);}}
function downloadBrush(){if(!brush)return;try{const bytes=B.encodeBrushFile(brush,{paletteSize:PALETTE_SIZE}),a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));a.download=`frontier_face_brush_${brush.width}x${brush.height}.ihbrush`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);setState(`Saved ${brush.width}×${brush.height} brush using IHBR v${B.BRUSH_VERSION}.`);}catch(err){setState(`ERROR: ${err.message}`,true);}}
async function loadBrushFile(file){if(!file)return;try{const b=B.decodeBrushFile(new Uint8Array(await file.arrayBuffer()));if(b.paletteSize!==PALETTE_SIZE)throw new Error(`Brush uses a ${b.paletteSize}-colour palette; Frontier face components use ${PALETTE_SIZE}.`);activateBrush(b,`Loaded ${file.name} · ${b.width}×${b.height}.`);}catch(err){setState(`ERROR: ${err.message}`,true);}}

function normalBrushPoints(points){return L.expandPointsWithBrush(points,brushSize,brushShape);}
function applyNormalPoints(base,points,value){const d=dims(),out=Uint8Array.from(base);for(const [x,y] of normalBrushPoints(points))if(x>=0&&y>=0&&x<d.w&&y<d.h)out[y*d.w+x]=value;return out;}
function applyPoints(base,points,{filled=false,anchor=null,secondary=false}={}){const d=dims();if(!d)return base;const value=secondary?brushTransparency:paintColour;if(brush){if(secondary)return (filled?B.patternFillBrushMask(base,d.w,d.h,brush,points,anchor?.x??0,anchor?.y??0,brushTransparency):B.stampBrushMaskPoints(base,d.w,d.h,brush,points,brushTransparency)).pixels;return (filled?B.patternFillOpaqueRasterBrush(base,d.w,d.h,brush,points,anchor?.x??0,anchor?.y??0):B.stampOpaqueRasterBrushPoints(base,d.w,d.h,brush,points)).pixels;}return applyNormalPoints(base,points,value);}
function shapePoints(tool,a,b){if(tool==='line')return L.linePoints(a.x,a.y,b.x,b.y);if(tool==='rectangle')return L.rectanglePoints(a.x,a.y,b.x,b.y);if(tool==='rectangle-filled')return L.filledRectanglePoints(a.x,a.y,b.x,b.y);if(tool==='ellipse')return L.ellipsePoints(a.x,a.y,b.x,b.y);if(tool==='ellipse-filled')return L.filledEllipsePoints(a.x,a.y,b.x,b.y);return [[b.x,b.y]];}
function toolIsFilled(tool){return tool==='rectangle-filled'||tool==='ellipse-filled';}
function commitPixels(out,before,message){if(!before||!out)return false;try{replacePixels(out,{usage:true});pushUndo(before);gesture=null;hover=null;setState(message);syncUi();drawOverlay();return true;}catch(err){setState(`ERROR: ${err.message}`,true);return false;}}
function commitPoints(points,{filled=false,anchor=null,snapshot=null,secondary=false}={}){const base=currentPixels();if(!base)return false;const before=snapshot||base;try{return commitPixels(applyPoints(base,points,{filled,anchor,secondary}),before,`${toolLabel(drawTool)} committed${secondary?` using editor transparency index ${brushTransparency}`:''}.`);}catch(err){setState(`ERROR: ${err.message}`,true);return false;}}
function commitFill(pt,secondary=false){const d=dims(),base=currentPixels();if(!d||!base)return;const target=base[pt.y*d.w+pt.x],probe=(target+1)%PALETTE_SIZE,indices=L.floodFillIndices(base,d.w,d.h,pt.x,pt.y,probe);if(!indices.length)return;const points=indices.map(i=>[i%d.w,(i/d.w)|0]),before=Uint8Array.from(base);let out;if(brush)out=(secondary?B.patternFillBrushMask(base,d.w,d.h,brush,points,pt.x,pt.y,brushTransparency):B.patternFillOpaqueRasterBrush(base,d.w,d.h,brush,points,pt.x,pt.y)).pixels;else{out=Uint8Array.from(base);for(const i of indices)out[i]=secondary?brushTransparency:paintColour;}commitPixels(out,before,`Fill committed${secondary?` using editor transparency index ${brushTransparency}`:''}.`);}

function eventPoint(e,{clamped=false}={}){const c=$('componentOverlay'),d=dims();if(!c||!d)return null;const r=c.getBoundingClientRect();let x=Math.floor((e.clientX-r.left)*d.w/r.width),y=Math.floor((e.clientY-r.top)*d.h/r.height),inside=x>=0&&y>=0&&x<d.w&&y<d.h;if(clamped){x=Math.max(0,Math.min(d.w-1,x));y=Math.max(0,Math.min(d.h-1,y));}return{x,y,inside};}
function secondary(e){return !!e&&(e.button===2||(e.button===0&&e.ctrlKey));}
function primary(e){return !!e&&e.button===0&&!e.ctrlKey;}
function freeformCloseReady(g,p){return !!(g&&g.tool==='freeform'&&(g.vertices?.length||0)>=3&&p&&L.pointDistance(g.start,p)<=3);}
function captureCloseReady(g,p){return !!(g&&g.kind==='capture-poly'&&(g.vertices?.length||0)>=3&&p&&L.pointDistance(g.start,p)<=Math.max(1,Math.min(3,Math.max(...g.vertices.map(v=>Math.max(Math.abs(v.x-g.start.x),Math.abs(v.y-g.start.y))))/3)));}

function handleClickShape(pt,isSecondary){
  if(!gesture||gesture.kind!=='clickshape'||gesture.tool!==drawTool){const base=currentPixels();gesture={kind:'clickshape',tool:drawTool,start:{x:pt.x,y:pt.y},current:{x:pt.x,y:pt.y},snapshot:base,secondary:isSecondary,stage:1,vertices:[{x:pt.x,y:pt.y}]};setState(drawTool==='curve'?'Curve: start set · click the end point.':'Free-form: start set · click more vertices, then close within 3px.');drawOverlay();return;}
  if(drawTool==='curve'){if(gesture.stage===1){if(L.pointDistance(gesture.start,pt)<.001)return;gesture.end={x:pt.x,y:pt.y};gesture.stage=2;setState('Curve: move to set the bend, then click to finalise.');drawOverlay();return;}commitPoints(L.curvePoints(gesture.start,gesture.end,pt),{snapshot:gesture.snapshot,secondary:gesture.secondary});return;}
  if(freeformCloseReady(gesture,pt)){commitPoints(L.polylinePoints(gesture.vertices,{closed:true}),{snapshot:gesture.snapshot,secondary:gesture.secondary});return;}const last=gesture.vertices[gesture.vertices.length-1];if(L.pointDistance(last,pt)>=.001)gesture.vertices.push({x:pt.x,y:pt.y});gesture.current={x:pt.x,y:pt.y};setState(`Free-form: ${gesture.vertices.length} vertices · close within 3px of start.`);drawOverlay();
}
function beginDraw(e,pt){const isSecondary=secondary(e);if(drawTool==='pick'){const d=dims(),pix=currentPixels();if(d&&pix){const v=pix[pt.y*d.w+pt.x];if(isSecondary){setBrushTransparency(v);setState(`Picked editor brush-transparency index ${v}.`);}else{setPaintColour(v);setState(`Picked paint palette index ${v}.`);}}return;}if(drawTool==='fill'){commitFill(pt,isSecondary);return;}if(drawTool==='curve'||drawTool==='freeform'){handleClickShape(pt,isSecondary);return;}const base=currentPixels();if(!base)return;gesture={kind:'drag',tool:drawTool,pointerId:e.pointerId,start:{x:pt.x,y:pt.y},current:{x:pt.x,y:pt.y},last:{x:pt.x,y:pt.y},snapshot:base,secondary:isSecondary};$('componentOverlay').setPointerCapture?.(e.pointerId);if(drawTool==='freehand'){const out=applyPoints(base,[[pt.x,pt.y]],{secondary:isSecondary});replacePixels(out,{usage:false});}drawOverlay();}
function moveDraw(e,pt){hover=pt.inside?pt:null;if(!gesture){drawOverlay();return;}if(gesture.kind==='clickshape'){gesture.current={x:pt.x,y:pt.y};if(gesture.tool==='curve'&&gesture.stage===2)gesture.bend={x:pt.x,y:pt.y};drawOverlay();return;}if(gesture.kind!=='drag'||gesture.pointerId!==e.pointerId)return;gesture.current={x:pt.x,y:pt.y};if(gesture.tool==='freehand'){const base=currentPixels();if(!base)return;const pts=L.linePoints(gesture.last.x,gesture.last.y,pt.x,pt.y),out=applyPoints(base,pts,{secondary:gesture.secondary});replacePixels(out,{usage:false});gesture.last={x:pt.x,y:pt.y};}drawOverlay();}
function endDraw(e,pt){if(!gesture||gesture.kind!=='drag'||gesture.pointerId!==e.pointerId)return;try{$('componentOverlay').releasePointerCapture?.(e.pointerId);}catch(_){ }const g=gesture;if(g.tool==='freehand'){pushUndo(g.snapshot);gesture=null;A.refreshAll();setState(`Pencil stroke committed${g.secondary?` using editor transparency index ${brushTransparency}`:''}.`);syncUi();drawOverlay();return;}commitPoints(shapePoints(g.tool,g.start,pt||g.current),{filled:toolIsFilled(g.tool),anchor:g.start,snapshot:g.snapshot,secondary:g.secondary});}
function cancelGesture(){if(gesture?.kind==='drag'&&gesture.snapshot)restorePixels(gesture.snapshot,{usage:true});gesture=null;hover=null;drawOverlay();}

function captureMask(g){const d=dims();if(!g||!d)return [];const end=g.current||g.start;if(captureMode==='rectangle')return B.rectangleMask(g.start,end,d.w,d.h);if(captureMode==='ellipse')return B.ellipseMask(g.start,end,d.w,d.h);if(captureMode==='polygon')return B.polygonMask(g.vertices||[],d.w,d.h);if(captureMode==='trace')return B.polygonMask(g.path||[],d.w,d.h);return [];}
function finishCapture(){const g=gesture,pixels=currentPixels();if(!g||!pixels)return;try{const mask=captureMask(g),label=captureMode==='rectangle'?'Rectangle':captureMode==='ellipse'?'Ellipse':captureMode==='polygon'?'Multi-edge':'Traced freeform',b=B.captureRasterBrush(pixels,dims().w,dims().h,brushTransparency,mask,{name:`Frontier ${label} capture`,key:'frontier_face_capture'});gesture=null;activateBrush(b,`${label} brush captured · ${b.width}×${b.height}.`);}catch(err){gesture=null;setState(`ERROR: ${err.message}`,true);syncUi();drawOverlay();}}

function pointerDown(e){if(!record())return;const p=primary(e),s=secondary(e);if(!p&&!s)return;const pt=eventPoint(e);if(!pt?.inside)return;e.preventDefault();e.stopImmediatePropagation();if(captureMode){if(!p)return;if(captureMode==='polygon'){if(!gesture||gesture.kind!=='capture-poly'){gesture={kind:'capture-poly',start:{x:pt.x,y:pt.y},current:{x:pt.x,y:pt.y},vertices:[{x:pt.x,y:pt.y}]};setState('Multi-edge pickup: start set · click more vertices, then close near start.');}else if(captureCloseReady(gesture,pt)){finishCapture();return;}else{const last=gesture.vertices[gesture.vertices.length-1];if(L.pointDistance(last,pt)>=.001)gesture.vertices.push({x:pt.x,y:pt.y});gesture.current={x:pt.x,y:pt.y};}drawOverlay();return;}gesture={kind:'capture',pointerId:e.pointerId,start:{x:pt.x,y:pt.y},current:{x:pt.x,y:pt.y},path:[{x:pt.x,y:pt.y}]};$('componentOverlay').setPointerCapture?.(e.pointerId);drawOverlay();return;}beginDraw(e,pt);}
function pointerMove(e){const pt=eventPoint(e,{clamped:!!gesture});if(!pt)return;const d=dims(),pix=currentPixels();if(pt.inside&&d&&pix&&$('componentCursor'))$('componentCursor').textContent=`x ${pt.x} · y ${pt.y} · index ${pix[pt.y*d.w+pt.x]}`;else if($('componentCursor'))$('componentCursor').textContent='x -- · y -- · index --';if(captureMode){if(captureMode==='polygon'){hover=pt.inside?pt:null;if(gesture?.kind==='capture-poly')gesture.current={x:pt.x,y:pt.y};drawOverlay();return;}if(!gesture||gesture.kind!=='capture'||gesture.pointerId!==e.pointerId){hover=pt.inside?pt:null;drawOverlay();return;}gesture.current={x:pt.x,y:pt.y};if(captureMode==='trace'){const last=gesture.path[gesture.path.length-1];if(!last||last.x!==pt.x||last.y!==pt.y)gesture.path.push({x:pt.x,y:pt.y});}drawOverlay();return;}moveDraw(e,pt);}
function pointerUp(e){const pt=eventPoint(e,{clamped:true});if(captureMode==='polygon'&&gesture?.kind==='capture-poly'){e.preventDefault();e.stopImmediatePropagation();return;}if(captureMode&&gesture?.kind==='capture'&&gesture.pointerId===e.pointerId){e.preventDefault();e.stopImmediatePropagation();if(pt)gesture.current={x:pt.x,y:pt.y};if(captureMode==='trace'&&pt){const last=gesture.path[gesture.path.length-1];if(!last||last.x!==pt.x||last.y!==pt.y)gesture.path.push({x:pt.x,y:pt.y});}try{$('componentOverlay').releasePointerCapture?.(e.pointerId);}catch(_){ }finishCapture();return;}if(gesture?.kind==='drag'&&gesture.pointerId===e.pointerId){e.preventDefault();e.stopImmediatePropagation();endDraw(e,pt);}}
function pointerCancel(e){if(gesture){e.preventDefault();e.stopImmediatePropagation();cancelGesture();}}

function drawCells(ctx,points,value,alpha=.55){const d=dims();if(!d)return;const c=editorColour(value);ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=`rgb(${c[0]},${c[1]},${c[2]})`;for(const [x,y] of normalBrushPoints(points))if(x>=0&&y>=0&&x<d.w&&y<d.h)ctx.fillRect(x,y,1,1);ctx.restore();}
function drawBrushAt(ctx,p,alpha=.7,secondary=false){const d=dims();if(!brush||!d||!p?.inside)return;ctx.save();ctx.globalAlpha=alpha;for(let by=0;by<brush.height;by++)for(let bx=0;bx<brush.width;bx++){const v=brush.pixels[by*brush.width+bx];if(v===brush.transparent)continue;const x=p.x-brush.hotspotX+bx,y=p.y-brush.hotspotY+by;if(x<0||y<0||x>=d.w||y>=d.h)continue;const c=secondary?editorColour(brushTransparency):editorColour(v);ctx.fillStyle=`rgb(${c[0]},${c[1]},${c[2]})`;ctx.fillRect(x,y,1,1);}ctx.restore();}
function drawCustomPoints(ctx,points,filled=false,anchor={x:0,y:0},secondary=false){const d=dims();if(!brush||!d)return;if(filled){const mod=(n,m)=>((n%m)+m)%m;ctx.save();ctx.globalAlpha=.62;for(const [x,y] of points){if(x<0||y<0||x>=d.w||y>=d.h)continue;const bx=mod(x-anchor.x+brush.hotspotX,brush.width),by=mod(y-anchor.y+brush.hotspotY,brush.height),v=brush.pixels[by*brush.width+bx];if(v===brush.transparent)continue;const c=secondary?editorColour(brushTransparency):editorColour(v);ctx.fillStyle=`rgb(${c[0]},${c[1]},${c[2]})`;ctx.fillRect(x,y,1,1);}ctx.restore();return;}for(const p of points)drawBrushAt(ctx,{x:p[0],y:p[1],inside:true},.55,secondary);}
function drawCaptureOverlay(ctx){if(!captureMode||!gesture||!['capture','capture-poly'].includes(gesture.kind))return;const a=gesture.start,b=gesture.current||a;ctx.save();ctx.fillStyle='rgba(255,216,74,.18)';ctx.strokeStyle='#ffd84a';ctx.lineWidth=.35;ctx.setLineDash([1,1]);if(captureMode==='trace'){const pts=gesture.path||[];if(pts.length){ctx.beginPath();ctx.moveTo(pts[0].x+.5,pts[0].y+.5);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x+.5,pts[i].y+.5);if(pts.length>2){ctx.closePath();ctx.fill();}ctx.stroke();}}else if(captureMode==='polygon'){const pts=gesture.vertices||[];if(pts.length){ctx.beginPath();ctx.moveTo(pts[0].x+.5,pts[0].y+.5);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x+.5,pts[i].y+.5);if(gesture.current)ctx.lineTo(gesture.current.x+.5,gesture.current.y+.5);if(captureCloseReady(gesture,gesture.current)){ctx.closePath();ctx.fill();}ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(pts[0].x+.5,pts[0].y+.5,.8,0,Math.PI*2);ctx.stroke();}}else{const q=B.rectangleBounds(a,b,dims().w,dims().h),x=q.minX,y=q.minY,w=q.maxX-q.minX+1,h=q.maxY-q.minY+1;if(captureMode==='ellipse'){ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);ctx.fill();ctx.stroke();}else{ctx.fillRect(x,y,w,h);ctx.strokeRect(x+.1,y+.1,Math.max(.2,w-.2),Math.max(.2,h-.2));}}ctx.restore();}
function drawOverlay(){const c=$('componentOverlay');if(!c)return;const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);if(!record())return;if(captureMode){drawCaptureOverlay(ctx);return;}if(gesture?.kind==='clickshape'){let pts=[];if(gesture.tool==='curve'){if(gesture.stage===1)pts=L.linePoints(gesture.start.x,gesture.start.y,(gesture.current||gesture.start).x,(gesture.current||gesture.start).y);else pts=L.curvePoints(gesture.start,gesture.end,gesture.bend||gesture.current||gesture.end);}else{const verts=[...(gesture.vertices||[])];if(gesture.current)verts.push(gesture.current);pts=L.polylinePoints(verts,{closed:false});}brush?drawCustomPoints(ctx,pts,false,{x:0,y:0},gesture.secondary):drawCells(ctx,pts,gesture.secondary?brushTransparency:paintColour);return;}if(gesture?.kind==='drag'&&gesture.tool!=='freehand'){const pts=shapePoints(gesture.tool,gesture.start,gesture.current||gesture.start),filled=toolIsFilled(gesture.tool);brush?drawCustomPoints(ctx,pts,filled,gesture.start,gesture.secondary):drawCells(ctx,pts,gesture.secondary?brushTransparency:paintColour);return;}if(hover?.inside&&drawTool!=='fill'&&drawTool!=='pick'){if(brush)drawBrushAt(ctx,hover);else drawCells(ctx,[[hover.x,hover.y]],paintColour,.68);}}

function syncSelection(){const k=sourceKey();if(k!==lastKey){gesture=null;hover=null;captureMode=null;lastKey=k;ensureBaseline();}syncCanvasScale();renderPalette();syncUi();drawOverlay();if(record()&&!editable())setState('Viewing binary A reference. Switch to Edit B to use artist tools.');}
function sourceReloaded(e){
  const changed=e?.detail?.slots||['A','B'];for(const slot of changed){for(const k of [...baselineByOffset.keys()])if(String(k).startsWith(slot+':'))baselineByOffset.delete(k);for(const k of [...undoByOffset.keys()])if(String(k).startsWith(slot+':'))undoByOffset.delete(k);}
  lastKey=null;gesture=null;hover=null;if(changed.includes(A.getActiveSlot?.())){brush=null;captureMode=null;drawTool='freehand';}syncSelection();if(editable())setState('Pencil selected. Paint on the central facial-feature canvas.');
}
function init(){
  installViewport();$('componentZoom')?.addEventListener('input',syncCanvasScale);document.querySelectorAll('[data-face-tool]').forEach(b=>b.addEventListener('click',()=>selectTool(b.dataset.faceTool)));document.querySelectorAll('[data-face-brush-shape]').forEach(b=>b.addEventListener('click',()=>setBrushShape(b.dataset.faceBrushShape)));document.querySelectorAll('[data-face-capture]').forEach(b=>b.addEventListener('click',()=>selectCapture(b.dataset.faceCapture)));document.querySelectorAll('[data-face-brush-rotate]').forEach(b=>b.addEventListener('click',()=>rotateBrush(Number(b.dataset.faceBrushRotate))));document.querySelectorAll('[data-face-brush-flip]').forEach(b=>b.addEventListener('click',()=>flipBrush(b.dataset.faceBrushFlip)));
  $('faceBrushSize')?.addEventListener('input',e=>{brushSize=Math.max(1,Number(e.target.value)||1);syncUi();drawOverlay();});$('faceBrushClear')?.addEventListener('click',clearBrush);$('faceBrushSave')?.addEventListener('click',downloadBrush);$('faceBrushLoad')?.addEventListener('click',()=>$('faceBrushLoadInput')?.click());$('faceBrushLoadInput')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(f)await loadBrushFile(f);e.target.value='';});$('facePaintUndo')?.addEventListener('click',undoPaint);$('facePaintRestore')?.addEventListener('click',restoreLoaded);
  for(const id of ['facePaletteR','facePaletteG','facePaletteB'])$(id)?.addEventListener('input',commitPaletteControls);$('facePaletteColourPicker')?.addEventListener('input',commitPalettePicker);
  $('componentPngExport')?.addEventListener('click',exportComponentPng);$('componentPngImport')?.addEventListener('click',()=>$('componentPngInput')?.click());$('componentPngInput')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(f)await importComponentPng(f);e.target.value='';});
  const c=$('componentOverlay');c?.addEventListener('pointerdown',pointerDown,true);c?.addEventListener('pointermove',pointerMove,true);c?.addEventListener('pointerup',pointerUp,true);c?.addEventListener('pointercancel',pointerCancel,true);c?.addEventListener('pointerleave',()=>{if(!gesture){hover=null;drawOverlay();if($('componentCursor'))$('componentCursor').textContent='x -- · y -- · index --';}},true);c?.addEventListener('contextmenu',e=>{e.preventDefault();e.stopImmediatePropagation();},true);
  document.addEventListener('frontier-face-rendered',syncSelection);document.addEventListener('frontier-face-loaded',sourceReloaded);document.addEventListener('frontier-face-slot-changed',syncSelection);document.addEventListener('frontier-face-palette-changed',()=>{renderPalette();syncPaletteEditor();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&gesture){e.preventDefault();cancelGesture();setState('Current gesture cancelled.');}});renderPalette();syncSelection();selectTool('freehand');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof globalThis!=='undefined'?globalThis:this);
