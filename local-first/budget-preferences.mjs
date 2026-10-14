export const BUDGET_PREFERENCES_KEY='daymargin.budget.v1';
export function loadBudgetPreferences(storage) {
  try {
    const text=storage.getItem(BUDGET_PREFERENCES_KEY);
    if(text===null)return {near:true,warning:''};
    if(typeof text!=='string'||text.length>1024)throw new TypeError();
    const value=JSON.parse(text);
    if(!value||Object.keys(value).length!==2||value.version!==1||typeof value.near!=='boolean')throw new TypeError();
    return {near:value.near,warning:''};
  }catch{return {near:true,warning:'預算提示偏好無法讀取，已使用預設；帳本不受影響。'};}
}
export function saveBudgetPreferences(storage,near) {
  try{if(typeof near!=='boolean')return false;storage.setItem(BUDGET_PREFERENCES_KEY,JSON.stringify({version:1,near}));return true;}
  catch{return false;}
}
