export function firstCryptoRoute(chains = [], preferred = {}) {
  const selectedChain = chains.find((item) => item.chain === preferred.chain) || chains[0]
  const selectedToken = selectedChain?.tokens?.find((item) => item.token === preferred.token) || selectedChain?.tokens?.[0]
  return {
    chain: selectedChain?.chain || '',
    token: selectedToken?.token || '',
    bridgeCurrency: selectedToken?.bridgeCurrency || ''
  }
}
