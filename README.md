# Custom Elements

Custom elements for Kontent.ai that power content authoring in the DTCX project, built with React + TypeScript and Vite.

## Install

```sh
npm install
```

## Development

```sh
npm run dev
```

Then open `https://localhost:5173/custom-elements`.

## Build

```sh
npm run build
```

## Routes

- `/custom-elements/icon-picker` → [`IconPicker`](src/custom-elements/IconPicker/IconPicker.tsx)

## Base Path

The app is hosted under the `/custom-elements` base path (see [vite.config.ts](vite.config.ts)).

## Router Basename

The router basename is set accordingly in [`src/main.tsx`](src/main.tsx).

## Route Mapping

The route mapping is defined in [`src/App.tsx`](src/App.tsx).

## HTTPS (basicSsl)

The dev server uses `basicSsl` to enable HTTPS on localhost, which allows testing custom elements inside Kontent.ai during development.

## Scripts

See [package.json](package.json) for the full list of npm scripts.

## Project Structure

- Custom element context/provider: [`CustomElementContext`](src/context/CustomElementContext.tsx)
- Helper utilities: [src/helpers](src/helpers/index.ts)
- Custom elements: [src/custom-elements](src/custom-elements/index.ts)
