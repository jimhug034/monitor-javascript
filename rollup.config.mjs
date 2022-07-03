import ts from 'rollup-plugin-typescript2'
import json from '@rollup/plugin-json'
import replace from '@rollup/plugin-replace'
import path from 'path'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

if (!process.env.TARGET) {
  throw new Error(`TARGET package must be specified via --environment flag.`)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const { version } = await import('./package.json', { assert: { type: 'json' } })
const packagesDir = path.resolve(__dirname, 'packages')
const packageDir = path.resolve(packagesDir, process.env.TARGET)
const resolve = p => path.resolve(packageDir, p)
const { default: pkg } = await import(resolve(`package.json`), {
  assert: { type: 'json' }
})
const packageOptions = pkg.buildOptions || {}
const name = packageOptions.filename || path.basename(packageDir)

let hasTSChecked = false
const outputConfigs = {
  'esm-bundler': {
    file: resolve(`dist/${name}.esm-bundler.js`),
    format: `es`
  }
}

const defaultFormats = ['esm-bundler']
const inlineFormats = process.env.FORMATS && process.env.FORMATS.split(',')
const packageFormats = inlineFormats || packageOptions.formats || defaultFormats
const packageConfigs = process.env.PROD_ONLY
  ? []
  : packageFormats.map(format => createConfig(format, outputConfigs[format]))

export default packageConfigs

function createConfig(format, output, plugins = []) {
  if (!output) {
    console.log(chalk.yellow(`invalid format: "${format}"`))
    process.exit(1)
  }

  const isProductionBuild =
    process.env.__DEV__ === 'false' || /\.prod\.js$/.test(output.file)

  const isBundlerESMBuild = /esm-bundler/.test(format)
  const isBrowserESMBuild = /esm-browser/.test(format)

  output.sourcemap = !!process.env.SOURCE_MAP
  output.externalLiveBindings = false

  const shouldEmitDeclarations =
    pkg.types && process.env.TYPES != null && !hasTSChecked

  const tsPlugin = ts({
    check: process.env.NODE_ENV === 'production' && !hasTSChecked,
    tsconfig: path.resolve(__dirname, 'tsconfig.json'),
    cacheRoot: path.resolve(__dirname, 'node_modules/.rts2_cache'),
    tsconfigOverride: {
      compilerOptions: {
        target: 'es2015',
        sourceMap: output.sourcemap,
        declaration: shouldEmitDeclarations,
        declarationMap: shouldEmitDeclarations
      },
      exclude: ['**/__tests__']
    }
  })

  hasTSChecked = true

  let entryFile = `lib/index.ts`
  let external = []

  if (isBrowserESMBuild) {
    if (!packageOptions.enableNonBrowserBranches) {
      external = ['source-map', '@babel/parser', 'estree-walker']
    }
  } else {
    external = [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {})
    ]
  }

  return {
    input: resolve(entryFile),
    external,
    plugins: [
      json({
        namedExports: false
      }),
      tsPlugin,
      createReplacePlugin(
        isProductionBuild,
        isBundlerESMBuild,
        isBrowserESMBuild
      ),
      ...plugins
    ]
  }
}

function createReplacePlugin(
  isProduction,
  isBundlerESMBuild,
  isBrowserESMBuild,
  isNodeBuild
) {
  const replacements = {
    __VERSION__: `"${version}"`,
    __DEV__: isBundlerESMBuild
      ? // preserve to be handled by bundlers
        `(process.env.NODE_ENV !== 'production')`
      : // hard coded dev/prod builds
        !isProduction,
    // this is only used during Vue's internal tests
    __TEST__: false,
    // If the build is expected to run directly in the browser (global / esm builds)
    __ESM_BUNDLER__: isBundlerESMBuild,
    __ESM_BROWSER__: isBrowserESMBuild,
    __NODE_JS__: isNodeBuild,

    // for compiler-sfc browser build inlined deps
    ...(isBrowserESMBuild
      ? {
          'process.env': '({})',
          'process.platform': '""',
          'process.stdout': 'null'
        }
      : {})
  }
  // allow inline overrides like
  Object.keys(replacements).forEach(key => {
    if (key in process.env) {
      replacements[key] = process.env[key]
    }
  })
  return replace({
    values: replacements,
    preventAssignment: true
  })
}
