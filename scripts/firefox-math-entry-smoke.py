"""Native typing test for mk/dm on a synthetic editor in an anonymous profile."""
import base64,io,json,pathlib,sys,urllib.request,zipfile
c=json.loads(pathlib.Path(sys.argv[1]).read_text());base=c['base']+'/session/'+c['sessionId']
def post(path,data):
 r=urllib.request.Request(base+path,data=json.dumps(data).encode(),headers={'Content-Type':'application/json'})
 return json.load(urllib.request.urlopen(r,timeout=30))['value']
def script(code,args=None):return post('/execute/sync',{'script':code,'args':args or []})
def tick():post('/execute/async',{'script':'setTimeout(arguments[0],550)','args':[]})
archive=io.BytesIO()
with zipfile.ZipFile(archive,'w') as z:
 for p in pathlib.Path('dist/diagnostic').iterdir():
  if p.is_file():z.writestr(p.name,p.read_bytes())
post('/moz/addon/install',{'addon':base64.b64encode(archive.getvalue()).decode(),'temporary':True})
try:
 for typed,expected in [('mk','$$'),('dm','$$'),('Texto mk','Texto $$'),('Texto dm','Texto \n$$'),('bookmark','bookmark')]:
  post('/url',{'url':'https://www.dropbox.com/robots.txt'})
  script('document.body.innerHTML=arguments[0]', ['<div class="ace-editor zoneId-0" contenteditable="true" style="white-space:pre-wrap"><div class="ace-line"><br></div></div>'])
  tick()
  script('const e=document.querySelector(".ace-editor"),line=e.querySelector(".ace-line");e.focus();const r=document.createRange();r.setStart(line,0);r.collapse(true);getSelection().removeAllRanges();getSelection().addRange(r);')
  element=post('/element',{'using':'css selector','value':'.ace-editor'})['element-6066-11e4-a52e-4f735466cecf']
  post('/element/'+element+'/value',{'text':typed});tick()
  actual=script('return document.querySelector(".ace-editor").innerText')
  assert actual==expected,(typed,actual,script('return document.querySelector(".ace-editor").innerHTML'))
  print('PASS:',repr(typed),'native text entry')
 print('LIMIT: confirms native text conversion only; Paper must recognize $$ in the live application.')
finally:
 post('/moz/addon/uninstall',{'id':'paper-equation-inspector@latex-suite.local'})
