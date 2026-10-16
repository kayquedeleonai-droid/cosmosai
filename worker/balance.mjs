export async function readBalance(key){
  if(!key)throw new Error('Saldo Runware indisponível.');
  const taskUUID=crypto.randomUUID();
  const response=await fetch('https://api.runware.ai/v1',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify([{taskType:'accountManagement',taskUUID,operation:'getDetails'}]),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(response.status===401||response.status===403?'A chave Runware não tem acesso à consulta de saldo.':response.status===429?'Runware limitou as consultas. Tentaremos novamente em instantes.':`Consulta de saldo Runware falhou (HTTP ${response.status}).`);
  const body=await response.json();
  const balance=body.data?.find(item=>item.taskUUID===taskUUID&&(!item.taskType||item.taskType==='accountManagement'))?.balance;
  if(body.errors?.length){const code=String(body.errors[0]?.code||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60);throw new Error(`Runware recusou a consulta de saldo${code?` (${code})`:''}.`);}
  const numeric=value=>typeof value==='number'?value:typeof value==='string'&&/^-?\d+(\.\d+)?$/.test(value)?Number(value):NaN;
  const amount=numeric(balance?.amount),freeBalance=numeric(balance?.freeBalance);
  if(!balance||!Number.isFinite(amount)||balance.currency!=='USD')throw new Error('Runware retornou um formato de saldo não reconhecido.');
  // Never forward account details, team members or API keys returned by getDetails.
  return {amount,currency:'USD',...(Number.isFinite(freeBalance)?{freeBalance}:{}),updatedAt:Date.now()};
}

