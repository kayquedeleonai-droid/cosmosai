export const reviewStatuses=[
 {value:'',label:'No status'},
 {value:'in-progress',label:'In progress'},
 {value:'in-review',label:'In review'},
 {value:'approved',label:'Approved'},
 {value:'changes-requested',label:'Changes requested'},
];
export const reviewLabel=value=>reviewStatuses.find(s=>s.value===value)?.label||'No status';
export function withMediaReview(data,patch){
 const changed=(typeof patch.result==='string'&&patch.result!==(data.result||data.image))||(typeof patch.image==='string'&&patch.image!==(data.result||data.image));
 return {...data,...patch,...(changed?{reviewStatus:'in-progress'}:{})};
}
