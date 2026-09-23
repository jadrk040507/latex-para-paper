"""Install the built add-on in a dedicated anonymous WebDriver profile; never use a signed-in profile."""
import base64,io,json,pathlib,sys,urllib.request,zipfile
connection=json.loads(pathlib.Path(sys.argv[1]).read_text())
base=connection['base']+'/session/'+connection['sessionId']
def post(path,data):
 req=urllib.request.Request(base+path,data=json.dumps(data).encode(),headers={'Content-Type':'application/json'})
 return json.load(urllib.request.urlopen(req,timeout=35))['value']
def script(code,args=[]): return post('/execute/sync',{'script':code,'args':args})
archive=io.BytesIO()
with zipfile.ZipFile(archive,'w') as z:
 for path in pathlib.Path('dist/diagnostic').iterdir():
  if path.is_file(): z.writestr(path.name,path.read_bytes())
post('/moz/addon/install',{'addon':base64.b64encode(archive.getvalue()).decode(),'temporary':True})
# Dedicated anonymous headless profile. This is NOT the signed-in manual Paper window.
post('/timeouts',{'pageLoad':30000})
post('/url',{'url':'https://www.dropbox.com/robots.txt'})
assert script('return location.origin')=='https://www.dropbox.com'
fixture=pathlib.Path('probe/tests/fixtures/paper-equation.html').read_text()
script('document.body.innerHTML=arguments[0]',[fixture])
post('/execute/async',{'script':'setTimeout(arguments[0],300)','args':[]})
element=post('/element',{'using':'css selector','value':'.inline-latex-input'})['element-6066-11e4-a52e-4f735466cecf']
post('/element/'+element+'/value',{'text':'//a\ue004b'})
post('/execute/async',{'script':'setTimeout(arguments[0],50)','args':[]})
value=script('return document.querySelector(".inline-latex-input").value')
assert value==r'\frac{a}{b}',value
print('PASS: installed production extension automatically expands in a synthetic input on the permitted origin, without toolbar activation')
post('/refresh',{})
script('document.body.innerHTML=arguments[0]',[fixture])
post('/execute/async',{'script':'setTimeout(arguments[0],300)','args':[]})
element=post('/element',{'using':'css selector','value':'.inline-latex-input'})['element-6066-11e4-a52e-4f735466cecf']
post('/element/'+element+'/value',{'text':'sqx'})
post('/execute/async',{'script':'setTimeout(arguments[0],50)','args':[]})
assert script('return document.querySelector(".inline-latex-input").value')==r'\sqrt{x}'
print('PASS: automatic activation survives page refresh')
post('/moz/addon/uninstall',{'id':'paper-equation-inspector@latex-suite.local'})
print('LIMIT: fixture on public robots.txt, not actual Paper document state')
