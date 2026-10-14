// Keep the source-local key so existing 0.24.0 preferences remain readable.
export const HOME_PREFERENCES_KEY='daymargin.home.v1';
export function defaultHomePreferences() {
  return {version:2,order:['search','record','shortcuts','ending','budget','schedule','goals','expenses','calendar'],visible:{shortcuts:true,ending:true,budget:true,schedule:true,goals:false,expenses:true,calendar:true},shortcut_count:3,expanded:{shortcuts:false,budget:false,schedule:false,goals:false,ending:false,expenses:false}};
}
function validate(value) {
  const defaults=defaultHomePreferences(),keys=(object,expected)=>object&&typeof object==='object'&&!Array.isArray(object)&&Object.keys(object).length===expected.length&&expected.every(key=>Object.hasOwn(object,key));
  const legacy=value?.version===1,added=['expenses','calendar'],order=legacy?defaults.order.filter(key=>!added.includes(key)):defaults.order;
  if(!keys(value,Object.keys(defaults))||![1,2].includes(value.version)||!Array.isArray(value.order)||value.order.length!==order.length||new Set(value.order).size!==order.length||value.order.some(key=>!order.includes(key))||!Number.isSafeInteger(value.shortcut_count)||value.shortcut_count<0)throw new TypeError('Invalid home preferences');
  for(const key of ['visible','expanded']){
    const expected=Object.keys(defaults[key]).filter(name=>!(legacy&&key==='visible'&&added.includes(name)));
    if(!keys(value[key],expected)||Object.values(value[key]).some(item=>typeof item!=='boolean'))throw new TypeError('Invalid home preferences');
  }
  if(legacy)return {...value,version:2,order:[...value.order,...added],visible:{...value.visible,expenses:true,calendar:true}};
  return value;
}
export function loadHomePreferences(storage) {
  try {
    const text=storage.getItem(HOME_PREFERENCES_KEY);
    if(text===null)return {preferences:defaultHomePreferences(),warning:''};
    if(typeof text!=='string'||text.length>4096)throw new TypeError('Invalid home preferences');
    return {preferences:validate(JSON.parse(text)),warning:''};
  }catch{return {preferences:defaultHomePreferences(),warning:'首頁偏好無法讀取，已使用預設；帳本不受影響。'};}
}
export function saveHomePreferences(storage,preferences) {
  try{storage.setItem(HOME_PREFERENCES_KEY,JSON.stringify(validate(preferences)));return true;}
  catch{return false;}
}
