# Riva Contact Audiocodecs Integration

This demo integrates the Audiocodecs VoiceAI Gateway API with Riva. 

The most significant modification from the Riva Contact demo was removing socket.io and replacing with websockets ws.

In its current version, the application has been modified to only support ASR. Peer-to-peer functionality has also been removed.

To run locally, first edit `env.txt` so that `JARVIS_API_URL` is pointing to a running Riva instance with ASR enabled. Then

```bash
$ cd riva-contact
$ npm install
$ npm run start
```

This will launch the application at `https://localhost:8009/`

### Authors
- Sunil Kumar Jang Bahadur (sjangbahadur@nvidia.com) 
- Chris Pang (christopherp@nvidia.com)


(old documentation below)

# Jarvis Contact (old documentation below)

Jarvis Contact is a web-based demonstration app for contact center applications, combining peer-to-peer video chat with streaming automatic speech recognition (ASR) and natural language processing (NLP). It is a lightweight Node.js application, backed by robust NVIDIA Jarvis AI Services.

Please find more information about the Jarvis Contact application, and how to run it, in the [Jarvis documentation](http://docs.jarvis-ai.nvidia.com/latest/samples/callcenter.html).

## License

[End User License Agreement](https://developer.download.nvidia.com/licenses/Jarvis_Pre-Release_Evaluation_License_23Jan2020.pdf) is included with the product. Licenses are also available along with the model application zip file. By pulling and using the Jarvis SDK container, downloading models, or using the sample applications, you accept the terms and conditions of these licenses.


## Additional documentation to be merged with main Jarvis docs above

We hope this application offers a launching pad for your own development. One possibility would be to use the transcripts and tagged entities for downstream analytics and visualization. We encourage you to experiment, and would love to hear about what you build.

![jarvis-contact-architecture](doc/jarvis-contact-architecture.png "Jarvis Contact Architecture")



## Requirements

Jarvis Contact is a Node.js application, intended to run in a Linux environment. It requires Jarvis AI Services to be running with two primary models:

- Streaming ASR
- Named Entity Recognition

You are welcome to use the default Jarvis models offered in the Quick Start configuration, or you may deploy your own custom models trained using [NVIDIA NeMo](https://developer.nvidia.com/nvidia-nemo) and imported into Jarvis. Jarvis Contact comes pre-configured to use the models from Jarvis Quick Start. See the Jarvis AI Services documentation for more details.

## Installation

Installing Jarvis Contact can be done in one of two ways, either by installing from the repository or through the Jarvis Client docker container.

### Installing from the repository

First, clone the repository from Gitlab:

```
$ git clone https://gitlab-master.nvidia.com/cparisien/jarvis-contact.git
```

Install the required Node.js modules using the Node Package Manager (you might need to [install Node.js](https://nodejs.org/en/) itself if you haven't already):

```
$ cd jarvis-contact
$ npm install
```

Jarvis Contact uses environment variables to manage its configuration parameters. These are kept in the config file `env.txt`, where you will want to set the URL of your running Jarvis AI Services. You may also wish to change the application's ports, or the name of the NER model if you've deployed your own custom model in Jarvis. Any of the settings in `env.txt` may be overridden at runtime by setting local environment variables.

Depending on your server environment, you will likely also need to open two ports on the server (by default, ports 8009 and 9000). These ports are for the main entry point to the web application, and for the [PeerJS server](https://github.com/peers/peerjs-server) which helps to negotiate the peer-to-peer chat connections. You may also need to set up port forwarding for these in your router, if applicable.

### Optional UMLS concept mapping

The code base includes in-progress functionality for healthcare applications, to link named entities with concepts in the [Unified Medical Language System](https://uts.nlm.nih.gov/home.html) (UMLS), a large medical ontology. Note that this feature is in development and thus doesn't work all that well just yet.

The feature relies on two external services: a copy of UMLS, and a running instance of quickUMLS, which does a lexical similarity search. Installation requires a few extra steps that we expect to simplify before this feature is released to the wild. We are using Hoo Chang Shin's local wrap of [UMLS and tools](https://gitlab-master.nvidia.com/hshin/umls-mapper).

Pull the UMLS docker container from NGC, then run it:

```
$ docker pull nvcr.io/ea-jarvis-megatron/umls-mapper
$ docker run --ipc=host --network host -p 4645:4645 -t nvcr.io/ea-jarvis-megatron/umls-mapper
```

Install quickUMLS:

```
$ pip install quickumls
```

Now, in the Jarvis Contact config file `env.txt`, uncomment the line `CONCEPT_MAP="UMLS"`. Note that this also won't do much unless you are running an NER model that recognizes medical named entities.

You can go ahead and start the app server, as below. If this is working, then when the NER model recognizes a term like `metformin`, you can mouse over the entity in the transcript to see the linked UMLS concept(s).

![concept-mapping](doc/concept-map.png "Concept mapping with UMLS")

### Using the docker container

<TO DO, once the Jarvis Client container is ready.>

## Running the service

To start the web service, from the `jarvis-contact`  directory on your server, run:

```
$ npm run start
```

This will start the Node.js application, and will start listening for connections.

## Using the service

Load the URL in a browser (Chrome works well; Firefox has issues with some network configurations) on a computer with a webcam and microphone. For best ASR results, a headset is recommended.

For example, if you're accessing the service from a computer within the local network, and it's hosted on a machine with the IP 192.168.2.10, then the URL would be https://192.168.2.10:8009/.

If you see a security warning, it's because we have included a self-signed certificate for demo purposes. We promise we're not doing anything nefarious. You can see the certificate in `jarvis-contact/certificates`. If you like, feel free to generate your own, or buy one from a trusted signing authority. You may "accept the risk" and continue.

When asked, give the website permission to access your webcam and microphone.

Once the page is loaded, you're welcome to start the Jarvis transcription without needing to make a video call. In the box titled "Jarvis transcription," hit the Start button, then start speaking. You'll see in-progress transcripts in the text field at the bottom. As those transcripts are finalized, they'll appear, with NLP annotations, in the transcription box. To test the NLP directly (without speaking), simply type into the text field at the bottom and hit Submit.

To call someone, you'll need their ID. Yours is the 4-digit number in the Connection box. It's random, and it changes every time the page is reloaded. Enter the ID of the person you wish to call, and click "Call." They will get a notification that a call is incoming, and will be asked to accept. Once you're connected, Jarvis transcription will start automatically if it's not already running.

The transcripts for each speaker are marked with the user's ID, or their display name if it has been set in the Connection box.

To end the call, simply close or reload the window.

