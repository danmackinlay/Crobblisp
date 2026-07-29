#!/usr/bin/env python3
"""
Static dev server for Crobble.

Exists for one reason: `python3 -m http.server` sends no Cache-Control, so
browsers apply HEURISTIC caching from Last-Modified and will happily serve a
stale ES module without revalidating. Editing a model file and reloading then
shows you the OLD code — and because the modules import each other by relative
path, a cache-busting query on one of them does not reach the rest. That failure
is silent and looks exactly like a bug in the model.
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def log_message(self, fmt, *args):
        if not (args and len(args) > 1 and str(args[1]).startswith('200')):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = partial(NoCacheHandler, directory='.')
    print(f'crobble on http://localhost:{port}  (no-store)', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), handler).serve_forever()
