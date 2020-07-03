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
import sys
import grpc
import modules.client.src.jarvis_proto.audio_pb2 as ja
import modules.client.src.jarvis_proto.jarvis_asr_pb2 as jasr
import modules.client.src.jarvis_proto.jarvis_asr_pb2_grpc as jasr_srv
from six.moves import queue
from config import jarvis_config

# Audio recording parameters
DEFAULT_RATE = 16000


class ASRPipe(object):
    """Opens a recording stream as a generator yielding the audio chunks."""
    def __init__(self):

        # Create a thread-safe buffer of audio data
        self._buff = queue.Queue()
        self._transcript = queue.Queue()
        self.closed = True

    def fill_buffer(self, in_data):
        """Continuously collect data from the audio stream, into the buffer."""
        self._buff.put(in_data)

    def get_transcript(self):
        while True:  # not self.closed:
            # Use a blocking get() to ensure there's at least one chunk of
            # data, and stop iteration if the chunk is None, indicating the
            # end of the audio stream.
            trans = self._transcript.get()
            if trans is None:
                return
            yield trans

    def generator(self):
        while True:
            # Use a blocking get() to ensure there's at least one chunk of
            # data, and stop iteration if the chunk is None, indicating the
            # end of the audio stream.
            chunk = self._buff.get()
            if chunk is None:
                return
            data = [chunk]

            # Now consume whatever other data's still buffered.
            while True:
                try:
                    chunk = self._buff.get(block=False)
                    if chunk is None:
                        return
                    data.append(chunk)
                except queue.Empty:
                    break

            yield b''.join(data)

    def listen_print_loop(self, responses):
        """Iterates through server responses and prints them.

        The responses passed is a generator that will block until a response
        is provided by the server.

        Each response may contain multiple results, and each result may contain
        multiple alternatives; for details, see https://goo.gl/tjCPAU.  Here we
        print only the transcription for the top alternative of the top result.

        In this case, responses are provided for interim results as well. If the
        response is an interim one, print a line feed at the end of it, to allow
        the next result to overwrite it, until the response is a final one. For the
        final one, print a newline to preserve the finalized transcription.
        """
        num_chars_printed = 0
        for response in responses:
            if not response.results:
                continue

            # The `results` list is consecutive. For streaming, we only care about
            # the first result being considered, since once it's `is_final`, it
            # moves on to considering the next utterance.
            result = response.results[0]
            if not result.alternatives:
                continue

            # Display the transcription of the top alternative.
            transcript = result.alternatives[0].transcript

            # Display interim results, but with a carriage return at the end of the
            # line, so subsequent lines will overwrite them.
            #
            # If the previous result was longer than this one, we need to print
            # some extra spaces to overwrite the previous result
            overwrite_chars = ' ' * (num_chars_printed - len(transcript))

            if not result.is_final:
                sys.stdout.write(transcript + overwrite_chars + '\r')
                sys.stdout.flush()
                interm_trans = transcript + overwrite_chars + '\r'
                interm_str = f'event:{"intermediate-transcript"}\ndata: {interm_trans}\n\n'
                self._transcript.put(interm_str)
            else:
                print(transcript + overwrite_chars)
                final_transcript = transcript + overwrite_chars
                final_str = f'event:{"finished-speaking"}\ndata: {final_transcript}\n\n'
                self._transcript.put(final_str)
            num_chars_printed = 0

    def main_asr(self, sample_rate=DEFAULT_RATE):
        language_code = 'en-US'  # a BCP-47 language tag

        channel = grpc.insecure_channel(jarvis_config["JARVIS_API_URL"])
        client = jasr_srv.JarvisASRStub(channel)

        config = jasr.RecognitionConfig(
            encoding=ja.AudioEncoding.LINEAR_PCM,
            sample_rate_hertz=sample_rate,
            language_code=language_code,
            max_alternatives=1,
            enable_automatic_punctuation=True
        )
        streaming_config = jasr.StreamingRecognitionConfig(
            config=config,
            interim_results=True)

        print(">>> Start <<<")
        audio_generator = self.generator()
        requests = (jasr.StreamingRecognizeRequest(audio_content=content)
                    for content in audio_generator)

        def build_generator(cfg, gen):
            yield jasr.StreamingRecognizeRequest(streaming_config=cfg)
            for x in gen:
                yield x

            yield cfg

        responses = client.StreamingRecognize(build_generator(streaming_config, requests))
        # Now, put the transcription responses to use.
        self.listen_print_loop(responses)
