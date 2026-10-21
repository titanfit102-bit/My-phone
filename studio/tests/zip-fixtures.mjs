// Test-only ZIP fixtures; no external packages or archive execution.
const encoder=new TextEncoder();
const write16=(v,p,x)=>v.setUint16(p,x,true),write32=(v,p,x)=>v.setUint32(p,x>>>0,true);
export function makeZip(files,options={}) {
  const local=[],central=[];
  let offset=0;
  for(const item of files){
    const filename=item.name;
    const name=encoder.encode(filename);
    const content=encoder.encode(item.content||"");
    const flags=item.flags||0,method=item.method||0;
    const packed=item.packedSize??content.length;
    const unpacked=item.size??content.length;
    const localBuf=new Uint8Array(30+name.length+content.length);
    let d=new DataView(localBuf.buffer);
    write32(d,0,0x04034b50);
    write16(d,6,flags);write16(d,8,method);
    write32(d,18,packed);write32(d,22,unpacked);
    write16(d,26,name.length);localBuf.set(name,30);
    localBuf.set(content,30+name.length);
    local.push(localBuf);
    const centralBuf=new Uint8Array(46+name.length);
    d=new DataView(centralBuf.buffer);
    write32(d,0,0x02014b50);
    write16(d,4,3<<8); // Unix-origin archive
    write16(d,8,flags);write16(d,10,method);
    write32(d,20,packed);write32(d,24,unpacked);
    write16(d,28,name.length);write32(d,38,item.attrs??(0x81a40000));
    write32(d,42,offset);centralBuf.set(name,46);
    central.push(centralBuf);
    offset+=localBuf.length;
  }
  const size=central.reduce((sum,c)=>sum+c.length,0);
  const end=new Uint8Array(22);
  const d=new DataView(end.buffer);
  write32(d,0,0x06054b50);write16(d,8,files.length);
  write16(d,10,files.length);write32(d,12,size);write32(d,16,offset);
  const combined=new Uint8Array(offset+size+22);
  let pos=0;for(const c of [...local,...central,end]){combined.set(c,pos);pos+=c.length;}
  if(options.corruptSignature){combined[combined.length-22]=0;}
  return combined.buffer;
}
