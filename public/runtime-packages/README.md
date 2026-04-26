# Runtime Packages

- `nodejs-termux-aarch64.zip` is tracked in the repository as a bundled runtime asset.
- `python-termux-aarch64-scientific.zip` is intentionally treated as a generated release artifact instead of a regular Git-tracked binary.

To generate the bundled Python runtime asset locally before Android packaging:

```bash
npm run runtime:package:python -- --output-dir public/runtime-packages
```

The Android sync/build flow will fail fast if the required bundled runtime assets are missing.
