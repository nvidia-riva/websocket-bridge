# ==============================================================================
# Copyright 2020 NVIDIA Corporation. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ==============================================================================

import os
import sys
jarvis_dir = os.getcwd() + "/modules/client"
sys.path.append(jarvis_dir)

from server.server import *
from config import jarvis_config

if __name__ == '__main__':
    port = jarvis_config["port"]
    host = "0.0.0.0"
    certfile = 'certificates/cert.pem'
    keyfile = 'certificates/key.pem'
    ssl_context = (certfile, keyfile)
    print("Server starting at : https://", host, ":", port)
    socket_io.run(app, host=host, port=port, debug=False, use_reloader=False, ssl_context=ssl_context)

