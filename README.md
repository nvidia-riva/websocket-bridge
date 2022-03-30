# Riva Websocket Bridge


This is a bridge/proxy server intended to be deployed alongside 
[NVIDIA Riva server](https://developer.nvidia.com/riva).

It implements a Websocket-based Speech Recognition API that is compatible with 
[AudioCodes VoiceAI Connect](https://www.audiocodes.com/solutions-products/voiceai/voiceai-connect). 


## Deployment


This software is expected to be deployed into an environment with NVIDIA Riva and AudioCodes VoiceAI Connect already configured and running.  The expected deployment architecture is 1:1 for each Riva instance configured, generally as a sidecar within a k8s cluster.  If loadbalancing is needed this is expected to be done in front of the incoming websocket connections.

Running this software in a containerized environment is expected.  Building the container is covered in the [Docker](#docker) section. 

Running this software locally is covered in [Local](#local).

For production deployments using SSL the server will need certificates as outlined [SSL Configuration](#ssl-configuration).



### Configuration
By default, the server will listen on port 8009 and proxy traffic to Riva server running at grpc://localhost:50051.
Because this is expected to be deployed in a container the grpc URI will need to be updated, since localhost inside a container will refer to the container.

This behavior can be overridden either by modifying the `env.txt` file and rebuilding the docker image (see *Build*
section below) or by setting `RIVA_API_URL` and `PORT` environment variables at deployment time. For example,
to deploy the bridge connecting to a riva server running at `riva.hostname.tld:50051` and serve on port `8888`:

```bash
docker run -d \
    -p 8888:8888 \
    -e RIVA_API_URL=riva.hostname.tld:50051 \
    -e PORT=8888 \
    websocket-bridge:latest
```                       
### SSL Configuration
The server by default uses ssl with self signed keys found in the ./certificates/ directory.  For production deployments, these should be replaced with ssl keys from your organization and called key.pem and cert.pem respectively.  When finished the certificates directory should look like the following.

``` bash
ls certificates/
cert.pem  key.pem 
```

The container should be launched as follows, adding a -v to map the local certificates directory into the container.


```bash
docker run -d \
    -p 8888:8888 \
    -e RIVA_API_URL=riva.hostname.tld:50051 \
    -e PORT=8888 \
    -v /localpath/to/keys_dir/:/opt/riva/websocket-bridge/certificates
    websocket-bridge:latest
```                       

## Build
The bridge can be built and executed both on bare-metal and with Docker.

Testing is performed with the Jest framework and can be run via: 

 ```bash
 npm test
 ```

### Docker
Docker builds are preferred, to build the docker image:
```bash
docker build -t websocket-bridge .
```


### Local
For development purposes, building and running locally may be preferred. Using node16 or later, follow standard node.js best practices:

```bash
npm install
npm run start
```

This will launch the application at `https://localhost:8009` with the default configuration. 


## Development

For development purposes there are several experimental applications to leverage. 
testing_server.js is a stand in mock server for Riva.  running it like this from top of tree:

``` bash
node ./riva_client/testing_server.js
```

This will launch a grpc server listening on  0.0.0.0:50052 and will respond to streaming ASR reqeusts.

Then run the Riva websocket bridge and set the RIVA_API_URL as follows to direct grpc traffic to the testing server.

``` bash
 RIVA_API_URL="localhost:50052"  npm start run
```

At this point the local system is capable of taking requests.  

There are two testing tools, a command line node client implementing the client side of the AudioCodes API which can be launched as follows:

``` bash
node ./modules/audiocodesClient
```

A built in web client running in the same sever as the Riva websocket bridge and can be accessed here: https://localhost:8009
This is a webapp which will request microphone access and stream audio live into the system.  

## License
This code is MIT-licensed. See LICENSE file for full details.

