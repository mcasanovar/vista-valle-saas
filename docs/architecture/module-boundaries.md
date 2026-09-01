# Module boundaries

`app/` is the Next.js adapter layer: pages, layouts, route handlers, and server-action entry points. Product behavior belongs in `src/features/`.

## Features

Each capability owns its implementation under `src/features/<capability>/`. Other capabilities and `app/` consume only its public barrel:

```ts
import {} from "@/features/rooms";
```

This is prohibited outside `rooms` itself:

```ts
import {} from "@/features/rooms/internal";
```

## Shared presentation

`src/presentation/` is visual-only. It receives data and callbacks through props and cannot import features, `app/`, persistence, providers, or infrastructure.

Atomic Design dependency direction is:

```text
atoms → molecules → organisms → templates → app pages
```

A higher layer may consume a lower layer:

```ts
import {} from "@/presentation/atoms";
```

An atom cannot consume a molecule, organism, or template. ESLint enforces both the feature public API and presentation boundaries.
