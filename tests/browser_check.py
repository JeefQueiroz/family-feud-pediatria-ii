"""Teste visual offline (sem tráfego HTTP, indisponível neste ambiente)."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
DATA=json.loads((PUBLIC/'data.json').read_text(encoding='utf-8'))
SCRIPT=(PUBLIC/'assets/app.js').read_text(encoding='utf-8')
CSS=(PUBLIC/'assets/styles.css').read_text(encoding='utf-8')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
    admin=context.new_page()
    html=(PUBLIC/'admin/index.html').read_text(encoding='utf-8')
    html=html.replace('<link rel="stylesheet" href="/assets/styles.css">','').replace('<script src="/assets/app.js" defer></script>','')
    admin.set_content(html)
    admin.add_style_tag(content=CSS)
    admin.evaluate('(data)=>{ window.fetch = async ()=>({ok:true,json:async()=>data}); }',DATA)
    admin.add_script_tag(content=SCRIPT)
    admin.locator('#question-picker option').first.wait_for(state='attached')
    assert admin.locator('button[data-action="answer"]').count()==8
    assert admin.locator('.pot-number').inner_text()=='0'
    assert admin.get_by_text('Anamnese cardiovascular').count()>=1
    admin.screenshot(path='/mnt/data/family-feud-pediatria-admin.png',full_page=True)
    admin.locator('button[data-action="answer"][data-index="0"]').click()
    assert admin.locator('.pot-number').inner_text()=='10'
    admin.locator('button[data-action="answer"][data-index="1"]').click()
    assert admin.locator('.pot-number').inner_text()=='20'
    admin.locator('button[data-action="award1"]').click()
    assert admin.locator('.score-number').first.inner_text()=='20'
    assert admin.locator('button[data-action="award1"]').is_disabled()
    admin.locator('button[data-action="undo"]').click()
    assert admin.locator('.score-number').first.inner_text()=='0'
    admin.locator('button[data-action="award1"]').click()
    admin.locator('button[data-action="next"]').click()
    assert admin.locator('.score-number').first.inner_text()=='20'
    admin.locator('button[data-action="multiplier"][data-mult="2"]').click()
    admin.locator('button[data-action="answer"][data-index="0"]').click()
    assert admin.locator('.pot-number').inner_text()=='20'
    admin.locator('button[data-action="award2"]').click()
    assert admin.locator('.score-number').nth(1).inner_text()=='20'
    admin.locator('button[data-action="mode-r1"]').click()
    assert admin.locator('button[data-action="award1"]').is_disabled()
    admin.locator('button[data-action="show-r1"]').click()
    assert admin.locator('.r1-option.correct').count()==1
    admin.locator('button[data-action="award1"]').click()
    assert admin.locator('.score-number').first.inner_text()=='30'
    admin.screenshot(path='/mnt/data/family-feud-pediatria-r1.png',full_page=True)
    tv=context.new_page()
    tv_html=(PUBLIC/'index.html').read_text(encoding='utf-8').replace('<link rel="stylesheet" href="/assets/styles.css">','').replace('<script src="/assets/app.js" defer></script>','')
    tv.set_content(tv_html)
    tv.add_style_tag(content=CSS)
    tv.evaluate('(data)=>{ window.fetch = async ()=>({ok:true,json:async()=>data}); }',DATA)
    tv.add_script_tag(content=SCRIPT)
    assert tv.locator('.answer-slot').count()==8
    tv.screenshot(path='/mnt/data/family-feud-pediatria-tv.png',full_page=True)
    browser.close()
print('PASSOU: renderização offline, oito cartões, 10 pontos por resposta, multiplicador, proteção contra duplicação, desfazer e R1.')
