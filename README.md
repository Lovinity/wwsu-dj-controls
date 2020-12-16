# WWSU DJ Controls v9
This application is the frontend GUI for connecting to WWSU Radio's server (Lovinity/wwsu) and managing many aspects of the radio station.

**Version 9 is still in ALPHA. Many things do not work yet**.

## Not for public use
This application is only meant for use within WWSU Radio (but the code is available publicly for anyone who wishes to build something similar for their radio station). This application is used in conjunction with the server in the "wwsu" repository.

## Security
This application uses a custom implementation of node-machine-id to generate a "host ID" based on your device. This ID is transmitted to WWSU on connection. If your host ID is not authorized to connect to WWSU, DJ Controls will show an error and prevent use. Please contact WWSU Radio (and provide the last 6 characters of your Host ID) if you are a member or contractor and need access.

**NEVER** share your full host ID with anyone publicly; treat it like a password.
