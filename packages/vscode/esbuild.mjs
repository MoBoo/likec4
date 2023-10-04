import * as esbuild from 'esbuild'
import { build, formatMessagesSync, analyzeMetafileSync } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { nodeModulesPolyfillPlugin } from 'esbuild-plugins-node-modules-polyfill';

import path from 'node:path'

const watch = process.argv.includes('--watch')
const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'

const alias = {
  'vscode-uri': 'vscode-uri/lib/esm/index.js',
  '@likec4/core/compute-view': '../core/src/compute-view/index.ts',
  '@likec4/core/utils': '../core/src/utils/index.ts',
  '@likec4/core/errors': '../core/src/errors/index.ts',
  '@likec4/core/types': '../core/src/types/index.ts',
  '@likec4/core/colors': '../core/src/colors.ts',
  '@likec4/core': '../core/src/index.ts',
  '@likec4/diagrams': '../diagrams/src/index.ts',
  '@likec4/generators': '../generators/src/index.ts',
  '@likec4/language-server': '../language-server/src/index.ts',
  '@likec4/layouts': '../layouts/src/index.ts'
}

/**
 * @type {esbuild.BuildOptions}
 */
const base = {
  metafile: isDev,
  logLevel: 'info',
  outdir: 'dist',
  outbase: 'src',
  color: true,
  bundle: true,
  external: ['vscode'],
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  alias: {
    ...alias
  },
  format: 'cjs',
  sourcemap: true,
  sourcesContent: isDev,
  keepNames: true,
  minify: !isDev,
  legalComments: 'none',
}

/**
 * @type {esbuild.BuildOptions}
 */
const extensionNodeCfg = {
  ...base,
  entryPoints: ['src/node/extension.ts'],
  format: 'cjs',
  target: 'node16',
  platform: 'node'
}
const serverNodeCfg = {
  ...extensionNodeCfg,
  entryPoints: ['src/node/language-server.ts'],
}

/**
 * @type {esbuild.BuildOptions}
 */
const extensionWebCfg = {
  ...base,
  entryPoints: ['src/browser/extension.ts'],
  target: 'es2022',
  platform: 'browser',
  plugins: [
    nodeModulesPolyfillPlugin({
      globals: {
        process: true,
      }
    })
  ]
}
/**
 * @type {esbuild.BuildOptions}
 */
const serverWebCfg = {
  ...base,
  entryPoints: ['src/browser/language-server-worker.ts'],
  format: 'iife',
  target: 'es2022',
  platform: 'browser',
  plugins: [
    nodeModulesPolyfillPlugin({
      globals: {
        process: true,
      }
    })
  ]
}

const builds = [
  extensionNodeCfg,
  serverNodeCfg,
  extensionWebCfg,
  serverWebCfg
]

const bundles = await Promise.all(builds.map(cfg => build(cfg)))
bundles.forEach((bundle) => {
  if (bundle.metafile) {
    const out = Object.keys(bundle.metafile.outputs).find(k => k.endsWith('.js'))
    if (out) {
      const metafilepath = path.resolve(out + '.metafile.json')
      writeFileSync(metafilepath, JSON.stringify(bundle.metafile))
      console.log(metafilepath)
    }
    // bundle.warnings
    // console.log(analyzeMetafileSync(bundle.metafile))
  }
})

// if (!watch) {
//   const bundles = await Promise.all([
//     esbuild.build(extensionNodeCfg),
//     esbuild.build(extensionWebCfg),
//     esbuild.build(webWorkerCfg)
//   ])

//   const [nodeBundle, webBundle, webWorkerBundle] = bundles
//   nodeBundle.outputFiles

//   if (nodeBundle.metafile) {
//     const metafile = path.resolve('dist', 'node', 'extension.metafile.json')
//     await writeFile(metafile, JSON.stringify(nodeBundle.metafile))
//   }
//   if (webBundle.metafile) {
//     const metafile = path.resolve('dist', 'browser', 'extension.metafile.json')
//     await writeFile(metafile, JSON.stringify(webBundle.metafile))
//   }
//   if (webWorkerBundle.metafile) {
//     const metafile = path.resolve('dist', 'browser', 'language-server-worker.metafile.json')
//     await writeFile(metafile, JSON.stringify(webBundle.metafile))
//   }

//   const errors = bundles.flatMap(b => b.errors)
//   const warnings = bundles.flatMap(b => b.warnings)
//   if (errors.length || warnings.length) {
//     console.error(
//       [
//         ...formatMessagesSync(warnings, {
//           kind: 'warning',
//           color: true,
//           terminalWidth: process.stdout.columns
//         }),
//         ...formatMessagesSync(errors, {
//           kind: 'error',
//           color: true,
//           terminalWidth: process.stdout.columns
//         })
//       ].join('\n')
//     )
//     console.error('\n ⛔️ Build failed')
//     process.exit(1)
//   }
//   process.exit(0)
// }

// const [nodeCtx, webCtx, webWorkerCtx] = await Promise.all([
//   esbuild.context(extensionNodeCfg),
//   esbuild.context(extensionWebCfg),
//   esbuild.context(webWorkerCfg)
// ])
// await nodeCtx.watch()
// await webCtx.watch()
// await webWorkerCtx.watch()
// console.info(' 👀 watching...')
