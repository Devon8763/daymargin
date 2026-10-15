import {scheduleSafety} from './local_first_schedule_safety_checks.mjs';
try {
  const lines=await scheduleSafety(['訂閱', '分期']);
  document.querySelector('#result').textContent='PASS：'+lines.length+' 組訂閱／分期現行原生安全驗證';
  document.querySelector('#details').textContent=lines.join('\n');
}catch(error){document.querySelector('#result').textContent='FAIL：'+error.message;throw error;}
