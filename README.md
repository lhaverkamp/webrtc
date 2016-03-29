# webrtc
The goal of this project is to have an implementation of WebRTC that pushes as much work to the client as possible.  The server is simply responsible for connecting different clients together.

## Requirements

- coturn
- NodeJS
-- webrtc-adapter

## Installation

```bash
git clone https://github.com/lhaverkamp/webrtc
npm install
```

## Usage

### Server
```bash
npm start
```

The server is both a signalling server and an HTTP/HTTPS server.  It serves up the raw HTML for the application and also provides a simplified signal implementation.  The only logic contained in the server is keeping track of which clients are associated with which room.  A later enhancement may also limit the number of clients allowed in the room.  For the most part, it simply passes the appropriate message to the corresponding peer.

### Client

A sample client application has been included as part of the release.  The required JavaScript files can be found in `public/js/`

- `adapter-lastest.js` - used to simplify the WebRTC code by eliminating browser prefixes and parameter differences
- `rtc.js` - the WebRTC library

Once an initial connection is established all communications occur via RTCPeerConnection or an RTCDataChannel.  The client will automatially reconnect with the signalling server in the event that it becomes disconnected.

## Notes

The code makes use of [adapter.js](https://github.com/webrtc/adapter) so that we do not need to worry about dependencies between different browsers.  This allows us to focus on the client and server implementation and not be bogged down via slight differences in how the browsers implement the WebRTC specification.  This allows us to use the latest version of the WebRTC API calls and the adapter class will shim in a Promise for those browser that do not yet support the latest specification.
