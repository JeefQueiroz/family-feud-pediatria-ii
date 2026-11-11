"""Playwright: integração do painel e da TV sem escrita em produção."""
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/'public'
DATA=json.loads((PUB/'data.json').read_text(encoding='utf-8'))
JS=(PUB/'assets/app.js').read_text(encoding='utf-8')
CSS=(PUB/'assets/styles.css').read_text(encoding='utf-8')
MOCK="""
window.fakeNow=2000000000000;
Date.now=()=>window.fakeNow;
window.fetch=async()=>({ok:true,json:async()=>window.testData});
window.FFRemote={
  available:()=>true,canControl:()=>true,publish:()=>{},
  renderLogin:node=>node.textContent='PIN exigido',
  handleSubmit:()=>{},logout:()=>{},
  connect:c=>{window.host=c;if(window.remoteInitial)c.onState(window.remoteInitial);c.onAuth();}
};
"""
def page(browser,file,remote=None):
    tab=browser.new_page(viewport={'width':1280,'height':900})
    html=(PUB/file).read_text(encoding='utf-8')
    html=re.sub(r'<script\b[^>]*>\s*</script>','',html)
    html=re.sub(r'<link\s+rel="stylesheet"[^>]*>','',html)
    tab.set_content(html)
    tab.add_style_tag(content=CSS)
    tab.evaluate('(d)=>window.testData=d',DATA)
    tab.add_script_tag(content=MOCK)
    if remote:tab.evaluate('(d)=>window.remoteInitial=d',remote)
    tab.add_script_tag(content=JS)
    tab.locator('.stage-question').wait_for()
    return tab
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    admin=page(browser,'admin/index.html')
    assert admin.locator('.answer-slot').count()==8
    assert admin.locator('[data-timer-display]').first.inner_text()=='10'
    admin.locator('[data-action="timer-start"]').click()
    assert admin.locator('[data-timer-display]').first.inner_text()=='10'
    admin.evaluate('window.fakeNow+=3000')
    admin.wait_for_timeout(350)
    assert admin.locator('[data-timer-display]').first.inner_text()=='7'
    admin.locator('[data-action="timer-pause"]').click()
    admin.evaluate('window.fakeNow+=2000')
    admin.wait_for_timeout(350)
    assert admin.locator('[data-timer-display]').first.inner_text()=='7'
    admin.locator('[data-action="timer-start"]').click()
    admin.evaluate('window.fakeNow+=7001')
    admin.wait_for_timeout(350)
    assert admin.locator('[data-timer-display]').first.inner_text()=='0'
    admin.locator('[data-action="timer-start"]').click()
    assert admin.locator('[data-timer-display]').first.inner_text()=='10'
    admin.locator('[data-action="timer-reset"]').click()
    assert admin.locator('[data-timer-display]').first.inner_text()=='10'
    admin.locator('[data-action="select-team2"]').first.click()
    admin.locator('.answer-slot[data-answer="0"]').click()
    assert admin.locator('.score-number').nth(1).inner_text()=='10'
    assert admin.locator('.answer-slot.is-revealed').count()==1
    assert admin.locator('.answer-points').count()==0
    admin.locator('#presenter-quick-controls [data-action="next"]').click()
    admin.locator('#presenter-quick-controls [data-action="prev"]').click()
    assert admin.locator('.answer-slot.is-revealed').count()==1
    assert admin.locator('.score-number').nth(1).inner_text()=='10'
    admin.locator('[data-action="undo"]').click()
    assert admin.locator('.score-number').nth(1).inner_text()=='0'
    admin.locator('#presenter-quick-controls [data-action="mode-r1"]').click()
    admin.locator('[data-action="show-r1"]').click()
    admin.locator('[data-action="award1"]').click()
    assert admin.locator('.score-number').first.inner_text()=='10'
    admin.locator('#presenter-quick-controls [data-action="next"]').click()
    admin.locator('#presenter-quick-controls [data-action="prev"]').click()
    assert admin.locator('[data-action="award1"]').is_disabled()
    admin.on('dialog',lambda d:d.accept())
    admin.locator('[data-action="reset"]').click()
    assert admin.locator('.score-number').first.inner_text()=='0'
    assert admin.locator('.answer-slot.is-revealed').count()==0
    state={'mode':'round','round':0,'r1':0,'team1':'ALFA','team2':'BETA','score1':0,'score2':20,
           'multiplier':1,'revealed':[0],'strikes':0,'awarded':False,'r1ShowAnswer':False,
           'r1Awarded':False,'lastAward':None,'activeTeam':2,'timerRunning':True,
           'timerEnd':2000000005000,'timerRemaining':10,'rev':3}
    tv=page(browser,'index.html',state)
    tv.wait_for_timeout(300)
    assert tv.locator('#turn-indicator').inner_text()=='VEZ: BETA'
    assert tv.locator('#tv-timer-seconds').inner_text()=='5'
    assert tv.locator('.team-score.is-active-team .score-caption').inner_text()=='BETA'
    assert tv.locator('.answer-slot.is-revealed').count()==1
    for selector in ['#sound-button','#fullscreen-button','#connection']:
        assert tv.locator(selector).count()==0
    browser.close()
print('OK: painel, 10 segundos, pausa, reinício, respostas, pontuação, rodadas, R1, TV')
