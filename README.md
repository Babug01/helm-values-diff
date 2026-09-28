# Helm Values Diff

**Live demo:** https://helm-values-diff.vercel.app (Vercel) · [GitHub Pages mirror](https://babug01.github.io/helm-values-diff/)

Paste a base `values.yaml` and a compare `values.yaml`, and get a flat, dot-notation list of what
was added, removed, or changed between them — instead of eyeballing two long YAML files side by
side or fighting `diff -u` over reordered keys. Runs entirely in the browser; nothing you paste
ever leaves your machine.

## Features

- **Recursive deep diff** of two parsed YAML documents into a flat list of dot-notation paths,
  each marked `added`, `removed`, or `changed` (with old → new shown for changes)
- **Arrays diffed by index** with an explicit note in the UI: reordering a list shows as a full
  replacement of the shifted entries, not smart move-detection — worth knowing before you assume
  a big diff means a big actual change
- **Only-differences toggle** vs a **full merged tree view** that shows the whole structure with
  additions/removals/changes highlighted in place
- Summary counts for added / removed / changed at a glance

## Why I built this

Comparing environment overrides (`values-dev.yaml` vs `values-prod.yaml`) or a chart bump's default
values by hand is error-prone once the file gets past a couple hundred lines. This is also one
piece of a larger internal DevOps tool I built at work consolidating the utility pages a platform
engineer reaches for daily into one place — this repo is the values-diff piece, cleaned up and
open-sourced on its own.

## Tech Stack

- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [`js-yaml`](https://github.com/nodeca/js-yaml) for parsing both documents

## Running locally

```bash
git clone https://github.com/Babug01/helm-values-diff.git
cd helm-values-diff
npm install
npm run dev
```

## License

MIT — see [LICENSE](LICENSE).
