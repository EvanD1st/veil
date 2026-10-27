"""Finite private lightwalletd trial. Never forwards a transaction broadcast.

systemd supplies the existing node cookie through LoadCredential; neither wallet
keys nor scanner credentials are available to this service. No request logging.
"""
import base64
import hmac
import http.server
import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import threading
import time
import urllib.request

READ_METHODS = frozenset({
    'getinfo', 'getblockchaininfo', 'getbestblockhash', 'getblock',
    'getrawtransaction', 'getrawmempool', 'z_gettreestate',
    'z_getsubtreesbyindex', 'getaddresstxids', 'getaddressbalance',
    'getaddressutxos', 'getblockheader',
})

def validate_request(data):
    if not isinstance(data, dict) or data.get('method') not in READ_METHODS:
        raise ValueError('read-only method required')
    if not isinstance(data.get('params', []), list) or len(data.get('params', [])) > 8:
        raise ValueError('bounded positional parameters required')
    if data.get('jsonrpc', '1.0') not in ('1.0', '2.0'):
        raise ValueError('invalid protocol')
    return {'jsonrpc': '2.0', 'id': 1, 'method': data['method'], 'params': data.get('params', [])}

class Server(http.server.ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 4
    def __init__(self, address, handler):
        self.slots = threading.BoundedSemaphore(4)
        super().__init__(address, handler)
    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            request.close()
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.slots.release()
            raise
    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()
    def handle_error(self, *args):
        pass  # Never print request bodies or credentials in tracebacks.

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def setup(self):
        super().setup()
        self.connection.settimeout(15)
    def send_json(self, code, obj):
        body=json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_POST(self):
        if self.path!='/' or not hmac.compare_digest(self.headers.get('Authorization',''), self.server.local_auth):
            self.send_json(401, {'error':'unauthorized'})
            return
        try:
            if self.headers.get('Transfer-Encoding'):
                raise ValueError()
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=16384:
                raise ValueError()
            data=json.loads(self.rfile.read(length))
            validated=validate_request(data)
        except (ValueError, TypeError):
            self.send_json(403, {'id':None,'result':None,'error':{'code':-32601,'message':'Read-only trial: request rejected'}})
            return
        try:
            req=urllib.request.Request('http://127.0.0.1:18232',data=json.dumps(validated).encode(),
                headers={'Content-Type':'application/json','Authorization':self.server.node_auth})
            with urllib.request.urlopen(req,timeout=12) as response:
                raw=response.read(8*1024*1024+1)
            if len(raw)>8*1024*1024:
                raise ValueError()
            obj=json.loads(raw)
            # Do not leak node diagnostic strings or arbitrary fields to the trial.
            result={'id':data.get('id'),'result':obj.get('result'), 'error':None}
            if obj.get('error'):
                result['error']={'code':obj['error'].get('code',-32603),'message':'Node read unavailable'}
            self.send_json(200,result)
        except Exception:
            self.send_json(503,{'id':data.get('id'),'result':None,'error':{'code':-32603,'message':'Node read unavailable'}})

def main():
    os.umask(0o077)
    root=Path('/run/veil-lightwallet-trial')
    cookie=(Path(os.environ['CREDENTIALS_DIRECTORY'])/'node-cookie').read_bytes().strip()
    if b':' not in cookie or b'\n' in cookie:
        raise ValueError('invalid credential')
    password=secrets.token_hex(32)
    conf=root/'rpc.conf'
    conf.write_text('rpcbind=127.0.0.1\nrpcport=19068\nrpcuser=veil-trial\nrpcpassword='+password+'\n')
    conf.chmod(0o600)
    server=Server(('127.0.0.1',19068),Handler)
    server.node_auth='Basic '+base64.b64encode(cookie).decode()
    server.local_auth='Basic '+base64.b64encode(('veil-trial:'+password).encode()).decode()
    threading.Thread(target=server.serve_forever,daemon=True).start()
    stopped=threading.Event()
    signal.signal(signal.SIGTERM, lambda *_:stopped.set())
    signal.signal(signal.SIGINT, lambda *_:stopped.set())
    command=['/opt/veil-zingolib-trial/current/lightwalletd','--grpc-bind-addr','127.0.0.1:19067',
        '--http-bind-addr','127.0.0.1:19069','--no-tls-very-insecure','--nocache',
        '--zcash-conf-path',str(conf),'--data-dir',str(root/'data'),
        '--log-file','/dev/null','--log-level','3']
    # Plaintext gRPC exists only on loopback; no public listener or credential in argv.
    child=subprocess.Popen(command,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    print('Read-only TESTNET bridge trial started; broadcast RPC is denied.',flush=True)
    try:
        while not stopped.wait(1):
            if child.poll() is not None:
                raise RuntimeError('bridge exited; no retry')
    finally:
        if child.poll() is None:
            child.terminate()
            try:child.wait(timeout=15)
            except subprocess.TimeoutExpired:child.kill();child.wait()
        server.shutdown();server.server_close()
        conf.unlink(missing_ok=True)

if __name__=='__main__':
    try:main()
    except Exception:
        print('Read-only bridge failed; no automatic retry or secret diagnostics.',flush=True)
        raise SystemExit(1)
