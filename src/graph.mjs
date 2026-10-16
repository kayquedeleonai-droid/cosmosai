import {isLocalMedia} from './local-media.mjs';
import {safeMedia,referenceIndex,referenceSlots} from './runware-models.mjs';
export const catalog = {
  photoshop: {label:'Photoshop',category:'SAÍDA',color:'#65baff',input:'image',output:null,description:'Exporte imagens em camadas para o Photoshop.'},
  upscalevideo: {label:'Topaz Video Upscale',category:'MODELO',color:'#a98bfa',input:'video',output:'video',description:'Amplie vídeos com Topaz pela Magnific.'},
  loadvideo: { label: 'Load Video', category: 'ENTRADA', color: '#a98bfa', input: null, output: 'video', description: 'Traga um vídeo do seu computador.' },
  compare: { label: 'Compare', category: 'UTILITÁRIO', color: '#06bdd5', input: 'image', output: 'image', description: 'Compare duas imagens sem consumir créditos.' },
  prompt: { label: 'Prompt', category: 'ENTRADA', color: '#c0a1ff', input: null, output: 'text', description: 'Transforme uma ideia em direção criativa.' },
  image: { label: 'Load Image', category: 'ENTRADA', color: '#80c5a8', input: null, output: 'image', description: 'Traga uma referência do seu computador.' },
  generate: { label: 'Generate Image', category: 'MODELO', color: '#ffb627', input: 'text', output: 'image', description: 'Explore imagens a partir de um prompt.' },
  video: { label: 'Generate Video', category: 'MODELO', color: '#00bcd4', input: 'text', output: 'video', description: 'Gere vídeos com Seedance ou VEO via Runware.' },
  upscale: { label: 'Upscale', category: 'MODELO', color: '#f0bd83', input: 'image', output: 'image', description: 'Amplie imagens com Magnific Creative.' },
  output: { label: 'Output', category: 'SAÍDA', color: '#8ab9ec', input: 'image', output: null, description: 'Visualize e baixe o resultado do fluxo.' },
};
export function orderGraph(nodes, edges) {
  const ids = new Set(nodes.map(n => n.id));
  if (ids.size !== nodes.length) throw new Error('IDs de nodes duplicados.');
  const indegree = new Map(nodes.map(n => [n.id, 0]));
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) throw new Error('Conexão sem node.');
    indegree.set(e.target, indegree.get(e.target) + 1);
  }
  const queue = nodes.filter(n => !indegree.get(n.id)); const result = [];
  while (queue.length) { const node = queue.shift(); result.push(node);
    for (const e of edges.filter(e => e.source === node.id)) { indegree.set(e.target, indegree.get(e.target)-1); if (!indegree.get(e.target)) queue.push(nodes.find(n => n.id === e.target)); }
  }
  if (result.length !== nodes.length) throw new Error('O fluxo não pode conter ciclos.');
  return result;
}
export function validConnection(connection, nodes, edges) {
  const a = nodes.find(n => n.id === connection.source), b = nodes.find(n => n.id === connection.target);
  if (!a || !b || a.id === b.id) return false;
  if(b.data.kind==='compare'&&!['a','b'].includes(connection.targetHandle))return false;
  if(['a','b'].includes(connection.targetHandle)&&b.data.kind!=='compare')return false;
  if(b.data.kind==='photoshop'){
    const slot=/^layer-([1-9]|1[0-6])$/.exec(connection.targetHandle||'');
    if(!slot||Number(slot[1])>Number(b.data.psSlots||2)||catalog[a.data.kind]?.output!=='image'||a.data.mediaType==='video'||connection.sourceHandle!=null||edges.some(e=>e.target===b.id&&e.targetHandle===connection.targetHandle))return false;
    try{orderGraph(nodes,[...edges,connection]);return true;}catch{return false;}
  }
  const ref=referenceIndex(connection.targetHandle);
  if(ref>=0&&(!['generate','video'].includes(b.data.kind)||ref>=referenceSlots(b.data)))return false;
  const output=catalog[a.data.kind]?.output;
  const input=ref>=0&&['generate','video'].includes(b.data.kind)?'image':catalog[b.data.kind]?.input;
  if(connection.sourceHandle!=null||(ref<0&&![null,undefined,'a','b'].includes(connection.targetHandle)))return false;
  if(!output||!(output===input||(b.data.kind==='output'&&output==='video')))return false;
  if (edges.some(e => e.target === b.id && (e.targetHandle||null)===(connection.targetHandle||null))) return false;
  try { orderGraph(nodes, [...edges, connection]); return true; } catch { return false; }
}
export function validateProject(value) {
  if (!value || value.version !== 1 || typeof value.name !== 'string' || value.name.length > 120 || !Array.isArray(value.nodes) || !Array.isArray(value.edges) || value.nodes.length > 100 || value.edges.length > 200) throw new Error('Arquivo de projeto inválido.');
  for (const n of value.nodes) {
    if (typeof n.id !== 'string' || !Object.hasOwn(catalog,n.data?.kind) || !Number.isFinite(n.position?.x) || !Number.isFinite(n.position?.y)) throw new Error('Node inválido.');
    if(n.data.referenceSlots!=null&&(typeof n.data.referenceSlots!=='string'||!/^([1-9]|1[0-6])$/.test(n.data.referenceSlots)||Number(n.data.referenceSlots)>referenceSlots(n.data)))throw new Error('Quantidade de referências inválida.');
    if(n.data.psSlots!=null&&(typeof n.data.psSlots!=='string'||!/^([1-9]|1[0-6])$/.test(n.data.psSlots)))throw new Error('Quantidade de camadas inválida.');
    if (n.data.prompt != null && typeof n.data.prompt !== 'string') throw new Error('Prompt inválido.');
    if(n.data.imageName!=null&&(typeof n.data.imageName!=='string'||n.data.imageName.length>60||/[\[\]\n@]/.test(n.data.imageName)))throw new Error('Nome de imagem inválido.');
    if (n.data.model != null && (typeof n.data.model !== 'string' || n.data.model.length > 80)) throw new Error('Modelo inválido.');
    if (n.data.ratio != null && !['1:1','16:9','9:16'].includes(n.data.ratio)) throw new Error('Proporção inválida.');
    if(n.data.compareMode!=null&&!['wipe','side','overlay'].includes(n.data.compareMode))throw new Error('Modo de comparação inválido.');
    if(n.data.compareOutput!=null&&!['a','b'].includes(n.data.compareOutput))throw new Error('Saída de comparação inválida.');
    if(n.data.compareSplit!=null&&(typeof n.data.compareSplit!=='string'||!/^\d{1,3}$/.test(n.data.compareSplit)||Number(n.data.compareSplit)>100))throw new Error('Divisória inválida.');
    if (n.data.result != null && (typeof n.data.result !== 'string' || (n.data.result !== '/demo-landscape.svg' && !safeMedia(n.data.result) && !isLocalMedia(n.data.result) && !/^data:image\/(png|jpeg|webp);base64,/.test(n.data.result)))) throw new Error('Resultado inválido.');
    if(n.data.pendingTask!=null&&!/^[0-9a-f-]{36}$/i.test(n.data.pendingTask))throw new Error('Geração pendente inválida.');
    if(n.data.quality!=null&&!['auto','low','medium','high','xhigh','max'].includes(n.data.quality))throw new Error('Qualidade inválida.');
    if(n.data.resolution!=null&&!['480p','720p','1080p','1K','2K','4K'].includes(n.data.resolution))throw new Error('Resolução inválida.');
    if(n.data.duration!=null&&!Array.from({length:13},(_,i)=>String(i+3)).includes(n.data.duration))throw new Error('Duração inválida.');
    if(n.data.mediaType!=null&&!['image','video'].includes(n.data.mediaType))throw new Error('Tipo de mídia inválido.');
    if (n.data.image != null && (typeof n.data.image !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(n.data.image))) throw new Error('Imagem inválida.');
  }
  const edges = [];
  for (const e of value.edges) { if (typeof e.id !== 'string' || edges.some(previous => previous.id === e.id) || !validConnection(e, value.nodes, edges)) throw new Error('Conexão inválida.'); edges.push(e); }
  orderGraph(value.nodes, edges); return value;
}
