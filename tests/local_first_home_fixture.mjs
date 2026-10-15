export function homeFixture(count,today,emptyData) {
  if(!Number.isInteger(count)||count<0||count>10000)throw new Error('Synthetic size must be within the checked range');
  const state={format:'local-first-test-ledger',version:11,owner:'local-test-owner',...emptyData(10),payment_sources:[{id:'p_cash',name:'現金',active:1},{id:'p_unspecified',name:'未指定',active:1}]};
  state.budgets.push({month:today.slice(0,7),category:'總額',cents:'100000000'});
  state.tags=Array.from({length:12},(_,i)=>({id:'t_home_'+i,name:i===0?'<svg/onload=alert(1)>':'合成標籤'+i,hidden:Number(i===1),revision:0}));
  for(let i=0;i<count;i++) {
    const id='e_home_'+String(i).padStart(5,'0');
    state.expenses.push({id,spent_on:today,cents:String([123,29,50][i%3]),category:i%2?'交通':'餐飲',note:i===0?'<img src=x onerror=alert(1)>':'合成首頁'+i,source:'manual',recurring_id:null,period:null,voided:0,payment_source_id:'p_cash',payment_source_name:'現金',kind:'consumption',revision:0});
    state.actions.push({id:'a_home_'+i,expense_id:id,before:null,undone:0});
    state.usage_periods.push({expense_id:id,started_on:today,days:60+i%7,remind:0,reminder_days:7,show_daily_cost:1,active:1,revision:0});
    for(const tag of [(i+3)%12,i%12])state.expense_tags.push({expense_id:id,tag_id:'t_home_'+tag});
  }
  return state;
}
