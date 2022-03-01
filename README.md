# Riva Contact AudioCodes Integration

This demo integrates the AudioCodes VoiceAI Gateway API with Riva. 

The most significant modification from the Riva Contact demo was removing socket.io and replacing with websockets ws.

In its current version, the application has been modified to only support ASR. Peer-to-peer functionality has also been removed.

To run locally, first edit `env.txt` so that `RIVA_API_URL` is pointing to a running Riva instance with ASR enabled. Then

```bash
$ cd riva-contact
$ npm install
$ npm run start
```

This will launch the application at `https://localhost:8009/`

### Authors
- Sunil Kumar Jang Bahadur (sjangbahadur@nvidia.com) 
- Chris Pang (christopherp@nvidia.com)


