export const groupColors=['#06bdd5','#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444','#64748b'];
export function cleanGroups(groups=[],nodes){
  if(!Array.isArray(groups)||groups.length>100)throw new Error('Grupos inválidos.');
  const ids=new Set(nodes.map(n=>n.id)),seen=new Set(),members=new Set();
  return groups.map(g=>{
    if(!g||typeof g.id!=='string'||!g.id||seen.has(g.id)||typeof g.name!=='string'||!g.name.trim()||g.name.length>80||!groupColors.includes(g.color)||!Array.isArray(g.nodeIds)||g.nodeIds.length>100||g.nodeIds.some(id=>typeof id!=='string'))throw new Error('Grupo inválido.');
    seen.add(g.id);
    const nodeIds=[...new Set(g.nodeIds)].filter(id=>ids.has(id)&&!members.has(id));
    nodeIds.forEach(id=>members.add(id));
    return {id:g.id,name:g.name.trim(),color:g.color,nodeIds};
  }).filter(g=>g.nodeIds.length);
}
export function assignGroup(groups,group){
  const ids=new Set(group.nodeIds);
  return [...groups.filter(g=>g.id!==group.id).map(g=>({...g,nodeIds:g.nodeIds.filter(id=>!ids.has(id))})).filter(g=>g.nodeIds.length),group];
}
export function groupBounds(group,nodes){
  const members=nodes.filter(n=>group.nodeIds.includes(n.id));
  if(!members.length)return null;
  const x=Math.min(...members.map(n=>n.position.x))-24,y=Math.min(...members.map(n=>n.position.y))-64;
  return {x,y,width:Math.max(...members.map(n=>n.position.x+(n.measured?.width||430)))+24-x,height:Math.max(...members.map(n=>n.position.y+(n.measured?.height||300)))+24-y};
}
export function moveGroup(nodes,origins,delta){return nodes.map(n=>origins[n.id]?{...n,position:{x:origins[n.id].x+delta.x,y:origins[n.id].y+delta.y}}:n);}
