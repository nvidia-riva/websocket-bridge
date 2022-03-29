# Riva Websocket Bridge


This is a bridge/proxy server intended to be deployed alongside 
[NVIDIA Riva server](https://developer.nvidia.com/riva).

It implements a Websocket-based Speech Recognition API that is compatible with 
[AudioCodes VoiceAI Connect](https://www.audiocodes.com/solutions-products/voiceai/voiceai-connect). 


## Deployment

This software is expected to be deployed into an environment with NVIDIA Riva and AudioCodes VoiceAI Connect already configured and running.  

Running this software in a containerized environment is the recommended deployment methodology and is covered in the [Docker](#docker) section. 

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


## License
This code is MIT-licensed. See LICENSE file for full details.

