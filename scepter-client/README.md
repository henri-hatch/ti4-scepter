# Scepter Client

The frontend client for Scepter. This document details any design choices or definites that should exist within the application.

## Project Structure

```
├── dist                     # Auto generated build directory
├── eslint.config.js         # Linter config
├── index.html
├── package.json
├── package-lock.json
├── public
│   └── scepter-icon.png     # Main logo
├── README.md                # This file! Details design choices and user experience
├── src                      # Main source directory
│   ├── App.tsx              # Front end entry point and router
│   ├── assets               # All front end assets
│   ├── components           # Client pages to route to
│   ├── contexts             # Primarily used for websocket context
│   ├── index.css
│   ├── main.tsx
│   ├── styles               # All CSS goes here
│   └── vite-env.d.ts
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## User Experience (UX)
- Nice big buttons for a good desktop and mobile experience
- Should be able to accomodate mobile devices as they are the main ingester of the client

## User Interface (UI)
- Space themed (note background). Navy blues, greys, and yellows.