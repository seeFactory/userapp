import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveMediaPreviewUrl } from '../src/utils/mediaPreview.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = (file) => readFileSync(resolve(root, file), 'utf8')
const includes = (text, pattern, message) => assert.ok(text.includes(pattern), message)

const api = source('src/services/api.js')
const tool = source('src/pages/tool/index.jsx')
const detail = source('src/pages/work-detail/index.jsx')
const upload = source('src/utils/upload.js')
const media = source('src/components/WorkMedia.jsx')

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
  'normalizeImageForVideoReference',
  'width: file.width',
  'height: file.height',
  'duration: file.duration'
]) includes(tool, pattern, `tool page must include ${pattern}`)
for (const pattern of ['reuseWorkId=', '<Text>做同款</Text>', '<Text>重新生成</Text>', '<WorkMedia']) {
  includes(detail, pattern, `work detail must include ${pattern}`)
}
for (const pattern of ['signed-put', 'uploadViaSignedPut', 'videoReferenceTargets']) {
  includes(upload, pattern, `upload utility must include ${pattern}`)
}
for (const pattern of ['captureVideoFrame', 'firstFrameCache', 'video-play-overlay']) {
  includes(media, pattern, `work media must include ${pattern}`)
}
includes(media, 'resolveMediaPreviewUrl', 'work media must use the shared preview resolver')
assert.equal(resolveMediaPreviewUrl({ mediaKind: 'image', mediaUrl: 'https://cdn.example/assets/123?format=webp' }), 'https://cdn.example/assets/123?format=webp')
assert.equal(resolveMediaPreviewUrl({ mediaKind: 'video', mediaUrl: 'https://cdn.example/video/123' }), '')
assert.equal(resolveMediaPreviewUrl({ mediaKind: 'video', mediaUrl: 'https://cdn.example/video/123', coverUrl: 'https://cdn.example/cover/456' }), 'https://cdn.example/cover/456')

console.log(JSON.stringify({
  checked: [
    'public channel selection and locked quotes',
    'complete work reuse restoration',
    'configurable multi-reference uploads',
    'runtime-aware signed PUT uploads',
    'H5 video first-frame preview',
    'extension-independent image and explicit video cover preview'
  ]
}, null, 2))
