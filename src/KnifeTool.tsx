import {useRef,useState} from 'react';
import {segmentsCross} from './canvas-tools.mjs';
type Point={x:number;y:number};
export default function KnifeTool({onCut}:{onCut:(ids:Set<string>)=>void}){
  const points=useRef<Point[]>([]),[line,setLine]=useState<Point[]>([]);
  return <svg className="knife-overlay" aria-label="Arraste para cortar conexões" onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);points.current=[{x:e.clientX,y:e.clientY}];setLine(points.current);}} onPointerMove={e=>{if(!points.current.length)return;points.current=[...points.current,{x:e.clientX,y:e.clientY}];setLine(points.current);}} onPointerUp={e=>{
    const stroke=[...points.current,{x:e.clientX,y:e.clientY}],ids=new Set<string>();
    if(points.current.length&&stroke.some(p=>Math.hypot(p.x-stroke[0].x,p.y-stroke[0].y)>4)){
      e.currentTarget.parentElement?.querySelectorAll<SVGGElement>('.react-flow__edge').forEach(edge=>{
        const path=edge.querySelector<SVGPathElement>('.react-flow__edge-path'),matrix=path?.getScreenCTM();if(!path||!matrix)return;
        const length=path.getTotalLength(),steps=Math.max(1,Math.ceil(length/4));let previous=path.getPointAtLength(0).matrixTransform(matrix);
        for(let i=1;i<=steps;i++){const next=path.getPointAtLength(length*i/steps).matrixTransform(matrix);if(stroke.some((p,j)=>j>0&&segmentsCross(stroke[j-1],p,previous,next))){const id=edge.dataset.id;if(id)ids.add(id);break;}previous=next;}
      });
      onCut(ids);
    }
    points.current=[];setLine([]);
  }} onPointerCancel={()=>{points.current=[];setLine([]);}} onLostPointerCapture={()=>{points.current=[];setLine([]);}}>
    <polyline points={line.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#fb7185" strokeWidth="2" strokeDasharray="5 4"/>
  </svg>;
}
