# InGrid

InGrid is a browser-based photo grid maker. Add photos, split and resize cells, adjust image framing, and export the finished grid as a PNG.

The editor uses the published [`@jnpll/elements-ui` 0.5.0](https://github.com/jnpll/elements-ui/pkgs/npm/elements-ui) component library for its controls and theme. It starts with Alpha / `000`; use the palette icon beside the InGrid name to switch themes and palettes. The selection is saved locally and shared across tabs.

## Development

```bash
npm install
npm run dev
```

GitHub Packages requires a personal access token (classic) with `read:packages` before `npm install`. The repository's `.npmrc` routes the `@jnpll` scope and reads `NODE_AUTH_TOKEN` for authentication. Set that variable in your local environment or CI, including the Vercel Production build environment, and grant the token access to the Elements UI package.

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm run lint
npm run build
```
