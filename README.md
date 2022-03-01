# Riva Websocket Bridge

This is a bridge/proxy server intended to be deployed as a sidecar service alongside Riva server.
It implements a Websocket-based Speech Recognition API that is compatible with 
[AudioCodes VoiceAI Connect](https://www.audiocodes.com/solutions-products/voiceai/voiceai-connect). 

## Deployment
Running this bridge in a containerized environment is the recommended deployment methodology. 

### Configuration
By default, the bridge will listen on port 8009 and proxy traffic to Riva server running at grpc://localhost:50051.
This behavior can be overridden either by modifying the `env.txt` file and rebuilding the docker image (see *Build*
section below) or by setting `RIVA_API_URL` and `BRIDGE_PORT` environment variables at deployment time. For example,
to deploy the bridge connecting to a riva server running at `localhost:1234` and serve on port `8888`:

```bash
docker run -d \
    -p 8888:8888 \
    -e RIVA_API_URL=localhost:1234 \
    -e BRIDGE_PORT=8888 \
    nvcr.io/nvidia/riva/websocket-bridge:latest
```

## Build
The bridge can be built and executed both on bare-metal and with Docker. Docker is preferred.

### Docker
Docker builds are preferred and most reliable. To build the docker image, simply run
```bash
docker build -t riva-websocket .
```

### Local
For development purposes, building and running locally may be preferred. Using node16 or later, follow standard node.js best practices:

```bash
$ npm install
$ npm run start
```

This will launch the application at `https://localhost:8009` with the default configuration.


## License
This code is MIT-licensed. See LICENSE file for full details.

