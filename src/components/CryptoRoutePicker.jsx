import { View, Text, Picker } from '@tarojs/components'

export { firstCryptoRoute } from '../utils/cryptoRoute'

export default function CryptoRoutePicker({
  title = '支付链与代币',
  chains = [],
  value = {},
  onChange,
  disabled = false
}) {
  const selectedChain = chains.find((item) => item.chain === value.chain) || chains[0]
  const tokens = selectedChain?.tokens || []
  const selectedToken = tokens.find((item) => item.token === value.token) || tokens[0]
  const chainIndex = Math.max(0, chains.findIndex((item) => item.chain === selectedChain?.chain))
  const tokenIndex = Math.max(0, tokens.findIndex((item) => item.token === selectedToken?.token))

  const updateChain = (event) => {
    const nextChain = chains[Number(event.detail.value)] || chains[0]
    const nextToken = nextChain?.tokens?.[0]
    onChange?.({
      chain: nextChain?.chain || '',
      token: nextToken?.token || '',
      bridgeCurrency: nextToken?.bridgeCurrency || ''
    })
  }

  const updateToken = (event) => {
    const nextToken = tokens[Number(event.detail.value)] || tokens[0]
    onChange?.({
      chain: selectedChain?.chain || '',
      token: nextToken?.token || '',
      bridgeCurrency: nextToken?.bridgeCurrency || ''
    })
  }

  return (
    <View className='wallet-picker-block crypto-route-picker'>
      <Text className='input-label'>{title}</Text>
      <View className='wallet-select-grid'>
        <Picker disabled={disabled || !chains.length} mode='selector' range={chains.map((item) => `${item.label} · ${item.network}`)} value={chainIndex} onChange={updateChain}>
          <View className='select-field'>
            <Text>{selectedChain ? `${selectedChain.label}` : '暂无支付链'}</Text>
            <Text className='select-sub'>{selectedChain?.network || '--'}</Text>
          </View>
        </Picker>
        <Picker disabled={disabled || !tokens.length} mode='selector' range={tokens.map((item) => `${item.token} · ${item.bridgeCurrency}`)} value={tokenIndex} onChange={updateToken}>
          <View className='select-field'>
            <Text>{selectedToken?.token || '暂无代币'}</Text>
            <Text className='select-sub'>{selectedToken?.bridgeCurrency || '--'}</Text>
          </View>
        </Picker>
      </View>
    </View>
  )
}
