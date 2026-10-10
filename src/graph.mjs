export const catalog = {
  prompt: { label: 'Prompt', category: 'ENTRADA', color: '#c0a1ff', input: null, output: 'text', description: 'Transforme uma ideia em direção criativa.' },
  image: { label: 'Imagem', category: 'ENTRADA', color: '#80c5a8', input: null, output: 'image', description: 'Traga uma referência do seu computador.' },
  generate: { label: 'Gerar imagem', category: 'MODELO', color: '#ffb627', input: 'text', output: 'image', description: 'Explore imagens a partir de um prompt.' },
  video: { label: 'Gerar vídeo', category: 'MODELO', color: '#00bcd4', input: 'text', output: 'video', description: 'Prepare uma etapa de vídeo. API ainda não conectada.' },
  upscale: { label: 'Upscale', category: 'MODELO', color: '#f0bd83', input: 'image', output: 'image', description: 'Uma etapa preparada para ampliar detalhes.' },
  output: { label: 'Resultado', category: 'SAÍDA', color: '#8ab9ec', input: 'image', output: null, description: 'Visualize e baixe o resultado do fluxo.' },
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
  if (!catalog[a.data.kind]?.output || catalog[a.data.kind].output !== catalog[b.data.kind]?.input) return false;
  if (edges.some(e => e.target === b.id)) return false;
  try { orderGraph(nodes, [...edges, connection]); return true; } catch { return false; }
}
export function validateProject(value) {
  if (!value || value.version !== 1 || typeof value.name !== 'string' || value.name.length > 120 || !Array.isArray(value.nodes) || !Array.isArray(value.edges) || value.nodes.length > 100 || value.edges.length > 200) throw new Error('Arquivo de projeto inválido.');
  for (const n of value.nodes) {
    if (typeof n.id !== 'string' || !catalog[n.data?.kind] || !Number.isFinite(n.position?.x) || !Number.isFinite(n.position?.y)) throw new Error('Node inválido.');
    if (n.data.prompt != null && typeof n.data.prompt !== 'string') throw new Error('Prompt inválido.');
    if (n.data.model != null && (typeof n.data.model !== 'string' || n.data.model.length > 80)) throw new Error('Modelo inválido.');
    if (n.data.ratio != null && !['1:1','16:9','9:16'].includes(n.data.ratio)) throw new Error('Proporção inválida.');
    if (n.data.result != null && (typeof n.data.result !== 'string' || (n.data.result !== '/demo-landscape.svg' && !/^data:image\/(png|jpeg|webp);base64,/.test(n.data.result)))) throw new Error('Resultado inválido.');
    if (n.data.image != null && (typeof n.data.image !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(n.data.image))) throw new Error('Imagem inválida.');
  }
  const edges = [];
  for (const e of value.edges) { if (typeof e.id !== 'string' || edges.some(previous => previous.id === e.id) || !validConnection(e, value.nodes, edges)) throw new Error('Conexão inválida.'); edges.push(e); }
  orderGraph(value.nodes, edges); return value;
}
