#!/usr/bin/env python2

import BaseHTTPServer
import requests
import os
import sys
import urlparse
import posixpath
import json

class GaiaServerRequestHandler(BaseHTTPServer.BaseHTTPRequestHandler):
    """
    HTTP proxy to the Gaia hub
    * sends all POSTs to the upstream Gaia hub
    * reads out of the Gaia hub's storage directory on GET
    """
    def do_GET(self):
        """
        Handles GET /${url_prefix_path}/XXX
        """
        if not self.path.startswith(self.server.url_prefix_path):
            print "Invalid request path '{}'".format(self.path)
            self.send_response(401, 'Invalid request path')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            return 

        path = posixpath.normpath(self.path).strip('/')
        path = path[len(self.server.url_prefix_path)-1:]

        file_path = os.path.join(self.server.storage_root, path.strip('/'))
        if not os.path.exists(file_path):
            print "No such file or directory: '{}'".format(file_path)
            self.send_response(404, 'No such file or directory')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            return 

        sb = os.stat(file_path)
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/octet-stream')
        self.send_header('Content-Length', '{}'.format(sb.st_size))
        self.end_headers()

        with open(file_path, 'r') as f:
            while True:
                buf = f.read(65536)
                if len(buf) == 0:
                    break

                self.wfile.write(buf)

        return


    def do_OPTONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        return


class GaiaServer(BaseHTTPServer.HTTPServer):
    def __init__(self, storage_root, port, url_prefix):
        BaseHTTPServer.HTTPServer.__init__(self, ('127.0.0.1', port), GaiaServerRequestHandler)
        self.storage_root = storage_root
        self.done = False
        self.url_prefix_path = '/' + urlparse.urlparse(url_prefix).path.strip('/') + '/'


if __name__ == "__main__":
    try:
        gaia_conf_path = sys.argv[1]
    except:
        print 'Usage: {} /path/to/gaia.conf [/path/to/storage/dir]'.format(sys.argv[0])
        sys.exit(1)

    storage_root = None

    write_server = None
    write_port = None
    write_scheme = None

    with open(gaia_conf_path) as f:
        gaia_conf_txt = f.read().strip()
        gaia_conf = json.loads(gaia_conf_txt)

        write_server = gaia_conf['servername']
        write_port = gaia_conf['port']
    
    # assume https by default 
    if write_server in ['localhost', '127.0.0.1', '::1']:
        write_scheme = 'http'
    else:
        write_scheme = 'https'

    gaia_write = '{}://{}:{}'.format(write_scheme, write_server, write_port)

    res = requests.get(gaia_write + '/hub_info')
    resp = res.json()
    read_url_prefix = resp['read_url_prefix']

    port = urlparse.urlparse(read_url_prefix).port
    if port is None:
        if write_scheme == 'http':
            port = 80
        else:
            port = 443

    if len(sys.argv) > 2:
        storage_root = os.path.realpath(sys.argv[3])
    else:
        # if using a disk driver in the gaia.conf file, then use it
        if gaia_conf['driver'] == 'disk':
            storage_root = gaia_conf['diskSettings']['storageRootDirectory']
        else:
            storage_root = os.getcwd()

    print 'Serve {} from {} on port {}'.format(read_url_prefix, storage_root, port)

    srv = GaiaServer(storage_root, port, read_url_prefix)
    srv.serve_forever()
    
