export const tabs = [
  { key: 'home', label: '首页', icon: 'home', path: '/pages/index/index' },
  { key: 'center', label: '创作中心', icon: 'center', path: '/pages/create-center/index' },
  { key: 'works', label: '我的作品', icon: 'book', path: '/pages/works/index' },
  { key: 'mine', label: '我的', icon: 'user', path: '/pages/mine/index' }
]

export const homeVideo = 'https://videos.pexels.com/video-files/16998437/16998437-hd_1080_1920_30fps.mp4'

export const toolCategories = [
  { key: 'all', label: '全部产品' },
  { key: 'image', label: 'AI 绘画' },
  { key: 'quick', label: '快速作图' },
  { key: 'video', label: '视频创作' },
  { key: 'image-video', label: '图生视频' },
  { key: 'text-video', label: '文生视频' },
  { key: 'fusion', label: '多图融合' },
  { key: 'comic', label: '品牌漫画' }
]

export const tools = [
  {
    id: 'factory-painter',
    category: 'image',
    name: 'AI 绘画',
    label: 'NEW',
    tone: 'magenta',
    featured: true,
    icon: 'wand',
    desc: '输入一句想法，生成海报、插画、场景图与风格化视觉。',
    cost: 2,
    fields: ['prompt', 'style', 'ratio', 'count']
  },
  {
    id: 'quick-image',
    category: 'quick',
    name: '快速作图',
    label: '轻量',
    tone: 'cyan',
    icon: 'image',
    desc: '适合头像、社交配图、电商素材的快速生成。',
    cost: 1,
    fields: ['prompt', 'style', 'ratio']
  },
  {
    id: 'video-lab',
    category: 'video',
    name: '视频创作',
    label: 'HOT',
    tone: 'violet',
    icon: 'video',
    desc: '从脚本到镜头，生成高质量 AI 短视频。',
    cost: 8,
    fields: ['prompt', 'duration', 'ratio', 'model']
  },
  {
    id: 'image-to-video',
    category: 'image-video',
    name: '图生视频',
    label: '推荐',
    tone: 'blue',
    icon: 'play',
    desc: '上传图片，让静态画面拥有镜头运动和氛围变化。',
    cost: 6,
    fields: ['upload', 'prompt', 'duration', 'model']
  },
  {
    id: 'text-to-video',
    category: 'text-video',
    name: '文生视频',
    label: 'NEW',
    tone: 'green',
    icon: 'film',
    desc: '用一句故事或脚本生成完整视频画面。',
    cost: 8,
    fields: ['prompt', 'duration', 'ratio', 'model']
  },
  {
    id: 'multi-fusion',
    category: 'fusion',
    name: '多图融合',
    label: '融合',
    tone: 'amber',
    icon: 'fusion',
    desc: '融合人物、产品、场景，多张参考图生成统一视觉。',
    cost: 4,
    fields: ['multiUpload', 'prompt', 'style']
  },
  {
    id: 'brand-comic',
    category: 'comic',
    name: '品牌漫画',
    label: '商用',
    tone: 'slate',
    icon: 'comic',
    desc: '生成品牌故事漫画、宣传分镜和知识型长图。',
    cost: 5,
    fields: ['prompt', 'style', 'count']
  },
  {
    id: 'audio-video',
    category: 'video',
    name: '音视频融合',
    label: '专业',
    tone: 'cyan',
    icon: 'music',
    desc: '结合音频、图片与视频素材，生成节奏化内容。',
    cost: 10,
    fields: ['upload', 'prompt', 'duration']
  },
  {
    id: 'portrait',
    category: 'image',
    name: '头像写真',
    label: '人像',
    tone: 'violet',
    icon: 'portrait',
    desc: '生成商务头像、艺术照、冷感黑白写真。',
    cost: 3,
    fields: ['upload', 'prompt', 'style', 'ratio']
  }
]

export const cases = [
  {
    id: 'case-137',
    title: '案例137：财神赐福素材 2',
    category: 'image',
    toolId: 'factory-painter',
    date: '2026/2/14',
    tags: ['节日营销', '人物场景'],
    image: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=80',
    prompt: '卧室夜景中，一位男子熟睡在白色床品里，床头柜电子钟显示 2026，金色财神形象发出柔和光芒，手持金元宝，整体氛围温暖、喜庆、电影级光影，超清细节。'
  },
  {
    id: 'case-047',
    title: '案例47：酷冷黑白艺术照',
    category: 'image',
    toolId: 'portrait',
    date: '2026/1/19',
    tags: ['黑白写真', '人像'],
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80',
    prompt: '极简黑白棚拍肖像，短发人物穿黑色高领毛衣，冷静眼神，柔和侧光，高级杂志封面质感，背景干净，颗粒细腻。'
  },
  {
    id: 'case-545',
    title: '案例545：品牌 LOGO 漫画营销',
    category: 'comic',
    toolId: 'brand-comic',
    date: '2026/3/02',
    tags: ['品牌故事', '漫画分镜'],
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
    prompt: '以古风商业故事为结构，六格漫画分镜展示品牌从咨询、方案、执行到增长的过程，每格有清晰人物动作和对话留白，最后一格突出品牌标识。'
  },
  {
    id: 'case-221',
    title: '案例221：扫地机产品卖点长图',
    category: 'quick',
    toolId: 'quick-image',
    date: '2026/2/28',
    tags: ['电商长图', '产品卖点'],
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80',
    prompt: '为智能扫地机器人生成电商详情页长图，突出静音体验、宠物家庭、办公室清洁和边角清扫能力，浅色家居环境，信息图布局。'
  },
  {
    id: 'case-812',
    title: '案例812：深空新品发布短片',
    category: 'video',
    toolId: 'video-lab',
    date: '2026/3/16',
    tags: ['品牌视频', '发布会'],
    image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=900&q=80',
    prompt: '深空背景中，一台黑色科技产品从星云光轨中缓慢出现，镜头环绕，蓝紫色边缘光，粒子向外扩散，适合新品发布开场。'
  },
  {
    id: 'case-918',
    title: '案例918：多图融合城市海报',
    category: 'fusion',
    toolId: 'multi-fusion',
    date: '2026/4/05',
    tags: ['城市', '海报'],
    image: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80',
    prompt: '融合人物肖像、城市天际线与产品光效，生成深色科技风城市营销海报，主视觉居中，霓虹边缘光，适合社交媒体投放。'
  }
]

export const seedWorks = [
  {
    id: 'work-001',
    title: '深空品牌发布短片',
    category: 'video',
    toolName: '视频创作',
    status: 'success',
    date: '2026/6/18 12:30',
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=80',
    prompt: '黑色产品从深空光轨里出现，蓝紫光环绕，镜头缓慢推进。'
  },
  {
    id: 'work-002',
    title: '冷感黑白头像',
    category: 'image',
    toolName: '头像写真',
    status: 'success',
    date: '2026/6/18 11:08',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80',
    prompt: '黑白肖像，商务、冷静、杂志封面。'
  },
  {
    id: 'work-003',
    title: '多图融合营销图',
    category: 'fusion',
    toolName: '多图融合',
    status: 'failed',
    date: '2026/6/17 18:42',
    image: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&w=900&q=80',
    prompt: '人物、产品、城市夜景融合。',
    failReason: '参考图数量不足，请至少上传 2 张图片。'
  }
]

export const styles = ['深空电影感', '冷调商业摄影', '品牌漫画', '赛博霓虹', '极简黑白', '电商精修']
export const ratios = ['1:1', '3:4', '9:16', '16:9']
export const durations = ['5 秒', '8 秒', '12 秒']
export const models = ['seeFactory Core', 'Sora 风格', 'Veo 风格', 'Grok 风格']

export const customer = {
  wechat: 'seeFactoryAI',
  note: '扫码或复制微信号联系系统客服，处理生成失败、额度和代理咨询。'
}
