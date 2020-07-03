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

import uuid

from flask import Flask, logging, request, Response, send_from_directory, session, jsonify
from flask import stream_with_context
from flask_session import Session
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from engineio.payload import Payload

from modules.asr import ASRPipe
from modules.nlp import nlp_analyze

''' Flask Initialization 
'''
app = Flask(__name__)
CORS(app)
# this key is not particularly secure, as this is a demo. If security matters to you, see the Flask docs.
app.secret_key = 'gVkYp3s6'
app.config['SESSION_TYPE'] = 'filesystem'
SESSION_TYPE = 'filesystem'
Session(app)
# log = logging.getLogger('werkzeug')
# log.setLevel(logging.ERROR)
Payload.max_decode_packets = 500  # https://github.com/miguelgrinberg/python-engineio/issues/142
socket_io = SocketIO(app, logger=False)
jarvis_sessions = {}


# Configurations for speech services in a single Jarvis session
class JarvisSession(object):
    def __init__(self, session_id):
        self.thread_asr = None
        self.id = session_id
        self.asr = ASRPipe()

    def server_asr(self):
        print('Starting speech server')
        self.asr.main_asr()

    def start_asr(self):
        self.thread_asr = socket_io.start_background_task(self.server_asr)

    def send_msg(self, msg_type, data):
        # print("send_msg")
        # socket_io.emit(msg_type, json.loads(data))
        pass

    def wait(self):
        self.thread_asr.join()


def create_session():
    if 'uid' not in session:
        session['uid'] = uuid.uuid4()
    if session['uid'] not in jarvis_sessions:
        jarvis_sessions[session['uid']] = JarvisSession(session['uid'])
        jarvis_sessions[session['uid']].start_asr()


@app.route('/')
def get_static():
    return send_from_directory("../web/", "index.html")


@app.route('/<file>', defaults={'path': ''})
@app.route('/<path:path>/<file>')
def get_static2(path, file):
    return send_from_directory("../web/" + path, file)


# Stream transcripts (ASR results) back to the client as they're generated
@app.route('/transcript_stream')
def transcript_stream():
    @stream_with_context
    def generate():
        if 'uid' in session and session['uid'] in jarvis_sessions:
            print('ASR results stream working')
            for t in jarvis_sessions[session['uid']].asr.get_transcript():
                print(f'Transcript out: {t}')
                yield t
        params = {'response': "Audio Works"}
        return params

    return Response(generate(), mimetype="text/event-stream")


@app.route("/request", methods=['POST'])
def nlp_request():
    try:
        text = request.json['text']
        session_id = request.json['session']
        payload = request.json['payload']
    except KeyError:
        return jsonify(ok=False, message="Missing parameters.")

    # create id for session if it does't exist
    create_session()

    session_id = session['uid']

    response = {'response': '', 'input': text, 'annotations': {}}

    # TODO: figure out the actual exceptions that could be raised here. No more general except clauses!
    request_data = nlp_analyze(text)
    response.update(request_data)
    print('--- NLP request response ---')
    print(request_data)

    return jsonify(messages=response['response'],
                   session=session_id, input=response['input'], annotations=response['annotations'])
    # except:  # Error in execution
    #     print("Unexpected error:", sys.exc_info()[0])
    #     return jsonify(ok=False, message="Error during execution.")


@socket_io.on('audio_in', namespace='/')
def receive_remote_audio(data):
    if 'uid' in session and session['uid'] in jarvis_sessions:
        jarvis_sessions[session['uid']].asr.fill_buffer(data)


# TODO: not sure this is the right way to handle errors. Certainly it's way too general
@socket_io.on_error()
def error_handler(e):
    print(f'Unexpected error: {e}')
    pass
