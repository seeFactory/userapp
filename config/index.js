const { defineConfig } = require('@tarojs/cli')

const apiBase = process.env.SEEFACTORY_API_BASE || 'http://127.0.0.1:10087/api/v1'
const googleClientId = process.env.SEEFACTORY_GOOGLE_CLIENT_ID || ''
const devLoginEnabled = process.env.SEEFACTORY_DEV_LOGIN_ENABLED === 'true'
const clientVersion = process.env.SEEFACTORY_CLIENT_VERSION || '0.1.0'
const runtimeTarget = process.env.SEEFACTORY_RUNTIME_TARGET || 'h5'
const xRedirectUri = process.env.SEEFACTORY_X_REDIRECT_URI || (runtimeTarget === 'android-apk' ? 'seefactory://auth/x/callback' : '')
const googleRedirectUri = process.env.SEEFACTORY_GOOGLE_REDIRECT_URI || (runtimeTarget === 'android-apk' ? 'seefactory://auth/google/callback' : '')
const telegramLoginUrl = process.env.SEEFACTORY_TELEGRAM_LOGIN_URL || (runtimeTarget === 'android-apk' ? `${apiBase.replace(/\/+$/, '')}/auth/h5/telegram-bridge?returnTo=${encodeURIComponent('seefactory://auth/telegram/callback')}` : '')

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
    'process.env.SEEFACTORY_API_BASE': JSON.stringify(apiBase),
    'process.env.SEEFACTORY_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
    'process.env.SEEFACTORY_GOOGLE_REDIRECT_URI': JSON.stringify(googleRedirectUri),
    'process.env.SEEFACTORY_X_REDIRECT_URI': JSON.stringify(xRedirectUri),
    'process.env.SEEFACTORY_TELEGRAM_LOGIN_URL': JSON.stringify(telegramLoginUrl),
    'process.env.SEEFACTORY_DEV_LOGIN_ENABLED': JSON.stringify(devLoginEnabled ? 'true' : 'false'),
    'process.env.SEEFACTORY_CLIENT_VERSION': JSON.stringify(clientVersion),
    'process.env.SEEFACTORY_RUNTIME_TARGET': JSON.stringify(runtimeTarget)
  },
  copy: {
    patterns: [
      { from: 'src/assets/logo.png', to: 'dist/static/logo.png' },
      { from: 'src/assets/logo-hero.png', to: 'dist/static/logo-hero.png' }
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
