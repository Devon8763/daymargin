import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import {headers as securityHeaders} from '../local-first/serve.mjs';
const port = Number(process.argv[2] ?? 8767);
const secureHeaders=process.argv[3]==='--secure'?securityHeaders:{}; // Test-only CSP source; fixed entry has no port option.
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local preview port');
const files = new Map([
  ['/tests/local-first-budget-hints-demo.html',['../local-first/index.html','text/html']],
  ['/tests/local-first-budget-hints.html',['../local-first/index.html','text/html']],
  ['/tests/local_first_budget_hints_browser.mjs',['local_first_budget_hints_browser.mjs','text/javascript']],
  ['/local-first/budget-preferences.mjs',['../local-first/budget-preferences.mjs','text/javascript']],
  ['/tests/local-first-monthly.html',['../local-first/index.html','text/html']],
  ['/tests/local-first-monthly-demo.html',['../local-first/index.html','text/html']],
  ['/tests/local_first_monthly_accounts_browser.mjs',['local_first_monthly_accounts_browser.mjs','text/javascript']],
  ['/tests/local-first-analysis-layout.html',['../local-first/index.html','text/html']],
  ['/tests/local-first-analysis-layout-demo.html',['../local-first/index.html','text/html']],
  ['/tests/local_first_analysis_layout_browser.mjs',['local_first_analysis_layout_browser.mjs','text/javascript']],
  ['/tests/local-first-analysis-controls.html',['../local-first/index.html','text/html']],
  ['/tests/local_first_analysis_controls_browser.mjs',['local_first_analysis_controls_browser.mjs','text/javascript']],
  ['/tests/local-first-calendar-income.html',['../local-first/index.html','text/html']],
  ['/tests/local_first_calendar_income_browser.mjs',['local_first_calendar_income_browser.mjs','text/javascript']],
  ['/tests/local-first-account-search.html',['../local-first/index.html','text/html']],
  ['/tests/local_first_account_search_browser.mjs',['local_first_account_search_browser.mjs','text/javascript']],
  ['/tests/local-first-tag-monthly.html',['../local-first/index.html','text/html']],
  ['/tests/local_first_tag_monthly_ui_browser.mjs',['local_first_tag_monthly_ui_browser.mjs','text/javascript']],
  ['/tests/local_first_invoice_browser.html',['local_first_invoice_browser.html','text/html']],
  ['/tests/local_first_invoice_browser.mjs',['local_first_invoice_browser.mjs','text/javascript']],
  ['/tests/local-first-invoice.html',['../local-first/index.html','text/html']],
  ['/tests/local_first_invoice_ui_browser.mjs',['local_first_invoice_ui_browser.mjs','text/javascript']],
  ['/tests/local_first_recurring_income_browser.html', ['local_first_recurring_income_browser.html','text/html']],
  ['/tests/local_first_recurring_income_browser.mjs', ['local_first_recurring_income_browser.mjs','text/javascript']],
  ['/tests/local-first-recurring-income.html', ['../local-first/index.html','text/html']],
  ['/tests/local_first_recurring_income_ui_browser.mjs', ['local_first_recurring_income_ui_browser.mjs','text/javascript']],
  ['/tests/local-first-income-entry.html', ['../local-first/index.html','text/html']],
  ['/tests/local_first_income_entry_browser.mjs', ['local_first_income_entry_browser.mjs','text/javascript']],
  ['/tests/local-first-home-preferences.html', ['../local-first/index.html','text/html']],
  ['/tests/local_first_home_preferences_ui_browser.mjs', ['local_first_home_preferences_ui_browser.mjs','text/javascript']],
  ['/local-first/home-preferences.mjs', ['../local-first/home-preferences.mjs','text/javascript']],
  ['/tests/local-first-analysis.html', ['../local-first/index.html','text/html']],
  ['/tests/local_first_analysis_ui_browser.mjs', ['local_first_analysis_ui_browser.mjs','text/javascript']],
  ['/tests/local-first-goals.html', ['../local-first/index.html','text/html']],
  ['/tests/local_first_goals_ui_browser.mjs', ['local_first_goals_ui_browser.mjs','text/javascript']],
  ['/tests/local_first_goals_browser.html', ['local_first_goals_browser.html','text/html']],
  ['/tests/local_first_goals_browser.mjs', ['local_first_goals_browser.mjs','text/javascript']],
  ['/tests/local-first-usability.html', ['../local-first/index.html','text/html']],
  ['/tests/local_first_usability_browser.mjs', ['local_first_usability_browser.mjs','text/javascript']],
  ['/tests/local-first-batch.html', ['../local-first/index.html','text/html']],
  ['/tests/local_first_batch_ui_browser.mjs', ['local_first_batch_ui_browser.mjs','text/javascript']],
  ['/tests/local_first_batch_browser.html', ['local_first_batch_browser.html','text/html']],
  ['/tests/local_first_batch_browser.mjs', ['local_first_batch_browser.mjs','text/javascript']],
  ['/tests/local-first-site-search.html', ['../local-first/index.html','text/html']],
  ['/tests/local_first_site_search_browser.mjs', ['local_first_site_search_browser.mjs','text/javascript']],
  ['/tests/local_first_schedule_browser.html', ['local_first_schedule_browser.html','text/html']],
  ['/tests/local_first_schedule_browser.mjs', ['local_first_schedule_browser.mjs','text/javascript']],
  ['/tests/local_first_schedule_migration_browser.html', ['local_first_schedule_migration_browser.html','text/html']],
  ['/tests/local_first_schedule_migration_browser.mjs', ['local_first_schedule_migration_browser.mjs','text/javascript']],
  ['/tests/local-first-schedule.html', ['../local-first/index.html','text/html']],
  ['/tests/local_first_schedule_ui_browser.mjs', ['local_first_schedule_ui_browser.mjs','text/javascript']],
  ['/local-first/schedule.mjs', ['../local-first/schedule.mjs','text/javascript']],
  ['/tests/local-first-product-frame.html', ['../local-first/index.html','text/html']],
  ['/tests/local-first-tags.html', ['../local-first/index.html','text/html']],
  ['/tests/local_first_tags_ui_browser.mjs', ['local_first_tags_ui_browser.mjs','text/javascript']],
  ['/tests/local_first_tags_browser.html', ['local_first_tags_browser.html','text/html']],
  ['/tests/local_first_tags_browser.mjs', ['local_first_tags_browser.mjs','text/javascript']],
  ['/tests/local-first-navigation.html', ['../local-first/index.html', 'text/html']],
  ['/tests/local_first_navigation_browser.mjs', ['local_first_navigation_browser.mjs', 'text/javascript']],
  ['/tests/local-first-shortcuts.html', ['../local-first/index.html', 'text/html']],
  ['/tests/local_first_shortcuts_ui_browser.mjs', ['local_first_shortcuts_ui_browser.mjs', 'text/javascript']],
  ['/tests/local_first_shortcuts_browser.html', ['local_first_shortcuts_browser.html', 'text/html']],
  ['/tests/local_first_shortcuts_browser.mjs', ['local_first_shortcuts_browser.mjs', 'text/javascript']],
  ['/tests/local-first-usage.html', ['../local-first/index.html', 'text/html']],
  ['/tests/local_first_usage_ui_browser.mjs', ['local_first_usage_ui_browser.mjs', 'text/javascript']],
  ['/tests/local_first_usage_browser.html', ['local_first_usage_browser.html', 'text/html']],
  ['/tests/local_first_usage_browser.mjs', ['local_first_usage_browser.mjs', 'text/javascript']],
  ['/local-first/usage.mjs', ['../local-first/usage.mjs', 'text/javascript']],
  ['/tests/local-first-annual.html', ['../local-first/index.html', 'text/html']],
  ['/tests/local_first_annual_ui_browser.mjs', ['local_first_annual_ui_browser.mjs', 'text/javascript']],
  ['/tests/local_first_annual_browser.html', ['local_first_annual_browser.html', 'text/html']],
  ['/tests/local_first_annual_browser.mjs', ['local_first_annual_browser.mjs', 'text/javascript']],
  ['/tests/local-first-income.html', ['../local-first/index.html', 'text/html']],
  ['/tests/local_first_income_ui_browser.mjs', ['local_first_income_ui_browser.mjs', 'text/javascript']],
  ['/tests/local_first_income_browser.html', ['local_first_income_browser.html', 'text/html']],
  ['/tests/local_first_income_browser.mjs', ['local_first_income_browser.mjs', 'text/javascript']],
  ['/local-first/annual.mjs', ['../local-first/annual.mjs', 'text/javascript']],
  ['/local-first/income.mjs', ['../local-first/income.mjs', 'text/javascript']],
  ['/tests/local-first-comparison.html', ['../local-first/index.html', 'text/html']],
  ['/tests/local_first_comparison_ui_browser.mjs', ['local_first_comparison_ui_browser.mjs', 'text/javascript']],
  ['/local-first/comparison.mjs', ['../local-first/comparison.mjs', 'text/javascript']],
  ['/local-first/vendor/chartjs-4.5.1/chart.umd.min.js', ['../web/static/vendor/chartjs-4.5.1/chart.umd.min.js', 'text/javascript']],
  ['/tests/local_first_expense_browser.html', ['local_first_expense_browser.html', 'text/html']],
  ['/tests/local_first_expense_browser.mjs', ['local_first_expense_browser.mjs', 'text/javascript']],
  ['/tests/local-first-recurring.html', ['../local-first/index.html', 'text/html']],
  ['/tests/local_first_recurring_ui_browser.mjs', ['local_first_recurring_ui_browser.mjs', 'text/javascript']],
  ['/tests/local_first_recurring_browser.html', ['local_first_recurring_browser.html', 'text/html']],
  ['/tests/local_first_recurring_browser.mjs', ['local_first_recurring_browser.mjs', 'text/javascript']],
  ['/tests/local-first-csv.html', ['../local-first/index.html', 'text/html']],
  ['/tests/local_first_csv_ui_browser.mjs', ['local_first_csv_ui_browser.mjs', 'text/javascript']],
  ['/local-first/csv.mjs', ['../local-first/csv.mjs', 'text/javascript']],
  ['/tests/local-first-persistence.html', ['../local-first/index.html', 'text/html']],
  ['/tests/local_first_persistence_browser.mjs', ['local_first_persistence_browser.mjs', 'text/javascript']],
  ['/tests/local_first_update_browser.html', ['local_first_update_browser.html', 'text/html']],
  ['/tests/local_first_update_browser.mjs', ['local_first_update_browser.mjs', 'text/javascript']],
  ['/tests/local-first-crypto.html', ['../local-first/index.html', 'text/html']],
  ['/tests/local_first_crypto_ui_browser.mjs', ['local_first_crypto_ui_browser.mjs', 'text/javascript']],
  ['/tests/local_first_origin_browser.html', ['local_first_origin_browser.html', 'text/html']],
  ['/tests/local_first_origin_browser.mjs', ['local_first_origin_browser.mjs', 'text/javascript']],
  ['/tests/local-first-fixed.html', ['../local-first/index.html', 'text/html']],
  ['/tests/local_first_fixed_ui_browser.mjs', ['local_first_fixed_ui_browser.mjs', 'text/javascript']],
  ['/tests/local_first_fixed_browser.html', ['local_first_fixed_browser.html', 'text/html']],
  ['/tests/local_first_fixed_browser.mjs', ['local_first_fixed_browser.mjs', 'text/javascript']],
  ['/local-first/', ['../local-first/index.html', 'text/html']],
  ...['index.html', 'style.css', 'rules.mjs', 'browse.mjs', 'ledger.mjs', 'idb.mjs', 'page.mjs', 'backup.mjs', 'backup-crypto.mjs'].map(name => ['/local-first/' + name, ['../local-first/' + name, name.endsWith('.css') ? 'text/css' : name.endsWith('.html') ? 'text/html' : 'text/javascript']]),
  ['/local-first/sw.js', ['../local-first/sw.js', 'text/javascript']],
  ...['lossless-json.js', 'lossless-json.js.map'].map(name => ['/local-first/vendor/lossless-json-4.3.1/' + name, ['../local-first/vendor/lossless-json-4.3.1/' + name, name.endsWith('.map') ? 'application/json' : 'text/javascript']]),
  ['/tests/local_first_portable_browser.html', ['local_first_portable_browser.html', 'text/html']],
  ['/tests/local_first_portable_browser.mjs', ['local_first_portable_browser.mjs', 'text/javascript']],
  ['/tests/local_first_browser.html', ['local_first_browser.html', 'text/html']],
  ['/tests/local_first_browser.mjs', ['local_first_browser.mjs', 'text/javascript']],
  ['/tests/local_first_storage_browser.html', ['local_first_storage_browser.html', 'text/html']],
  ['/tests/local_first_storage_browser.mjs', ['local_first_storage_browser.mjs', 'text/javascript']],
  ['/tests/local_first_settings_browser.html', ['local_first_settings_browser.html', 'text/html']],
  ['/tests/local_first_settings_browser.mjs', ['local_first_settings_browser.mjs', 'text/javascript']],
  ['/tests/local_first_budgets_browser.html', ['local_first_budgets_browser.html', 'text/html']],
  ['/tests/local_first_budgets_browser.mjs', ['local_first_budgets_browser.mjs', 'text/javascript']],
  ['/tests/local_first_budgets_ui_browser.mjs', ['local_first_budgets_ui_browser.mjs', 'text/javascript']],
  ['/tests/local-first-budgets.html', ['../local-first/index.html', 'text/html']],
  ['/tests/local_first_offline_settings_browser.html', ['local_first_offline_settings_browser.html', 'text/html']],
  ['/tests/local_first_offline_settings_browser.mjs', ['local_first_offline_settings_browser.mjs', 'text/javascript']],
  ['/tests/local-first-settings.html', ['../local-first/index.html', 'text/html']],
  ['/tests/local_first_settings_ui_browser.mjs', ['local_first_settings_ui_browser.mjs', 'text/javascript']],
  ['/tests/local_first_scale_browser.html', ['local_first_scale_browser.html', 'text/html']],
  ['/tests/local_first_scale_browser.mjs', ['local_first_scale_browser.mjs', 'text/javascript']],
  ['/tests/local_first_ui_browser.mjs', ['local_first_ui_browser.mjs', 'text/javascript']],
  ['/tests/local_first_browse_browser.mjs', ['local_first_browse_browser.mjs', 'text/javascript']],
  ['/tests/local_first_entry_browser.mjs', ['local_first_entry_browser.mjs', 'text/javascript']],
  ['/tests/local-first-ui.html', ['../local-first/index.html', 'text/html']],
  ['/tests/local-first-browse.html', ['../local-first/index.html', 'text/html']],
  ['/tests/local-first-entry.html', ['../local-first/index.html', 'text/html']],
  ['/tests/fixtures/life_ledger_rules.json', ['fixtures/life_ledger_rules.json', 'application/json']],
  ['/tests/fixtures/portable_life_ledger.json', ['fixtures/portable_life_ledger.json', 'application/json']],
]);
// File-only loopback preview: no ledger API, directory listing, or access to other project files.
createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  console.log(request.method, path);
  if(request.method==='GET'&&path==='/tests/local-first-budget-hints-narrow.html'){response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>375px 預算提示</title><iframe title="合成預算提示" src="/tests/local-first-budget-hints-demo.html" width="375" height="2100"></iframe></html>');return;}
  if(request.method==='GET'&&path==='/tests/local-first-monthly-demo-narrow.html'){response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>375px 每月收支畫面</title><iframe title="合成每月收支畫面" src="/tests/local-first-monthly-demo.html" width="375" height="2000"></iframe></html>');return;}
  if(request.method==='GET'&&path==='/tests/local-first-monthly-narrow.html'){response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>375px 每月收支</title><iframe title="合成每月收支" src="/tests/local-first-monthly.html" width="375" height="1100"></iframe></html>');return;}
  if(request.method==='GET'&&path==='/tests/local-first-analysis-layout-narrow.html') {response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>375px 分析期間卡</title><iframe title="合成分析期間卡" src="/tests/local-first-analysis-layout-demo.html" width="375" height="1100"></iframe></html>');return;}
  if(request.method==='GET'&&path==='/tests/local-first-analysis-layout-check-narrow.html') {response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>375px 分析驗證</title><iframe title="合成分析驗證" src="/tests/local-first-analysis-layout.html" width="375" height="1100"></iframe></html>');return;}
  if(request.method==='GET'&&path==='/tests/local-first-analysis-controls-narrow.html') {response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>375px 分析操作</title><iframe title="合成分析操作" src="/tests/local-first-analysis-controls.html" width="375" height="1100"></iframe></html>');return;}
  if(request.method==='GET'&&path==='/tests/local-first-calendar-income-narrow.html') {response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>375px 收入月曆</title><iframe title="合成收入月曆" src="/tests/local-first-calendar-income.html" width="375" height="1100"></iframe></html>');return;}
  if(request.method==='GET'&&path==='/tests/local-first-account-search-narrow.html') {response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>375px 收支搜尋</title><iframe title="合成收支搜尋" src="/tests/local-first-account-search.html" width="375" height="1100"></iframe></html>');return;}
  if(request.method==='GET'&&path==='/tests/local-first-invoice-narrow.html') {
    response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    response.end('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>375px 合成發票驗證</title><h1>375px 合成發票驗證</h1><iframe title="合成發票畫面" src="/tests/local-first-invoice.html" width="375" height="1100" style="border:0"></iframe></html>');return;
  }
  if (request.method === 'GET' && path === '/tests/local-first-narrow.html') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>375px 合成頁面布局驗證</title><h1>375px 瀏覽器子頁面驗證</h1><iframe title="本機記帳驗證" src="/tests/local-first-product-frame.html" width="375" height="1100" style="border:0"></iframe></html>');
    return;
  }
  const file = files.get(path);
  if(process.argv.includes('--no-charts')&&path==='/local-first/vendor/chartjs-4.5.1/chart.umd.min.js'){response.writeHead(503,secureHeaders);response.end();return;}
  if (request.method !== 'GET' || !file) { response.writeHead(404); response.end(); return; }
  try {
    let body = await readFile(new URL(file[0], import.meta.url));
    if(['/tests/local-first-monthly.html','/tests/local-first-monthly-demo.html'].includes(path)){
      body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_monthly_accounts_browser.mjs"');
      response.writeHead(200,{...secureHeaders,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':securityHeaders['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'")});response.end(body);return;
    }
    if(['/tests/local-first-analysis-layout.html','/tests/local-first-analysis-layout-demo.html'].includes(path)) {
      body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_analysis_layout_browser.mjs"');
      response.writeHead(200,{...secureHeaders,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':securityHeaders['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'")});response.end(body);return;
    }
    if(path==='/tests/local-first-analysis-controls.html') {
      body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_analysis_controls_browser.mjs"');
      response.writeHead(200,{...secureHeaders,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':securityHeaders['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'")});response.end(body);return;
    }
    if(['/tests/local-first-budget-hints.html','/tests/local-first-budget-hints-demo.html'].includes(path)){body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_budget_hints_browser.mjs"');response.writeHead(200,{...secureHeaders,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':securityHeaders['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'")});response.end(body);return;}
    if(path==='/tests/local-first-tag-monthly.html')body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_tag_monthly_ui_browser.mjs"');
    if(path==='/tests/local-first-calendar-income.html') {
      body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_calendar_income_browser.mjs"');
      response.writeHead(200,{...secureHeaders,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':securityHeaders['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'")});response.end(body);return;
    }
    if(path==='/tests/local-first-account-search.html') {
      body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_account_search_browser.mjs"');
      response.writeHead(200,{...secureHeaders,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':securityHeaders['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'")});response.end(body);return;
    }
    if(path==='/tests/local-first-invoice.html') {
      body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_invoice_ui_browser.mjs"');
      response.writeHead(200,{...secureHeaders,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':securityHeaders['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'")});response.end(body);return;
    }
    if(path==='/tests/local-first-recurring-income.html')body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_recurring_income_ui_browser.mjs"');
    if(path==='/tests/local-first-income-entry.html')body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_income_entry_browser.mjs"');
    if(path==='/tests/local-first-home-preferences.html')body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_home_preferences_ui_browser.mjs"');
    if(path==='/tests/local-first-analysis.html')body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_analysis_ui_browser.mjs"');
    if(path==='/tests/local-first-goals.html')body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_goals_ui_browser.mjs"');
    if(path==='/tests/local-first-usability.html')body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_usability_browser.mjs"');
    if(path==='/tests/local-first-batch.html')body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_batch_ui_browser.mjs"');
    if(path==='/tests/local-first-site-search.html')body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_site_search_browser.mjs"');
    if(path==='/tests/local-first-schedule.html')body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_schedule_ui_browser.mjs"');
    if(path==='/tests/local-first-product-frame.html') {
      body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/local-first/page.mjs"');
      response.writeHead(200,{...secureHeaders,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
        'X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':securityHeaders['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'")});
      response.end(body);return;
    }
    if(path==='/tests/local-first-tags.html')body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_tags_ui_browser.mjs"');
    if(path==='/tests/local-first-navigation.html')body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_navigation_browser.mjs"');
    if(path==='/tests/local-first-shortcuts.html')body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_shortcuts_ui_browser.mjs"');
    if(path==='/tests/local-first-usage.html')body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_usage_ui_browser.mjs"');
    // Isolated update tests only; these flags do not exist in the fixed production entry.
    if(process.argv[4]==='--previous-worker'&&path==='/local-first/sw.js')body=body.toString('utf8').replace('0.26.6-v1','0.13.11-v1')
      .replace("  '/local-first/comparison.mjs',\n",'').replace("  '/local-first/vendor/chartjs-4.5.1/chart.umd.min.js',\n",'');
    if(process.argv[4]==='--next-worker'&&(path==='/local-first/sw.js'||path==='/local-first/'||path==='/local-first/index.html'))
      body=body.toString('utf8').replace('0.26.6','0.26.7'); // Synthetic next-version label, not a release.
    if(path==='/tests/local-first-comparison.html')body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_comparison_ui_browser.mjs"');
    if (path === '/tests/local-first-recurring.html') {
      body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"')
        .replace('src="page.mjs"','src="/tests/local_first_recurring_ui_browser.mjs"');
    }
    if (path === '/tests/local-first-csv.html') {
      body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"')
        .replace('src="page.mjs"','src="/tests/local_first_csv_ui_browser.mjs"');
    }
    if (path === '/tests/local-first-persistence.html') {
      body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"')
        .replace('src="page.mjs"','src="/tests/local_first_persistence_browser.mjs"');
    }
    if (path === '/tests/local-first-crypto.html') {
      body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"')
        .replace('src="page.mjs"','src="/tests/local_first_crypto_ui_browser.mjs"');
    }
    if (path === '/tests/local-first-fixed.html') {
      body = body.toString('utf8').replace('<head>', '<head><base href="/local-first/">')
        .replace('src="page.mjs"', 'src="/tests/local_first_fixed_ui_browser.mjs"');
    }
    if (path === '/tests/local-first-ui.html') {
      body = body.toString('utf8').replace('href="style.css"', 'href="/local-first/style.css"')
        .replace('src="page.mjs"', 'src="/tests/local_first_ui_browser.mjs"');
    }
    if (path === '/tests/local-first-annual.html') {
      body=body.toString('utf8').replace('href="style.css"','href="/local-first/style.css"').replace('src="page.mjs"','src="/tests/local_first_annual_ui_browser.mjs"');
    }
    if (path === '/tests/local-first-income.html') {
      body = body.toString('utf8').replace('<head>', '<head><base href="/local-first/">')
        .replace('src="page.mjs"','src="/tests/local_first_income_ui_browser.mjs"');
    }
    if (path === '/tests/local-first-settings.html') {
      body = body.toString('utf8').replace('<head>', '<head><base href="/local-first/">')
        .replace('src="page.mjs"', 'src="/tests/local_first_settings_ui_browser.mjs"');
    }
    if (path === '/tests/local-first-budgets.html') {
      body = body.toString('utf8').replace('<head>', '<head><base href="/local-first/">')
        .replace('src="page.mjs"', 'src="/tests/local_first_budgets_ui_browser.mjs"');
    }
    if (path === '/tests/local-first-browse.html') {
      body = body.toString('utf8').replace('href="style.css"', 'href="/local-first/style.css"')
        .replace('src="page.mjs"', 'src="/tests/local_first_browse_browser.mjs"');
    }
    if (path === '/tests/local-first-entry.html') {
      body = body.toString('utf8').replace('<head>', '<head><base href="/local-first/">')
        .replace('src="page.mjs"', 'src="/tests/local_first_entry_browser.mjs"');
    }
    response.writeHead(200, { ...secureHeaders, 'Content-Type': file[1] + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(body);
  } catch { response.writeHead(404); response.end(); }
}).listen(port, '127.0.0.1', () => console.log(`Synthetic static preview: http://127.0.0.1:${port}/local-first/`));
