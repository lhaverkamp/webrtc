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

### Client

A sample client application has been included as part of the release.  The required JavaScript files can be found in `public/js/`

- `adapter-lastest.js` - used to simplify the WebRTC code by eliminating browser prefixes and parameter differences
- `rtc.js` - the WebRTC library

## Notes

The code makes use of [adapter.js](https://github.com/webrtc/adapter) so that we do not need to worry about dependencies between different browsers.  This allows us to focus on the client and server implementation and not be bogged down via slight differences in how the browsers implement the WebRTC specification.
