"""Exercise real Firefox editing on synthetic content only; never visits Dropbox."""
import json
import pathlib
import sys
import urllib.parse
import urllib.request

session_file = pathlib.Path(sys.argv[1])
connection = json.loads(session_file.read_text())
base = connection['base'] + '/session/' + connection['sessionId']

def post(path, data):
    request = urllib.request.Request(base + path, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(request, timeout=20))['value']

def script(code, args=None):
    return post('/execute/sync', {'script': code, 'args': args or []})

def tick():
    post('/execute/async', {'script': 'setTimeout(arguments[0], 30)', 'args': []})

html = '<title>Local Firefox LaTeX smoke test</title><input id="equation" type="text"><button>After input</button>'
post('/url', {'url': 'data:text/html,' + urllib.parse.quote(html)})
script(pathlib.Path('dist/firefox-smoke.js').read_text())
element = post('/element', {'using': 'css selector', 'value': '#equation'})['element-6066-11e4-a52e-4f735466cecf']

def type_keys(keys):
    post('/element/' + element + '/value', {'text': keys})
    tick()

def state():
    return script('const el=document.querySelector("#equation");return {text:el.value,from:el.selectionStart,to:el.selectionEnd,status:window.smokeControl.status()}')

type_keys('/')
type_keys('/')
value = state()
assert value['text'] == '\\frac{}{}' and value['from'] == 6, value
print('PASS: trusted keyboard input expands // and positions numerator')
type_keys('a')
type_keys('\ue004')
assert state()['from'] == 9, state()
type_keys('b')
assert state()['text'] == '\\frac{a}{b}', state()
print('PASS: typing numerator and Tab/denominator preserves offsets')
type_keys('\ue008\ue004\ue000')
assert state()['from'] == 7, state()
type_keys('\ue004')
assert state()['from'] == 10, state()
type_keys('\ue004')
assert state()['from'] == 11, state()
print('PASS: Shift+Tab, Tab, and snippet exit')
type_keys('\ue009z\ue000')
assert state()['text'] != '\\frac{a}{b}', state()
type_keys('\ue009y\ue000')
# Firefox Linux redo may instead use Ctrl+Shift+Z; use native redo if Ctrl+Y is unmapped.
if state()['text'] != '\\frac{a}{b}':
    type_keys('\ue009\ue008z\ue000')
assert state()['text'] == '\\frac{a}{b}', state()
print('PASS: native undo and redo restore the fraction edit')
type_keys('\ue009a\ue000\ue003')
type_keys('//ab\ue004c')
assert state()['text'] == '\\frac{ab}{c}', state()
print('PASS: rapid typing and Tab in one native key batch')
cases = [
    ('//sin\ue004y', r'\frac{\sin}{y}'),
    ('//(x)\ue004y', r'\frac{(x)}{y}'),
    ('xsr', r'x^{2}'),
    ('sqx\ue004', r'\sqrt{x}'),
    ('//@a\ue004@b', r'\frac{\alpha}{\beta}'),
    ('par\ue004f\ue004t', r'\frac{ \partial f }{ \partial t } '),
    ('outerx', r'\ket{x} \bra{x} '),
    ('x/y\ue004', r'\frac{x}{y}'),
    ('pmata\ue004b\ue006c', r'\begin{pmatrix}a & b \\ c\end{pmatrix}'),
    ('iden2', r'\begin{pmatrix} 1 & 0 \\ 0 & 1 \end{pmatrix}'),
    ('xhat', r'\hat{x}'),
    ('RR', r'\mathbb{R}'),
]
for keys, expected in cases:
    type_keys('\ue009a\ue000\ue003')
    type_keys(keys)
    assert state()['text'] == expected, (keys, state())
print('PASS: catalog shortcuts, defaults, mirrored fields, auto-fractions, matrices in native Firefox')
type_keys('\ue009a\ue000\ue003')
type_keys('x+y')
type_keys('\ue009a\ue000')
type_keys('U')
assert state()['text'] == r'\underbrace{ x+y }_{  }', state()
print('PASS: native selection and visual shortcut')
script('window.smokeControl.dispose()')
assert state()['status']['enabled'] is False
print('PASS: disposal disables the controller')
print('LIMIT: synthetic Firefox input only; new catalog behavior still requires live Paper validation.')
