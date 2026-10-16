import {findModel} from './runware-models.mjs';

// Runware published rates, verified 2026-10-10. These are estimates, never price guarantees.

export function estimateCost(input){

 const m=findModel(input.model);if(!m)throw new Error('Modelo inválido.');

 const r=input.resolution||m.defaultResolution||(m.kind==='video'?'720p':'1K'),d=Number(input.duration||(m.id.startsWith('minimax:')?5:4));

 let usd,variable=false;

 if(m.id==='google:4@2'){usd=r==='4K'?.244:.138;variable=true;}

 else if(m.id==='google:4@3'){usd={'1K':.0689,'2K':.103,'4K':.153}[r];variable=true;}

 else if(m.id.startsWith('openai:')){usd=m.id.endsWith('flare')?.0336:.0611;variable=true;}

 else if(m.id==='bytedance:seedream@5.0-pro')usd=r==='2K'?.0963:.0481;

 else if(m.id==='bytedance:seedance@2.0')usd={'480p':.07,'720p':.16,'1080p':.40,'4K':.856}[r]*d;

 else if(m.id==='bytedance:seedance@2.5')usd={'480p':.102,'720p':.23,'1080p':.614}[r]*d;

 else if(m.id==='klingai:kling-video@3.0-turbo')usd=(r==='1080p'?.14:.112)*d;

 else if(m.id==='minimax:h3@0')usd={'768p':.08,'1440p':.13}[r]*d;
 else if(m.id==='minimax:h3@fast')usd=({'480p':.046}[r])*d;
 else if(m.id==='minimax:h3@max')usd=({'480p':.05,'768p':.08}[r])*d;
 else if(m.id==='minimax:h3@max-turbo')usd=({'480p':.025,'768p':.04}[r])*d;

 else if(m.id==='google:3@2')usd=(r==='4K'?.60:.40)*d;

 if(!Number.isFinite(usd)||usd<=0)throw new Error('Preço indisponível para esta configuração.');

 // GPT is token-priced; reserve generously instead of treating the typical example as a quote.

 const referenceCount=Array.isArray(input.references)?input.references.length:(input.reference?1:0);
 if(m.id==='bytedance:seedream@5.0-pro')usd+=Math.max(0,referenceCount-1)*.00321;
 const reserve=m.id.startsWith('openai:')?Math.max(1,usd*20):usd*1.3+.01+referenceCount*.01;

 return {usd,reserve:Math.ceil(reserve*10000)/10000,variable,updated:m.id.startsWith('minimax:')?'2026-10-16':'2026-10-10'};

}

export const dollars=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:4}).format(n);

