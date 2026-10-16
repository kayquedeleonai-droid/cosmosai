import {catalog,validConnection} from './graph.mjs';
import {referenceSlots,referenceHandle} from './runware-models.mjs';
export function segmentsCross(a,b,c,d){
  const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const on=(p,q,r)=>r.x>=Math.min(p.x,q.x)-.01&&r.x<=Math.max(p.x,q.x)+.01&&r.y>=Math.min(p.y,q.y)-.01&&r.y<=Math.max(p.y,q.y)+.01;
  const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
  return (x*y<0&&z*w<0)||(Math.abs(x)<.01&&on(a,b,c))||(Math.abs(y)<.01&&on(a,b,d))||(Math.abs(z)<.01&&on(c,d,a))||(Math.abs(w)<.01&&on(c,d,b));
}
export function nearestConnection(sourceId,nodes,edges){
  const source=nodes.find(n=>n.id===sourceId);if(!source||!catalog[source.data.kind]?.output)return null;
  const sx=source.position.x+(source.measured?.width||430),sy=source.position.y+16;
  const choices=[];
  for(const target of nodes){
    const kind=target.data.kind;
    const handles=kind==='compare'?['a','b']:['generate','video'].includes(kind)?[null,...Array.from({length:referenceSlots(target.data)},(_,i)=>referenceHandle(i))]:[null];
    handles.forEach((handle,index)=>{const connection={source:sourceId,target:target.id,...(handle?{targetHandle:handle}:{})};if(validConnection(connection,nodes,edges))choices.push({connection,distance:Math.hypot(target.position.x-sx,target.position.y+16+index*28-sy)});});
  }
  return choices.sort((a,b)=>a.distance-b.distance||a.connection.target.localeCompare(b.connection.target))[0]?.connection||null;
}
