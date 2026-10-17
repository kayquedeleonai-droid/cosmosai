// Resolve existing images only. Previewing a comparison never starts a paid job.
export function resolveImage(id,nodes,edges,seen=new Set()) {
  if(seen.has(id))return undefined;
  seen.add(id);
  const node=nodes.find(n=>n.id===id);
  if(!node||node.data.kind==='video'||node.data.kind==='prompt'||node.data.mediaType==='video')return undefined;
  if(node.data.kind==='compare') {
    const edge=edges.find(e=>e.target===id&&e.targetHandle===(node.data.compareOutput||'a'));
    return edge?resolveImage(edge.source,nodes,edges,seen):undefined;
  }
  return node.data.result||node.data.image;
}
