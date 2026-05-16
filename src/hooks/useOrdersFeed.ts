import { useContext } from 'react'
import { OrdersFeedContext } from '@/contexts/orders-feed-context'

export function useOrdersFeed() {
  const ctx = useContext(OrdersFeedContext)
  if (!ctx) {
    throw new Error('useOrdersFeed yalnızca OrdersFeedProvider içinde kullanılabilir.')
  }
  return ctx
}
