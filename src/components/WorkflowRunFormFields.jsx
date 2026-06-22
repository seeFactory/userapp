import { View, Text, Input, Picker, Switch, Textarea } from '@tarojs/components'
import { InlineNotice } from './PageState'

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

export function isUnsupportedRunField(field) {
  const type = fieldType(field)
  const key = String(field.key || '').toLowerCase()
  return ['upload', 'file', 'image', 'video', 'audio', 'asset'].some((token) => type.includes(token) || key.includes(token))
}

export function defaultRunValue(field) {
  if (field.defaultValue !== undefined) return field.defaultValue
  if (field.default !== undefined) return field.default
  if (fieldType(field) === 'boolean') return false
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
    if (isUnsupportedRunField(field)) {
      if (field.required) {
        return {
          ok: false,
          message: `${fieldLabel(field)} 需要素材上传，请到 PC Dashboard 运行该模板。`
        }
      }
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
        if (isUnsupportedRunField(field)) {
          return (
            <View key={field.key} className='workflow-run-field'>
              <Text className='input-label'>{label}{field.required ? ' *' : ''}</Text>
              <InlineNotice tone={field.required ? 'warning' : 'info'}>小程序暂不支持该素材字段，请到 PC Dashboard 运行需要上传素材的模板。</InlineNotice>
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
