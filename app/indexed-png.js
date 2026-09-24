(function(root){
'use strict';

/*
 * Tiny indexed-PNG codec for Frontier component exchange — v0.07.
 *
 * Export: 4-bit colour type 3 PNG, exactly 16 palette entries, index 0 transparent.
 * Import: non-interlaced indexed PNG using 1/2/4/8-bit indices; rejects pixel values
 * above 15 and returns the original palette indices unchanged.
 */
const VERSION='0.09';
const SIG=Uint8Array.from([137,80,78,71,13,10,26,10]);

function u32be(v){return Uint8Array.from([(v>>>24)&255,(v>>>16)&255,(v>>>8)&255,v&255]);}
function readU32(b,o){return (((b[o]<<24)>>>0)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3])>>>0;}
function ascii(bytes){return String.fromCharCode(...bytes);}
function concat(parts){const n=parts.reduce((a,b)=>a+b.length,0),out=new Uint8Array(n);let p=0;for(const b of parts){out.set(b,p);p+=b.length;}return out;}

const CRC_TABLE=(()=>{
  const t=new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}
  return t;
})();
function crc32(bytes){let c=0xFFFFFFFF;for(const v of bytes)c=CRC_TABLE[(c^v)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function adler32(bytes){let a=1,b=0;for(const v of bytes){a=(a+v)%65521;b=(b+a)%65521;}return ((b<<16)|a)>>>0;}
function chunk(type,data){
  const name=Uint8Array.from([...type].map(c=>c.charCodeAt(0))),body=concat([name,data]);
  return concat([u32be(data.length),body,u32be(crc32(body))]);
}
function zlibStore(data){
  const parts=[Uint8Array.from([0x78,0x01])];
  let pos=0;
  while(pos<data.length){
    const len=Math.min(65535,data.length-pos),final=(pos+len)>=data.length;
    const hdr=new Uint8Array(5);hdr[0]=final?1:0;hdr[1]=len&255;hdr[2]=(len>>>8)&255;const nlen=(~len)&0xFFFF;hdr[3]=nlen&255;hdr[4]=(nlen>>>8)&255;
    parts.push(hdr,data.slice(pos,pos+len));pos+=len;
  }
  parts.push(u32be(adler32(data)));
  return concat(parts);
}
function normalisePalette(palette){
  if(!Array.isArray(palette)||palette.length<16)throw new Error('Indexed PNG export requires 16 palette colours.');
  return palette.slice(0,16).map((c,i)=>{
    if(!c||c.length<3)throw new Error(`Palette entry ${i} is invalid.`);
    return [Number(c[0])&255,Number(c[1])&255,Number(c[2])&255];
  });
}
function encodeIndexedPng(pixels,width,height,palette){
  width=Number(width);height=Number(height);
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw new Error('PNG dimensions are invalid.');
  if(!(pixels instanceof Uint8Array))pixels=new Uint8Array(pixels);
  if(pixels.length!==width*height)throw new Error('PNG pixel buffer size does not match its dimensions.');
  for(const v of pixels)if(v>15)throw new Error(`PNG export found palette index ${v}; Frontier components must remain 0..15.`);
  const pal=normalisePalette(palette),ihdr=new Uint8Array(13);
  ihdr.set(u32be(width),0);ihdr.set(u32be(height),4);ihdr[8]=4;ihdr[9]=3;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
  const plte=new Uint8Array(16*3);for(let i=0;i<16;i++)plte.set(pal[i],i*3);
  const trns=new Uint8Array(16);trns.fill(255);trns[0]=0;
  const rowBytes=Math.ceil(width/2),raw=new Uint8Array((rowBytes+1)*height);
  for(let y=0;y<height;y++){
    const ro=y*(rowBytes+1);raw[ro]=0;
    for(let x=0;x<width;x++){const v=pixels[y*width+x]&15,di=ro+1+(x>>1);if((x&1)===0)raw[di]|=v<<4;else raw[di]|=v;}
  }
  return concat([SIG,chunk('IHDR',ihdr),chunk('PLTE',plte),chunk('tRNS',trns),chunk('IDAT',zlibStore(raw)),chunk('IEND',new Uint8Array(0))]);
}
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
async function inflateZlib(data){
  if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot decompress PNG image data.');
  const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function decodeIndexedPng(bytes){
  if(!(bytes instanceof Uint8Array))bytes=new Uint8Array(bytes);
  if(bytes.length<8||!SIG.every((v,i)=>bytes[i]===v))throw new Error('Not a PNG file.');
  let pos=8,ihdr=null,plte=null,trns=null,idat=[];
  while(pos+12<=bytes.length){
    const len=readU32(bytes,pos),type=ascii(bytes.slice(pos+4,pos+8)),start=pos+8,end=start+len;
    if(end+4>bytes.length)throw new Error('PNG chunk overruns the file.');
    const data=bytes.slice(start,end);
    if(type==='IHDR')ihdr=data;else if(type==='PLTE')plte=data;else if(type==='tRNS')trns=data;else if(type==='IDAT')idat.push(data);else if(type==='IEND')break;
    pos=end+4;
  }
  if(!ihdr||ihdr.length!==13)throw new Error('PNG IHDR is missing or invalid.');
  const width=readU32(ihdr,0),height=readU32(ihdr,4),bitDepth=ihdr[8],colourType=ihdr[9],compression=ihdr[10],filterMethod=ihdr[11],interlace=ihdr[12];
  if(colourType!==3)throw new Error('Component import requires an indexed-colour PNG (PNG colour type 3).');
  if(![1,2,4,8].includes(bitDepth))throw new Error(`Unsupported indexed PNG bit depth ${bitDepth}.`);
  if(compression!==0||filterMethod!==0||interlace!==0)throw new Error('Only standard non-interlaced indexed PNGs are supported.');
  if(!plte||plte.length<3)throw new Error('Indexed PNG has no palette.');
  const paletteEntries=Math.floor(plte.length/3);
  const palette=[];for(let i=0;i<paletteEntries;i++)palette.push([plte[i*3],plte[i*3+1],plte[i*3+2],trns&&i<trns.length?trns[i]:255]);
  const packed=concat(idat),raw=await inflateZlib(packed),rowBytes=Math.ceil(width*bitDepth/8),expected=(rowBytes+1)*height;
  if(raw.length<expected)throw new Error('PNG image data is shorter than expected.');
  const unfiltered=new Uint8Array(rowBytes*height),bpp=1;
  for(let y=0;y<height;y++){
    const src=y*(rowBytes+1),filter=raw[src],dst=y*rowBytes;
    for(let x=0;x<rowBytes;x++){
      const v=raw[src+1+x],a=x>=bpp?unfiltered[dst+x-bpp]:0,b=y?unfiltered[dst-rowBytes+x]:0,c=y&&x>=bpp?unfiltered[dst-rowBytes+x-bpp]:0;
      let q;if(filter===0)q=v;else if(filter===1)q=(v+a)&255;else if(filter===2)q=(v+b)&255;else if(filter===3)q=(v+Math.floor((a+b)/2))&255;else if(filter===4)q=(v+paeth(a,b,c))&255;else throw new Error(`Unsupported PNG row filter ${filter}.`);
      unfiltered[dst+x]=q;
    }
  }
  const pixels=new Uint8Array(width*height),mask=(1<<bitDepth)-1,perByte=8/bitDepth;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const byte=unfiltered[y*rowBytes+Math.floor(x/perByte)],shift=8-bitDepth-(x%perByte)*bitDepth,v=(byte>>>shift)&mask;
    if(v>15)throw new Error(`PNG uses palette index ${v}; Frontier components are limited to indices 0..15.`);
    pixels[y*width+x]=v;
  }
  return {width,height,bitDepth,palette,pixels};
}
root.FrontierIndexedPng=Object.freeze({VERSION,encodeIndexedPng,decodeIndexedPng});
})(typeof globalThis!=='undefined'?globalThis:this);
