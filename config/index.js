const { defineConfig } = require('@tarojs/cli')

const apiBase = process.env.SEEFACTORY_API_BASE || 'http://127.0.0.1:10087/api/v1'

module.exports = defineConfig({
  projectName: 'seeFactory',
  date: '2026-06-18',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: {
    type: 'webpack5',
    prebundle: {
      enable: false
    }
  },
  plugins: [],
  cache: {
    enable: false
  },
  alias: {},
  defineConstants: {
    'process.env.SEEFACTORY_API_BASE': JSON.stringify(apiBase)
  },
  copy: {
    patterns: [
      { from: 'src/assets/logo.png', to: 'dist/static/logo.png' }
    ],
    options: {}
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {}
      },
      cssModules: {
        enable: false
      }
    }
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    devServer: {
      host: '127.0.0.1',
      port: 10086
    },
    postcss: {
      pxtransform: {
        enable: false
      },
      autoprefixer: {
        enable: true
      },
      cssModules: {
        enable: false
      }
    }
  }
})
