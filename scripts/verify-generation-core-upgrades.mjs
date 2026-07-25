import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildImagePreviewUrls, resolveMediaPreviewUrl } from '../src/utils/mediaPreview.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = (file) => readFileSync(resolve(root, file), 'utf8')
const includes = (text, pattern, message) => assert.ok(text.includes(pattern), message)

const api = source('src/services/api.js')
const buildConfig = source('config/index.js')
const tool = source('src/pages/tool/index.jsx')
const detail = source('src/pages/work-detail/index.jsx')
const gallery = source('src/pages/gallery/index.jsx')
const works = source('src/pages/works/index.jsx')
const upload = source('src/utils/upload.js')
const workflowFields = source('src/components/WorkflowRunFormFields.jsx')
const media = source('src/components/WorkMedia.jsx')
const mediaFullscreen = source('src/utils/mediaFullscreen.weapp.js')

for (const pattern of ['createGenerationQuote', "request('/generation-quotes'", 'prepareWorkReuseContext', '/reuse-context']) {
  includes(api, pattern, `API client must include ${pattern}`)
}
for (const pattern of [
  'channelOffersOf',
  'availabilityStatus',
  'disabledReason',
  'channelSelectionUnavailable',
  "offer.selectable !== false",
  "AppIcon name='lock'",
  'effectiveChannelOfferId',
  'quoteId: activeQuote?.quoteId',
  'prepareWorkReuseContext(reuseWorkId',
  'restoredUploadState',
  'referenceUploadMax',
  'const remaining = currentUploadConfig.maxCount - existingCount',
  'const readyActionText = Number(config.maxCount || 1) > 1',
  'if (leftovers.length) slotUploadItems[slots[0].slotKey]',
  'normalizeImageForVideoReference',
  'mimeType: policy.mimeType || file.mimeType',
  'width: file.width',
  'height: file.height',
  'duration: file.duration'
]) includes(tool, pattern, `tool page must include ${pattern}`)
for (const pattern of ['reuseWorkId=', '<Text>做同款</Text>', '<Text>重新生成</Text>', '<WorkMedia']) {
  includes(detail, pattern, `work detail must include ${pattern}`)
}
includes(detail, "previewOnClick={mediaKind === 'image'}", 'work detail must enable image preview on result media')
for (const pattern of [
  'signed-put',
  'uploadViaSignedPut',
  'videoReferenceTargets',
  'inferUploadMimeType',
  'uploadFailureMessage',
  'url not in domain',
  'onProgress?.'
]) {
  includes(upload, pattern, `upload utility must include ${pattern}`)
}
includes(workflowFields, 'mimeType: policy.mimeType || file.mimeType', 'workflow uploads must persist the MIME signed by the backend')
for (const pattern of ['uploadRuntime', "name: 'upload-runtime'", "chunks: 'all'", 'enforce: true']) {
  includes(buildConfig, pattern, `build config must keep the shared upload runtime chunk: ${pattern}`)
}
for (const pattern of ['captureVideoFrame', 'firstFrameCache', 'video-play-overlay', 'previewImagesFullscreen', 'showMenuByLongpress={isImageInteractive}']) {
  includes(media, pattern, `work media must include ${pattern}`)
}
for (const pattern of ['Taro.previewImage', 'current', 'urls', 'showmenu: true']) {
  includes(mediaFullscreen, pattern, `WeChat full-screen media helper must include ${pattern}`)
}
includes(media, 'resolveMediaPreviewUrl', 'work media must use the shared preview resolver')
assert.equal(resolveMediaPreviewUrl({ mediaKind: 'image', mediaUrl: 'https://cdn.example/assets/123?format=webp' }), 'https://cdn.example/assets/123?format=webp')
assert.equal(resolveMediaPreviewUrl({ mediaKind: 'video', mediaUrl: 'https://cdn.example/video/123' }), '')
assert.equal(resolveMediaPreviewUrl({ mediaKind: 'video', mediaUrl: 'https://cdn.example/video/123', coverUrl: 'https://cdn.example/cover/456' }), 'https://cdn.example/cover/456')
assert.deepEqual(buildImagePreviewUrls({
  mediaKind: 'image',
  mediaUrl: 'https://cdn.example/result/1',
  resultUrls: ['https://cdn.example/result/1', 'https://cdn.example/result/2'],
  coverUrl: 'https://cdn.example/cover/1'
}), [
  'https://cdn.example/result/1',
  'https://cdn.example/result/2',
  'https://cdn.example/cover/1'
])
assert.deepEqual(buildImagePreviewUrls({ mediaKind: 'video', mediaUrl: 'https://cdn.example/video/1' }), [])
assert.equal(gallery.includes('previewOnClick'), false, 'gallery cards must keep navigating to work detail instead of opening preview')
assert.equal(works.includes('previewOnClick'), false, 'work cards must keep navigating to work detail instead of opening preview')

console.log(JSON.stringify({
  checked: [
    'public channel selection and locked quotes',
    'complete work reuse restoration',
    'configurable multi-reference uploads',
    'miniapp MIME inference and actionable upload failures',
    'deduplicated shared upload runtime chunk',
    'runtime-aware signed PUT uploads',
    'H5 video first-frame preview',
    'extension-independent image and explicit video cover preview',
    'native full-screen image preview with multi-result swiping'
  ]
}, null, 2))
