// node/index.ts
// Integration service entry (with a safe local metrics stub for development)
// NOTE: This stub is intentionally non-invasive and will not redeclare block-scoped names.
// In production or VTEX runtime, replace/remove the stub so the real metrics client is used.

import type { ClientsConfig, ServiceContext, RecorderState } from '@vtex/api'
import { LRUCache, method, Service } from '@vtex/api'

import { Clients } from './clients'
import { processAbandonedCart } from './middlewares/AbandonedCart'
import { getOrders } from './middlewares/OrdersHook'
import { pong } from './middlewares/ping'

/* Safe non-declaring dev stub for missing metrics global (no redeclaration) */
;(function () {
  try {
    const g = (globalThis as any)
    if (typeof g.metrics === 'undefined') {
      g.metrics = {
        trackCache: function (_name: string, _value: any) {},
        increment: function (_name: string, _value?: number) {},
        gauge: function (_name: string, _value?: number) {},
        timing: function (_name: string, _ms?: number) {},
      }
    }
    if (typeof g.__metrics_local === 'undefined') {
      g.__metrics_local = g.metrics
    }
  } catch (e) {
    // defensive no-op if environment restricts globalThis
  }
})()

const metrics = (globalThis as any).__metrics_local || (globalThis as any).metrics

const TIMEOUT_MS = 10000

// Create a LRU memory cache for the Status client.
// The @vtex/api HttpClient respects Cache-Control headers and uses the provided cache.
const memoryCache = new LRUCache<string, any>({ max: 5000 })

// Track the cache for observability (safe no-op in local dev if metrics is stubbed)
try {
  if (metrics && typeof metrics.trackCache === 'function') {
    metrics.trackCache('status', memoryCache)
  }
} catch (e) {
  // swallow any metrics errors in dev
}

// This is the configuration for clients available in `ctx.clients`.
const clients: ClientsConfig<Clients> = {
  // We pass our custom implementation of the clients bag, containing the Status client.
  implementation: Clients,
  options: {
    // All IO Clients will be initialized with these options, unless otherwise specified.
    default: {
      retries: 2,
      timeout: TIMEOUT_MS,
    },
    // This key will be merged with the default options and add this cache to our Status client.
    status: {
      memoryCache,
    },
  },
}

declare global {
  // We declare a global Context type just to avoid re-writing ServiceContext<Clients, State> in every handler and resolver
  type Context = ServiceContext<Clients, State>

  // The shape of our State object found in `ctx.state`. This is used as state bag to communicate between middlewares.
  interface State extends RecorderState {
    code: number
  }
}

// Export a service that defines route handlers and client options.
export default new Service({
  clients,
  routes: {
    // `status` is the route ID from service.json. It maps to an array of middlewares (or a single handler).
    getOrders: method({
      POST: [getOrders],
    }),
    abandonedCart: method({
      POST: [processAbandonedCart],
    }),
    ping: method({
      GET: [pong],
    }),
  },
})
