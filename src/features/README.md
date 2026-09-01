# Feature modules

Each directory is a business capability. Its `index.ts` is the only public entry point for consumers outside that capability.

Keep application behavior inside the relevant feature; do not import a sibling feature's internal files.
