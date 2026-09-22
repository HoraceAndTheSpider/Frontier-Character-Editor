(function(root){
'use strict';

const VERSION='0.01';
const EXPECTED_SHA256='ec97dbb2424a3b66509fc742d3c7960be223c2c12c86d7aa17960e4f0577231c';
const EXPECTED_SIZE=645752;
const HUNK7_FILE_OFFSET=0x551C4;
const BANK_TABLES=Object.freeze({A:0x644CC,B:0x65B12});
const FACE_CANVAS=Object.freeze({width:128,height:144});

const CATEGORIES=Object.freeze([
  Object.freeze({key:'hair_head_outline',label:'Hair / outer head',tableOffset:0x40,seedBit:1}),
  Object.freeze({key:'upper_face_hairline',label:'Upper face / hairline',tableOffset:-0x40,seedBit:5}),
  Object.freeze({key:'neck_shoulders_clothing',label:'Neck / shoulders / clothing',tableOffset:0x30,seedBit:8}),
  Object.freeze({key:'left_cheek_ear',label:'Left cheek / ear',tableOffset:-0x20,seedBit:11,sharedSelector:'cheeks'}),
  Object.freeze({key:'right_cheek_ear',label:'Right cheek / ear',tableOffset:-0x10,seedBit:11,sharedSelector:'cheeks'}),
  Object.freeze({key:'lower_face_chin',label:'Lower face / chin',tableOffset:0x00,seedBit:14}),
  Object.freeze({key:'mouth',label:'Mouth',tableOffset:0x10,seedBit:17}),
  Object.freeze({key:'nose',label:'Nose',tableOffset:0x20,seedBit:20}),
  Object.freeze({key:'eyes_eyewear',label:'Eyes / eyewear',tableOffset:-0x30,seedBit:23}),
  Object.freeze({key:'special_headgear',label:'Special headgear',tableOffset:0x50,variants:3,controlSelector:true})
]);

const NORMAL_RENDER_ORDER=Object.freeze([
  'hair_head_outline','upper_face_hairline','neck_shoulders_clothing',
  'left_cheek_ear','right_cheek_ear','lower_face_chin','mouth','nose','eyes_eyewear'
]);

/*
 * Eight exact 4-colour tables found at hunk 7 + $9990 / file $5EB54.
 * The face routine writes the selected four WORDs to A6+$3DDE. The surrounding
 * palette array starts at A6+$3DDC, therefore these are palette indices 1..4.
 */
const DYNAMIC_PALETTES=Object.freeze([
  Object.freeze([0x884,0x662,0x440,0x220]),
  Object.freeze([0xA44,0x822,0x600,0x400]),
  Object.freeze([0xEE4,0xCC2,0x990,0x660]),
  Object.freeze([0xAAA,0x888,0x666,0x444]),
  Object.freeze([0x888,0x666,0x444,0x222]),
  Object.freeze([0xC66,0xA44,0x722,0x400]),
  Object.freeze([0x4A4,0x282,0x060,0x040]),
  Object.freeze([0x66E,0x44B,0x229,0x006])
]);

function readU16(bytes,off){return (bytes[off]<<8)|bytes[off+1];}
function readS16(bytes,off){const v=readU16(bytes,off);return v&0x8000?v-0x10000:v;}
function writeU16(bytes,off,v){bytes[off]=(v>>>8)&255;bytes[off+1]=v&255;}
function hex(v,n=8){return (Number(v)>>>0).toString(16).toUpperCase().padStart(n,'0');}
function categoryDef(key){return CATEGORIES.find(c=>c.key===key)||null;}

function decodeRecord(bytes,fileOffset){
  if(fileOffset<0||fileOffset+8>bytes.length)throw new Error('Bitmap record header is outside the executable.');
  const x=readS16(bytes,fileOffset),y=readS16(bytes,fileOffset+2);
  const widthWords=readU16(bytes,fileOffset+4),height=readU16(bytes,fileOffset+6);
  if(widthWords<1||widthWords>16||height<1||height>256)throw new Error('Invalid face bitmap dimensions.');
  const width=widthWords*16,rowBytes=widthWords*2,planeSize=rowBytes*height,payloadSize=planeSize*4;
  const payloadOffset=fileOffset+8;
  if(payloadOffset+payloadSize>bytes.length)throw new Error('Face bitmap payload is outside the executable.');
  const pixels=new Uint8Array(width*height);
  for(let p=0;p<4;p++){
    const planeBase=payloadOffset+p*planeSize;
    for(let yy=0;yy<height;yy++){
      const row=planeBase+yy*rowBytes;
      for(let xx=0;xx<width;xx++){
        if(bytes[row+(xx>>3)]&(0x80>>>(xx&7)))pixels[yy*width+xx]|=(1<<p);
      }
    }
  }
  return {fileOffset,payloadOffset,payloadSize,x,y,widthWords,width,height,pixels};
}

function encodePixels(record,pixels){
  if(!record||!pixels||pixels.length!==record.width*record.height)throw new Error('Component pixel buffer has the wrong size.');
  const rowBytes=record.widthWords*2,planeSize=rowBytes*record.height,out=new Uint8Array(record.payloadSize);
  for(let p=0;p<4;p++){
    const planeBase=p*planeSize;
    for(let yy=0;yy<record.height;yy++){
      const row=planeBase+yy*rowBytes;
      for(let xx=0;xx<record.width;xx++){
        const value=pixels[yy*record.width+xx];
        if(value>15)throw new Error('Face pixels must remain 4-bit palette indices 0..15.');
        if(value&(1<<p))out[row+(xx>>3)]|=0x80>>>(xx&7);
      }
    }
  }
  return out;
}

function patchRecordPixels(sourceBytes,record,pixels){
  const out=Uint8Array.from(sourceBytes);
  out.set(encodePixels(record,pixels),record.payloadOffset);
  return out;
}

function decodeBank(bytes,bank){
  const tableBase=BANK_TABLES[bank];
  if(!tableBase)throw new Error('Unknown face bank.');
  const categories={};
  for(const def of CATEGORIES){
    const count=def.variants||8,entries=[];
    for(let variant=0;variant<count;variant++){
      const tableEntryOffset=tableBase+def.tableOffset+variant*2;
      const tableWord=readU16(bytes,tableEntryOffset),disp=readS16(bytes,tableEntryOffset);
      const fileOffset=tableBase+disp;
      let record=null,error=null;
      try{record=decodeRecord(bytes,fileOffset);}
      catch(err){error=String(err&&err.message||err);}
      entries.push({bank,category:def.key,variant,tableEntryOffset,tableWord,signedDisplacement:disp,fileOffset,record,error});
    }
    categories[def.key]=entries;
  }
  return {bank,tableBase,categories};
}

function decodeAll(bytes){
  if(!(bytes instanceof Uint8Array))bytes=new Uint8Array(bytes);
  if(bytes.length<0x6B000)throw new Error('File is too short to contain the known face tables.');
  return {A:decodeBank(bytes,'A'),B:decodeBank(bytes,'B')};
}

function bankForSeed(seed){return (seed>>>0)&1?'B':'A';}
function paletteFor(seed,control=0){
  seed>>>=0;control&=0xFFFF;
  return control?((control>>>3)&7):((seed>>>25)&7);
}
function headgearForControl(control=0){
  const v=(control&6)>>>1;
  return v===1?0:v===2?1:v===3?2:null;
}
function variantFor(seed,key){
  const def=categoryDef(key);seed>>>=0;
  if(!def||def.controlSelector)return null;
  return (seed>>>def.seedBit)&7;
}
function variantsForSeed(seed){
  const out={};
  for(const def of CATEGORIES)if(!def.controlSelector)out[def.key]=variantFor(seed,def.key);
  return out;
}
function setBank(seed,bank){seed>>>=0;return bank==='B'?(seed|1)>>>0:(seed&0xFFFFFFFE)>>>0;}
function setVariant(seed,key,variant){
  const def=categoryDef(key);seed>>>=0;variant&=7;
  if(!def||def.controlSelector)return seed;
  const mask=(7<<def.seedBit)>>>0;
  return ((seed&(~mask))|((variant<<def.seedBit)>>>0))>>>0;
}
function setHeadgear(control,variant){
  control&=0xFFFF;
  control&=~6;
  if(variant===0)control|=2;
  else if(variant===1)control|=4;
  else if(variant===2)control|=6;
  return control&0xFFFF;
}
function recordFor(decoded,bank,key,variant){
  return decoded?.[bank]?.categories?.[key]?.[variant]||null;
}

function rgb12(word){
  return [((word>>>8)&15)*17,((word>>>4)&15)*17,(word&15)*17,255];
}
function displayPalette(paletteIndex,greyscale=false){
  const out=new Array(16);
  out[0]=[0,0,0,0];
  for(let i=1;i<16;i++){
    const g=Math.round((i/15)*235);
    out[i]=[g,g,g,255];
  }
  if(!greyscale){
    const exact=DYNAMIC_PALETTES[paletteIndex&7];
    for(let i=0;i<4;i++)out[i+1]=rgb12(exact[i]);
    // Known renderer conventions; indices 5..13 remain neutral reference colours
    // until the complete face-screen palette load is traced.
    out[14]=[0,0,85,255];
    out[15]=[170,170,170,255];
  }
  return out;
}

function composeFace(decoded,seed,control=0,options={}){
  seed>>>=0;control&=0xFFFF;
  const bank=bankForSeed(seed),w=FACE_CANVAS.width,h=FACE_CANVAS.height,pixels=new Uint8Array(w*h);
  const used=[];
  const headgear=headgearForControl(control);
  let order=NORMAL_RENDER_ORDER.slice();
  if(headgear!==null){
    order=order.filter(k=>k!=='hair_head_outline'&&k!=='upper_face_hairline');
    // For control states 2/4 the original routine has additional post-render handling
    // still being traced. Drawing the decoded headgear bitmap here gives the editor a
    // useful component preview without claiming final runtime equivalence.
    order.unshift('special_headgear');
  }
  for(const key of order){
    const variant=key==='special_headgear'?headgear:variantFor(seed,key);
    const entry=recordFor(decoded,bank,key,variant);
    if(!entry?.record)continue;
    const r=entry.record;
    for(let sy=0;sy<r.height;sy++)for(let sx=0;sx<r.width;sx++){
      const v=r.pixels[sy*r.width+sx];
      if(v===0)continue;
      const dx=r.x+sx,dy=r.y+sy;
      if(dx>=0&&dy>=0&&dx<w&&dy<h)pixels[dy*w+dx]=v;
    }
    used.push(entry);
  }
  return {bank,seed,control,paletteIndex:paletteFor(seed,control),headgear,pixels,width:w,height:h,used};
}

function renderIndexed(canvas,pixels,width,height,palette,scaleToCanvas=false){
  const ctx=canvas.getContext('2d',{alpha:false});
  const targetW=scaleToCanvas?canvas.width:width,targetH=scaleToCanvas?canvas.height:height;
  const off=document.createElement('canvas');off.width=width;off.height=height;
  const octx=off.getContext('2d');
  const img=octx.createImageData(width,height);
  for(let i=0;i<pixels.length;i++){
    const c=palette[pixels[i]]||[255,0,255,255],j=i*4;
    img.data[j]=c[0];img.data[j+1]=c[1];img.data[j+2]=c[2];img.data[j+3]=c[3]??255;
  }
  octx.putImageData(img,0,0);
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#090a0d';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(off,0,0,targetW,targetH);
}

async function sha256(bytes){
  if(!root.crypto?.subtle)return null;
  const digest=await root.crypto.subtle.digest('SHA-256',bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}

root.FrontierFaceData=Object.freeze({
  VERSION,EXPECTED_SHA256,EXPECTED_SIZE,HUNK7_FILE_OFFSET,BANK_TABLES,FACE_CANVAS,
  CATEGORIES,NORMAL_RENDER_ORDER,DYNAMIC_PALETTES,
  readU16,readS16,writeU16,hex,categoryDef,decodeRecord,encodePixels,patchRecordPixels,
  decodeBank,decodeAll,bankForSeed,paletteFor,headgearForControl,variantFor,variantsForSeed,
  setBank,setVariant,setHeadgear,recordFor,rgb12,displayPalette,composeFace,renderIndexed,sha256
});
})(typeof globalThis!=='undefined'?globalThis:this);
