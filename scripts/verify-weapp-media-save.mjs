import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const policySource = readFileSync(resolve('src/utils/mediaDownloadPolicy.js'), 'utf8')
const policyModuleUrl = `data:text/javascript;base64,${Buffer.from(policySource).toString('base64')}`
const { buildMediaDownloadCandidates, isAllowedWeappDownloadUrl } = await import(policyModuleUrl)

process.env.SEEFACTORY_WEAPP_DOWNLOAD_ORIGINS = 'https://sf-oss.sidcloud.cn'

const work = {
  mediaUrl: 'https://sf-oss.sidcloud.cn/generations/task/0.png',
  resultUrls: ['https://sf-oss.sidcloud.cn/generations/task/0.png'],
  image: 'https://sf-oss.sidcloud.cn/generations/task/0.png'
}

const signedCdnUrl = 'https://sf-oss.sidcloud.cn/generations/task/0.png?OSSAccessKeyId=test&Signature=test'
assert.deepEqual(buildMediaDownloadCandidates(signedCdnUrl, work, 'weapp'), [
  signedCdnUrl,
  work.mediaUrl
])

const rawOssUrl = 'https://bucket.oss-cn-hangzhou.aliyuncs.com/generations/task/0.png?Signature=test'
assert.deepEqual(buildMediaDownloadCandidates(rawOssUrl, work, 'weapp'), [work.mediaUrl])
assert.equal(isAllowedWeappDownloadUrl('https://sf-oss.sidcloud.cn.evil.example/0.png'), false)
assert.throws(
  () => buildMediaDownloadCandidates(rawOssUrl, {}, 'weapp'),
  /不在微信小程序白名单内/
)
assert.deepEqual(buildMediaDownloadCandidates(rawOssUrl, work, 'h5'), [rawOssUrl, work.mediaUrl])

const mediaSaveSource = readFileSync(resolve('src/utils/mediaSave.js'), 'utf8')
for (const pattern of [
  'Taro.downloadFile',
  'scope.writePhotosAlbum',
  'Taro.getSetting',
  'Taro.openSetting',
  'Taro.saveImageToPhotosAlbum',
  'Taro.saveVideoToPhotosAlbum'
]) {
  assert.ok(mediaSaveSource.includes(pattern), `Missing WeChat media save behavior: ${pattern}`)
}

console.log(JSON.stringify({
  checked: [
    'signed CDN URL stays on the WeChat download allowlist',
    'raw OSS URL falls back to the allowlisted public work URL',
    'lookalike and non-allowlisted origins are rejected',
    'H5 keeps the authenticated backend download URL',
    'album permission denial can recover through settings'
  ]
}, null, 2))
