import { Button } from '@tarojs/components'

export default function NativeShareButton({ className = '', children }) {
  return (
    <Button className={className} openType='share'>
      {children}
    </Button>
  )
}
