export async function readBalance(key){
  if(!key)throw new Error('Saldo Runware indisponível.');
  const taskUUID=crypto.randomUUID();
  const response=await fetch('https://api.runware.ai/v1',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify([{taskType:'accountManagement',taskUUID,operation:'getDetails'}]),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Não foi possível consultar o saldo Runware.');
  const body=await response.json();
  const balance=body.data?.find(item=>item.taskUUID===taskUUID&&item.taskType==='accountManagement')?.balance;
  if(body.errors?.length||!balance||typeof balance.amount!=='number'||!Number.isFinite(balance.amount)||balance.currency!=='USD')throw new Error('Saldo Runware indisponível.');
  // Never forward account details, team members or API keys returned by getDetails.
  return {amount:balance.amount,currency:'USD',...(typeof balance.freeBalance==='number'&&Number.isFinite(balance.freeBalance)?{freeBalance:balance.freeBalance}:{}),updatedAt:Date.now()};
}

