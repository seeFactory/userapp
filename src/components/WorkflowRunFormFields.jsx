import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Input, Picker, Switch, Textarea } from '@tarojs/components'
import { InlineNotice } from './PageState'
import { createAsset, getUploadToken } from '../services/api'
import { chooseTypedFiles, formatFileSize, uploadLimits, uploadToOss, validateUploadFile } from '../utils/upload'

export function workflowRunFields(runForm) {
  return Array.isArray(runForm?.fields)
    ? runForm.fields.filter((field) => field && String(field.key || '').trim())
    : []
}

export function fieldLabel(field) {
  return field.label || field.title || field.name || field.key
}

export function fieldType(field) {
  const raw = String(field.type || field.component || field.inputType || '').toLowerCase()
  if (raw === 'checkbox') return 'boolean'
  if (raw === 'select' || raw === 'radio') return 'select'
  if (raw === 'textarea' || raw === 'prompt') return 'textarea'
  if (raw === 'number' || raw === 'integer') return 'number'
  return raw || 'text'
}

export function fieldOptions(field) {
  const source = Array.isArray(field.options)
    ? field.options
    : Array.isArray(field.enum)
      ? field.enum
      : Array.isArray(field.choices)
        ? field.choices
        : []
  return source.map((item) => {
    if (item && typeof item === 'object') {
      const value = String(item.value ?? item.key ?? item.id ?? item.label ?? '')
      return { label: String(item.label ?? item.name ?? value), value }
    }
    return { label: String(item), value: String(item) }
  }).filter((item) => item.value)
}

export function isWorkflowRunUploadField(field) {
  const type = fieldType(field)
  const key = String(field.key || '').toLowerCase()
  return ['upload', 'multiupload', 'file', 'image', 'video', 'audio', 'asset', 'assets', 'media']
    .some((token) => type.includes(token) || key.includes(token))
}

export function isUnsupportedRunField(field) {
  void field
  return false
}

function uploadFieldType(field) {
  const type = fieldType(field)
  const assetType = String(field.assetType || field.mediaType || field.fileType || '').toLowerCase()
  const key = String(field.key || '').toLowerCase()
  if (assetType.includes('video') || type.includes('video') || key.includes('video')) return 'video'
  if (assetType.includes('audio') || type.includes('audio') || key.includes('audio')) return 'audio'
  return 'image'
}

function uploadFieldMaxCount(field) {
  const raw = Number(field.maxCount ?? field.max ?? (field.multiple || fieldType(field) === 'multiupload' || fieldType(field) === 'assets' ? 6 : 1))
  return Number.isFinite(raw) ? Math.max(1, Math.min(12, Math.floor(raw))) : 1
}

function uploadFieldMinCount(field) {
  const raw = Number(field.minCount ?? (field.required ? 1 : 0))
  return Number.isFinite(raw) ? Math.max(0, Math.min(uploadFieldMaxCount(field), Math.floor(raw))) : 0
}

function uploadFieldConfig(field) {
  const primaryType = uploadFieldType(field)
  const accepted = []
    .concat(field.acceptTypes || field.accept || field.assetTypes || primaryType)
    .map((item) => String(item || '').toLowerCase())
    .map((item) => item.includes('video') ? 'video' : item.includes('audio') ? 'audio' : 'image')
    .filter((item, index, list) => uploadLimits[item] && list.indexOf(item) === index)
  const acceptTypes = accepted.length ? accepted : [primaryType]
  const limit = uploadLimits[acceptTypes[0]] || uploadLimits.image
  return {
    acceptTypes,
    maxCount: uploadFieldMaxCount(field),
    minCount: uploadFieldMinCount(field),
    actionText: field.actionText || `点击添加${fieldLabel(field) || limit.label}`,
    tip: field.help || field.tip || limit.tip
  }
}

function normalizeUploadValue(value) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，\s]+/)
      : []
  return raw.map((item) => String(item || '').trim()).filter(Boolean)
}

export function defaultRunValue(field) {
  if (field.defaultValue !== undefined) return field.defaultValue
  if (field.default !== undefined) return field.default
  if (fieldType(field) === 'boolean') return false
  if (isWorkflowRunUploadField(field)) return []
  const options = fieldOptions(field)
  if (options.length && field.required) return options[0].value
  return ''
}

export function initialWorkflowRunValues(runForm) {
  return workflowRunFields(runForm).reduce((values, field) => ({
    ...values,
    [field.key]: defaultRunValue(field)
  }), {})
}

function normalizeRunValue(field, value) {
  if (isWorkflowRunUploadField(field)) return normalizeUploadValue(value)
  if (fieldType(field) === 'number') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : ''
  }
  if (fieldType(field) === 'boolean') return Boolean(value)
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  return typeof value === 'string' ? value.trim() : value ?? ''
}

export function buildWorkflowRunPayload(runForm, values = {}) {
  const input = {}
  const params = {}
  for (const field of workflowRunFields(runForm)) {
    if (isWorkflowRunUploadField(field)) {
      const ids = normalizeRunValue(field, values[field.key])
      const minCount = uploadFieldMinCount(field)
      const maxCount = uploadFieldMaxCount(field)
      if (ids.length < minCount) {
        return { ok: false, message: `请上传 ${fieldLabel(field)}。` }
      }
      if (ids.length > maxCount) {
        return { ok: false, message: `${fieldLabel(field)} 最多上传 ${maxCount} 个素材。` }
      }
      if (ids.length) input[field.key] = ids
      continue
    }
    const value = normalizeRunValue(field, values[field.key])
    const empty = value === '' || value === undefined || value === null || (Array.isArray(value) && value.length === 0)
    if (field.required && empty) {
      return { ok: false, message: `请填写 ${fieldLabel(field)}。` }
    }
    if (empty && fieldType(field) !== 'boolean') continue
    input[field.key] = value
    if (field.key !== 'prompt') params[field.key] = value
  }
  return { ok: true, payload: { input, params } }
}

export default function WorkflowRunFormFields({
  runForm,
  values,
  disabled,
  onChange,
  emptyText = '该模板没有开放可调运行参数，将使用作者发布时锁定的默认参数。'
}) {
  const fields = workflowRunFields(runForm)
  const [uploadItemsByKey, setUploadItemsByKey] = useState({})

  const updateUploadItem = (fieldKey, key, patch) => {
    setUploadItemsByKey((current) => ({
      ...current,
      [fieldKey]: (current[fieldKey] || []).map((item) => (item.key === key ? { ...item, ...patch } : item))
    }))
  }

  const chooseUpload = async (field) => {
    if (disabled) return
    const config = uploadFieldConfig(field)
    const fieldKey = field.key
    const currentItems = uploadItemsByKey[fieldKey] || []
    const currentIds = normalizeUploadValue(values[fieldKey])
    const existingCount = config.maxCount === 1 ? 0 : Math.max(currentIds.length, currentItems.filter((item) => item.status !== 'failed').length)
    const remaining = config.maxCount - existingCount
    if (remaining <= 0) {
      Taro.showToast({ title: `最多上传 ${config.maxCount} 个素材`, icon: 'none' })
      return
    }
    try {
      const files = await chooseTypedFiles({ ...config, maxCount: remaining })
      const validFiles = []
      const invalidMessages = []
      files.forEach((file) => {
        const message = validateUploadFile(file, config, '当前字段')
        if (message) {
          invalidMessages.push(`${file.name}：${message}`)
          return
        }
        validFiles.push(file)
      })
      if (invalidMessages.length) {
        Taro.showModal({
          title: '素材不符合要求',
          content: invalidMessages.slice(0, 3).join('\n'),
          showCancel: false
        })
      }
      if (!validFiles.length) return
      const pendingItems = validFiles.map((file) => ({
        ...file,
        status: 'pending',
        progress: 0,
        message: '等待上传'
      }))
      setUploadItemsByKey((current) => ({
        ...current,
        [fieldKey]: config.maxCount === 1 ? pendingItems : (current[fieldKey] || []).concat(pendingItems)
      }))
      Taro.showLoading({ title: '上传素材' })
      const nextIds = config.maxCount === 1 ? [] : normalizeUploadValue(values[fieldKey])
      let successCount = 0
      for (const file of pendingItems) {
        try {
          updateUploadItem(fieldKey, file.key, { status: 'uploading', progress: 5, message: '上传中' })
          const policy = await getUploadToken({
            type: file.type,
            filename: file.name,
            mimeType: file.mimeType,
            size: file.size
          })
          if (policy.configured) {
            await uploadToOss(policy, file, (progress) => updateUploadItem(fieldKey, file.key, { progress }))
          }
          updateUploadItem(fieldKey, file.key, { progress: 96, message: '写入素材记录' })
          const asset = await createAsset({
            type: file.type,
            url: policy.publicUrl,
            ossKey: policy.ossKey,
            mimeType: file.mimeType,
            size: file.size
          })
          successCount += 1
          nextIds.push(asset.id)
          updateUploadItem(fieldKey, file.key, {
            assetId: asset.id,
            remoteUrl: policy.publicUrl,
            status: 'ready',
            progress: 100,
            message: '已上传'
          })
        } catch (error) {
          updateUploadItem(fieldKey, file.key, {
            status: 'failed',
            progress: 0,
            message: error.message || '上传失败'
          })
        }
      }
      if (successCount) onChange(fieldKey, nextIds.slice(0, config.maxCount))
      Taro.showToast({ title: successCount ? `已上传 ${successCount} 个素材` : '素材上传失败', icon: successCount ? 'success' : 'none' })
    } catch (error) {
      Taro.showToast({ title: error.message || '素材添加失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const removeUploadItem = (field, item) => {
    if (disabled) return
    const fieldKey = field.key
    setUploadItemsByKey((current) => ({
      ...current,
      [fieldKey]: (current[fieldKey] || []).filter((row) => row.key !== item.key)
    }))
    if (item.assetId) {
      onChange(fieldKey, normalizeUploadValue(values[fieldKey]).filter((id) => id !== item.assetId))
    }
  }

  if (!fields.length) {
    return <InlineNotice>{emptyText}</InlineNotice>
  }
  return (
    <View className='workflow-run-form'>
      {fields.map((field) => {
        const type = fieldType(field)
        const label = fieldLabel(field)
        const value = values[field.key] ?? defaultRunValue(field)
        const options = fieldOptions(field)
        if (isWorkflowRunUploadField(field)) {
          const config = uploadFieldConfig(field)
          const items = uploadItemsByKey[field.key] || []
          const uploadedIds = normalizeUploadValue(value)
          const isUploading = items.some((item) => item.status === 'pending' || item.status === 'uploading')
          return (
            <View key={field.key} className='workflow-run-field'>
              <Text className='input-label'>{label}{field.required ? ' *' : ''}</Text>
              <View className={isUploading ? 'upload-box uploading' : 'upload-box'} onClick={() => chooseUpload(field)}>
                <View className='upload-copy'>
                  <Text>{uploadedIds.length ? `已添加 ${uploadedIds.length} 个素材` : isUploading ? '素材上传中...' : config.actionText}</Text>
                  <Text className='upload-hint'>{config.tip}</Text>
                </View>
              </View>
              {items.length ? (
                <View className='upload-preview-grid'>
                  {items.map((item) => (
                    <View key={item.key} className={item.status === 'failed' ? 'upload-preview-card failed' : 'upload-preview-card'}>
                      <View className='upload-file-preview'>
                        <Text>{uploadLimits[item.type]?.label || '文件'}素材</Text>
                      </View>
                      <View className='upload-preview-meta'>
                        <Text className='upload-preview-name'>{item.name}</Text>
                        <Text>{formatFileSize(item.size)} · {item.message}</Text>
                      </View>
                      {item.status === 'uploading' ? (
                        <View className='upload-progress'>
                          <View className='upload-progress-bar' style={{ width: `${item.progress || 4}%` }} />
                        </View>
                      ) : null}
                      {item.status !== 'uploading' ? (
                        <Text
                          className='upload-remove'
                          onClick={(event) => {
                            event.stopPropagation()
                            removeUploadItem(field, item)
                          }}
                        >
                          移除
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
              {uploadedIds.length && !items.length ? <Text className='tool-desc'>已选择 {uploadedIds.length} 个历史素材。</Text> : null}
            </View>
          )
        }
        if (type === 'boolean') {
          return (
            <View key={field.key} className='workflow-run-switch-field'>
              <View>
                <Text className='input-label'>{label}</Text>
                {field.help ? <Text className='tool-desc'>{field.help}</Text> : null}
              </View>
              <Switch checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(field.key, event.detail.value)} />
            </View>
          )
        }
        if (type === 'select' || options.length) {
          const selectedIndex = options.findIndex((option) => option.value === String(value))
          const pickerIndex = Math.max(0, selectedIndex)
          const selectedLabel = selectedIndex >= 0 ? options[selectedIndex]?.label : field.placeholder || '请选择'
          return (
            <View key={field.key} className='workflow-run-field'>
              <Text className='input-label'>{label}{field.required ? ' *' : ''}</Text>
              <Picker
                mode='selector'
                range={options.map((option) => option.label)}
                value={pickerIndex}
                disabled={disabled}
                onChange={(event) => onChange(field.key, options[Number(event.detail.value)]?.value || '')}
              >
                <View className='workflow-run-picker'>
                  <Text className='workflow-run-picker-value'>{selectedLabel}</Text>
                  <Text className='workflow-run-picker-action'>选择</Text>
                </View>
              </Picker>
              {field.help ? <Text className='tool-desc'>{field.help}</Text> : null}
            </View>
          )
        }
        if (type === 'textarea') {
          return (
            <View key={field.key} className='workflow-run-field'>
              <Text className='input-label'>{label}{field.required ? ' *' : ''}</Text>
              <Textarea
                value={String(value || '')}
                disabled={disabled}
                maxlength={Number(field.maxLength || 1200)}
                placeholder={field.placeholder || '请输入运行参数'}
                onInput={(event) => onChange(field.key, event.detail.value)}
              />
              {field.help ? <Text className='tool-desc'>{field.help}</Text> : null}
            </View>
          )
        }
        return (
          <View key={field.key} className='workflow-run-field'>
            <Text className='input-label'>{label}{field.required ? ' *' : ''}</Text>
            <Input
              type={type === 'number' ? 'number' : 'text'}
              value={String(value ?? '')}
              disabled={disabled}
              placeholder={field.placeholder || '请输入运行参数'}
              onInput={(event) => onChange(field.key, event.detail.value)}
            />
            {field.help ? <Text className='tool-desc'>{field.help}</Text> : null}
          </View>
        )
      })}
    </View>
  )
}
