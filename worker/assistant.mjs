export function assistantInput(input){
 if(!Array.isArray(input.messages)||!input.messages.length||input.messages.length>12)throw new Error('Envie até 12 mensagens por conversa.');
 let length=0;
 const messages=input.messages.map((m,i)=>{
  if(!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()||m.content.length>4000||(i&&input.messages[i-1].role===m.role))throw new Error('Mensagem inválida. Use até 4.000 caracteres.');
  length+=m.content.length;return {role:m.role,content:m.content};
 });
 if(length>16000||messages.at(-1).role!=='user')throw new Error('Conversa muito longa. Inicie uma nova conversa.');
 return messages;
}
export async function converse(messages,key,fetcher=fetch){
 const response=await fetcher('https://api.openai.com/v1/responses',{
  method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
  body:JSON.stringify({model:'gpt-6-astra',store:false,reasoning:{effort:'low'},max_output_tokens:2048,
   instructions:'Você é Órbi, o assistente de IA do Cosmos, representado por um pequeno alienígena simpático. Converse em português brasileiro, com clareza e concisão. Ajude com prompts, direção de arte, imagem, vídeo e organização de workflows. O Cosmos usa nodes de Prompt, Gerar imagem, Gerar vídeo, Carregar imagem/vídeo, Upscale Magnific/Topaz e Photoshop (exportação PSD por camadas). Você não tem ferramentas nem acesso ao workflow, arquivos, saldo, imagens ou Photoshop do usuário. Não afirme ter visto, alterado ou gerado nada. Peça os detalhes necessários. Não invente preços, modelos disponíveis, ações realizadas ou acesso a informações atuais. Não cumprimente novamente a cada mensagem. Você não representa a Adobe nem os provedores.',
   input:messages}),signal:AbortSignal.timeout(60000)
 });
 const data=await response.json();
 if(!response.ok)throw new Error(response.status===401?'A chave OpenAI do assistente precisa ser atualizada.':response.status===429?'A OpenAI informou limite de uso ou créditos insuficientes. Verifique sua conta.':response.status===403||response.status===404?'A conta OpenAI não tem acesso ao GPT-6 Astra.':'A OpenAI não conseguiu responder. Tente novamente mais tarde.');
 const text=(data.output||[]).filter(item=>item.type==='message').flatMap(item=>item.content||[]).filter(c=>c.type==='output_text'||c.type==='refusal').map(c=>c.text||c.refusal||'').join('\n').trim();
 if(!text)throw new Error('O GPT-6 Astra não retornou texto. Tente uma pergunta mais curta.');
 return {text,model:'gpt-6-astra',incomplete:data.status==='incomplete'};
}
