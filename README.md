# WWSU DJ Controls v8
This application is the frontend GUI for connecting to WWSU Radio.

**Version 8 is still in ALPHA. Many things do not work yet**.

## Not for public use
This application is only meant for use within WWSU Radio (but the code is available publicly for anyone who wishes to build something similar for their radio station). This application is used in conjunction with the server in the "wwsu" repository.

## Security
This application uses a custom implementation of node-machine-id to generate a "host ID" based on your device. This ID is transmitted to WWSU on connection. If your host ID is not authorized to connect to WWSU, DJ Controls will show an error and prevent use. Please contact WWSU Radio (and provide at least the last 6 characters of your Host ID) if you are a member or contractor and need access.
