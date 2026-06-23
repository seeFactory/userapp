export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/create-center/index',
    'pages/gallery/index',
    'pages/works/index',
    'pages/mine/index',
    'pages/login/index',
    'pages/tool/index',
    'pages/prompt-detail/index',
    'pages/work-detail/index',
    'pages/agent/index',
    'pages/wallet/index',
    'pages/workflow-cases/index',
    'pages/workflow-purchases/index',
    'pages/workflow-linear/index',
    'pages/workflow-runs/detail/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#05070D',
    navigationBarTitleText: 'seeFactory',
    navigationBarTextStyle: 'white',
    backgroundColor: '#05070D'
  },
  tabBar: {
    color: '#98AAC2',
    selectedColor: '#FF35B5',
    backgroundColor: '#05070D',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/index/index', text: '首页' },
      { pagePath: 'pages/create-center/index', text: '创作' },
      { pagePath: 'pages/gallery/index', text: '广场' },
      { pagePath: 'pages/works/index', text: '作品' },
      { pagePath: 'pages/mine/index', text: '我的' }
    ]
  },
  lazyCodeLoading: 'requiredComponents'
})
