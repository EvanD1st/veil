import importlib.util
from pathlib import Path
import unittest
import http.client
import io
import json
import threading
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('bridge',Path(__file__).parents[1]/'scanner/zingolib/read_only_bridge.py')
bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)

class ReadOnlyBoundary(unittest.TestCase):
    def test_read_requests_keep_only_supported_fields(self):
        self.assertEqual(bridge.validate_request({'id':'untrusted','method':'getblock','params':['4546481',0],'extra':'discarded'}),
            {'jsonrpc':'2.0','id':1,'method':'getblock','params':['4546481',0]})
    def test_mutation_and_batch_requests_are_denied(self):
        for value in [{'method':m,'params':[]} for m in ['sendrawtransaction','z_sendmany','stop','submitblock','sendtoaddress','z_importkey']]+[[{'method':'getinfo'}],None,{}]:
            with self.subTest(value=value),self.assertRaises(ValueError):bridge.validate_request(value)
    def test_malformed_parameters_and_protocol_are_denied(self):
        for value in [{'method':'getinfo','params':{}},{'method':'getinfo','params':[0]*9},{'method':'getinfo','jsonrpc':'3.0'}]:
            with self.assertRaises(ValueError):bridge.validate_request(value)

class HttpBoundary(unittest.TestCase):
    def setUp(self):
        self.server=bridge.Server(('127.0.0.1',0),bridge.Handler)
        self.server.local_auth='Basic synthetic-local-test'
        self.server.node_auth='Basic synthetic-node-test'
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True)
        self.thread.start()
    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join()
    def request(self,body,auth=True,extra=None):
        conn=http.client.HTTPConnection(*self.server.server_address,timeout=3)
        headers={'Content-Type':'application/json'}
        if auth:headers['Authorization']=self.server.local_auth
        headers.update(extra or {})
        conn.request('POST','/',body,headers)
        response=conn.getresponse();result=(response.status,json.loads(response.read()))
        conn.close();return result
    def test_unauthorized_and_write_requests_never_reach_node(self):
        with patch.object(bridge.urllib.request,'urlopen') as upstream:
            self.assertEqual(self.request(b'{"method":"getinfo"}',auth=False)[0],401)
            for method in ['sendrawtransaction','z_sendmany','stop','submitblock']:
                self.assertEqual(self.request(json.dumps({'method':method,'params':[]}))[0],403)
            upstream.assert_not_called()
    def test_invalid_and_oversized_payloads_never_reach_node(self):
        with patch.object(bridge.urllib.request,'urlopen') as upstream:
            for body in [b'not-json',b'[]',b'x'*16385,b'{"method":"getinfo","params":{}}']:
                self.assertEqual(self.request(body)[0],403)
            upstream.assert_not_called()
    def test_read_forwarding_uses_node_auth_and_strips_extra_fields(self):
        with patch.object(bridge.urllib.request,'urlopen',return_value=io.BytesIO(b'{"result":{"height":42},"error":null}')) as upstream:
            status,body=self.request(b'{"id":7,"method":"getinfo","extra":"discard"}')
            self.assertEqual((status,body),(200,{'id':7,'result':{'height':42},'error':None}))
            req=upstream.call_args.args[0]
            self.assertEqual(req.full_url,'http://127.0.0.1:18232')
            self.assertEqual(req.get_header('Authorization'),self.server.node_auth)
            self.assertEqual(json.loads(req.data),{'jsonrpc':'2.0','id':1,'method':'getinfo','params':[]})
    def test_upstream_failures_do_not_expose_diagnostics(self):
        with patch.object(bridge.urllib.request,'urlopen',side_effect=RuntimeError('synthetic-private-diagnostic')):
            status,body=self.request(b'{"method":"getinfo"}')
            self.assertEqual(status,503)
            self.assertNotIn('synthetic-private-diagnostic',json.dumps(body))
        with patch.object(bridge.urllib.request,'urlopen',return_value=io.BytesIO(b'{"result":null,"error":{"code":-1,"message":"synthetic-private-diagnostic"}}')):
            status,body=self.request(b'{"method":"getinfo"}')
            self.assertEqual(status,200)
            self.assertEqual(body['error'],{'code':-1,'message':'Node read unavailable'})
    def test_filtered_health_is_authenticated_and_contains_no_credentials_or_parameters(self):
        with patch.object(bridge.urllib.request,'urlopen',return_value=io.BytesIO(b'{"result":null,"error":{"code":-8,"message":"synthetic-private-diagnostic"}}')):
            self.request(b'{"method":"getblock","params":["synthetic-private-selector"]}')
        for authorized in [False,True]:
            conn=http.client.HTTPConnection(*self.server.server_address,timeout=3)
            conn.request('GET','/health',headers={'Authorization':self.server.local_auth} if authorized else {})
            r=conn.getresponse();raw=r.read().decode();conn.close()
            self.assertEqual(r.status,200 if authorized else 401)
            for private in ['synthetic-private-selector','synthetic-private-diagnostic',self.server.local_auth,self.server.node_auth]:self.assertNotIn(private,raw)
            if authorized:self.assertEqual(json.loads(raw)['methods']['getblock'],{'requests':1,'failures':1,'lastErrorCode':-8})

if __name__=='__main__':unittest.main()
