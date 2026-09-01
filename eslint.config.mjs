import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import path from "node:path";

const presentationLayers = ["atoms", "molecules", "organisms", "templates"];

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function sourceValue(node) {
  return typeof node.source?.value === "string" ? node.source.value : null;
}

function resolveImportPath(filename, source) {
  if (source.startsWith("@/")) {
    return normalizePath(path.resolve(process.cwd(), "src", source.slice(2)));
  }

  if (source.startsWith(".")) {
    return normalizePath(path.resolve(path.dirname(filename), source));
  }

  return null;
}

function featureFromPath(value) {
  return (
    normalizePath(value).match(/\/src\/features\/([^/]+)(?:\/|$)/)?.[1] ?? null
  );
}

function presentationLayerFromPath(value) {
  return (
    normalizePath(value).match(
      /\/src\/presentation\/(atoms|molecules|organisms|templates)(?:\/|$)/
    )?.[1] ?? null
  );
}

function visitorForImports(checkSource) {
  return {
    ImportDeclaration(node) {
      checkSource(node, sourceValue(node));
    },
    ExportAllDeclaration(node) {
      checkSource(node, sourceValue(node));
    },
    ExportNamedDeclaration(node) {
      checkSource(node, sourceValue(node));
    },
    ImportExpression(node) {
      checkSource(node, sourceValue(node));
    },
  };
}

const architecturePlugin = {
  rules: {
    "feature-public-api": {
      meta: {
        docs: {
          description:
            "Require external feature consumers to use each feature public barrel.",
        },
        messages: {
          deepFeatureImport:
            "External consumers must import from '@/features/{{feature}}', not an internal feature path.",
        },
        schema: [],
        type: "problem",
      },
      create(context) {
        const filename = normalizePath(context.filename);
        const callerFeature = featureFromPath(filename);

        return visitorForImports((node, source) => {
          if (!source) {
            return;
          }

          const targetPath = resolveImportPath(filename, source);
          const targetFeature = targetPath ? featureFromPath(targetPath) : null;
          const isAliasDeepImport = /^@\/features\/([^/]+)\/.+/.test(source);
          const isRelativeDeepImport =
            targetFeature !== null &&
            normalizePath(targetPath).includes(
              `/src/features/${targetFeature}/`
            );

          if (
            targetFeature &&
            callerFeature !== targetFeature &&
            (isAliasDeepImport || isRelativeDeepImport)
          ) {
            context.report({
              data: { feature: targetFeature },
              messageId: "deepFeatureImport",
              node,
            });
          }
        });
      },
    },
    "presentation-boundaries": {
      meta: {
        docs: {
          description:
            "Protect shared presentation from application, feature, persistence, and provider imports.",
        },
        messages: {
          forbiddenPresentationDependency:
            "Shared presentation cannot import '{{source}}'. Pass data and callbacks through props instead.",
        },
        schema: [],
        type: "problem",
      },
      create(context) {
        const filename = normalizePath(context.filename);

        return visitorForImports((node, source) => {
          if (!source || !presentationLayerFromPath(filename)) {
            return;
          }

          const targetPath = resolveImportPath(filename, source);
          const forbiddenAlias =
            /^(?:@\/(?:features|app|config\/server|persistence|providers|infrastructure)(?:\/|$)|@\/lib\/(?:persistence|providers)(?:\/|$))/.test(
              source
            );
          const forbiddenPath = targetPath
            ? /\/(?:src\/(?:features|config\/server|persistence|providers|infrastructure)|app)(?:\/|$)/.test(
                targetPath
              )
            : false;

          if (forbiddenAlias || forbiddenPath) {
            context.report({
              data: { source },
              messageId: "forbiddenPresentationDependency",
              node,
            });
          }
        });
      },
    },
    "atomic-direction": {
      meta: {
        docs: {
          description:
            "Allow Atomic Design imports only from a higher layer to a lower layer.",
        },
        messages: {
          invalidAtomicDirection:
            "{{from}} cannot import {{to}}. Atomic dependencies flow atoms → molecules → organisms → templates.",
        },
        schema: [],
        type: "problem",
      },
      create(context) {
        const filename = normalizePath(context.filename);
        const callerLayer = presentationLayerFromPath(filename);

        return visitorForImports((node, source) => {
          if (!source || !callerLayer) {
            return;
          }

          const targetPath = resolveImportPath(filename, source);
          const targetLayer = targetPath
            ? presentationLayerFromPath(targetPath)
            : null;

          if (
            targetLayer &&
            presentationLayers.indexOf(targetLayer) >
              presentationLayers.indexOf(callerLayer)
          ) {
            context.report({
              data: { from: callerLayer, to: targetLayer },
              messageId: "invalidAtomicDirection",
              node,
            });
          }
        });
      },
    },
  },
};

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      architecture: architecturePlugin,
    },
    rules: {
      "architecture/atomic-direction": "error",
      "architecture/feature-public-api": "error",
      "architecture/presentation-boundaries": "error",
    },
  },
  globalIgnores([
    ".agent/**",
    ".agents/**",
    ".codex/**",
    ".claude/**",
    ".devin/**",
    ".impeccable/**",
    ".next/**",
    "node_modules/**",
    "openspec/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);
