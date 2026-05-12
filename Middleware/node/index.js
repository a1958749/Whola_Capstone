"use strict";
// node/index.ts
// Integration service entry (with a safe local metrics stub for development)
// NOTE: This stub is intentionally non-invasive and will not redeclare block-scoped names.
// In production or VTEX runtime, replace/remove the stub so the real metrics client is used.
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("@vtex/api");
const clients_1 = require("./clients");
const AbandonedCart_1 = require("./middlewares/AbandonedCart");
const OrdersHook_1 = require("./middlewares/OrdersHook");
const ping_1 = require("./middlewares/ping");
(function () {
    try {
        const g = globalThis;
        if (typeof g.metrics === 'undefined') {
            g.metrics = {
                trackCache: function (_name, _value) { },
                increment: function (_name, _value) { },
                gauge: function (_name, _value) { },
                timing: function (_name, _ms) { },
            };
        }
        if (typeof g.__metrics_local === 'undefined') {
            g.__metrics_local = g.metrics;
        }
    }
    catch (e) {
        // defensive no-op if environment restricts globalThis
    }
})();
const metrics = globalThis.__metrics_local || globalThis.metrics;
const TIMEOUT_MS = 10000;
// Create a LRU memory cache for the Status client.
// The @vtex/api HttpClient respects Cache-Control headers and uses the provided cache.
const memoryCache = new api_1.LRUCache({ max: 5000 });
// Track the cache for observability (safe no-op in local dev if metrics is stubbed)
try {
    if (metrics && typeof metrics.trackCache === 'function') {
        metrics.trackCache('status', memoryCache);
    }
}
catch (e) {
    // swallow any metrics errors in dev
}
// This is the configuration for clients available in `ctx.clients`.
const clients = {
    // We pass our custom implementation of the clients bag, containing the Status client.
    implementation: clients_1.Clients,
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
};
// Export a service that defines route handlers and client options.
exports.default = new api_1.Service({
    clients,
    routes: {
        // `status` is the route ID from service.json. It maps to an array of middlewares (or a single handler).
        getOrders: (0, api_1.method)({
            POST: [OrdersHook_1.getOrders],
        }),
        abandonedCart: (0, api_1.method)({
            POST: [AbandonedCart_1.processAbandonedCart],
        }),
        ping: (0, api_1.method)({
            GET: [ping_1.pong],
        }),
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsZ0JBQWdCO0FBQ2hCLDZFQUE2RTtBQUM3RSwyRkFBMkY7QUFDM0YsNkZBQTZGOztBQUc3RixtQ0FBcUQ7QUFFckQsdUNBQW1DO0FBQ25DLCtEQUFrRTtBQUNsRSx5REFBb0Q7QUFDcEQsNkNBR0M7QUFBQSxDQUFDO0lBQ0EsSUFBSSxDQUFDO1FBQ0gsTUFBTSxDQUFDLEdBQUksVUFBa0IsQ0FBQTtRQUM3QixJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sS0FBSyxXQUFXLEVBQUUsQ0FBQztZQUNyQyxDQUFDLENBQUMsT0FBTyxHQUFHO2dCQUNWLFVBQVUsRUFBRSxVQUFVLEtBQWEsRUFBRSxNQUFXLElBQUcsQ0FBQztnQkFDcEQsU0FBUyxFQUFFLFVBQVUsS0FBYSxFQUFFLE1BQWUsSUFBRyxDQUFDO2dCQUN2RCxLQUFLLEVBQUUsVUFBVSxLQUFhLEVBQUUsTUFBZSxJQUFHLENBQUM7Z0JBQ25ELE1BQU0sRUFBRSxVQUFVLEtBQWEsRUFBRSxHQUFZLElBQUcsQ0FBQzthQUNsRCxDQUFBO1FBQ0gsQ0FBQztRQUNELElBQUksT0FBTyxDQUFDLENBQUMsZUFBZSxLQUFLLFdBQVcsRUFBRSxDQUFDO1lBQzdDLENBQUMsQ0FBQyxlQUFlLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQTtRQUMvQixDQUFDO0lBQ0gsQ0FBQztJQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDWCxzREFBc0Q7SUFDeEQsQ0FBQztBQUNILENBQUMsQ0FBQyxFQUFFLENBQUE7QUFFSixNQUFNLE9BQU8sR0FBSSxVQUFrQixDQUFDLGVBQWUsSUFBSyxVQUFrQixDQUFDLE9BQU8sQ0FBQTtBQUVsRixNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUE7QUFFeEIsbURBQW1EO0FBQ25ELHVGQUF1RjtBQUN2RixNQUFNLFdBQVcsR0FBRyxJQUFJLGNBQVEsQ0FBYyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFBO0FBRTVELG9GQUFvRjtBQUNwRixJQUFJLENBQUM7SUFDSCxJQUFJLE9BQU8sSUFBSSxPQUFPLE9BQU8sQ0FBQyxVQUFVLEtBQUssVUFBVSxFQUFFLENBQUM7UUFDeEQsT0FBTyxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUE7SUFDM0MsQ0FBQztBQUNILENBQUM7QUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO0lBQ1gsb0NBQW9DO0FBQ3RDLENBQUM7QUFFRCxvRUFBb0U7QUFDcEUsTUFBTSxPQUFPLEdBQTJCO0lBQ3RDLHNGQUFzRjtJQUN0RixjQUFjLEVBQUUsaUJBQU87SUFDdkIsT0FBTyxFQUFFO1FBQ1AscUZBQXFGO1FBQ3JGLE9BQU8sRUFBRTtZQUNQLE9BQU8sRUFBRSxDQUFDO1lBQ1YsT0FBTyxFQUFFLFVBQVU7U0FDcEI7UUFDRCw0RkFBNEY7UUFDNUYsTUFBTSxFQUFFO1lBQ04sV0FBVztTQUNaO0tBQ0Y7Q0FDRixDQUFBO0FBWUQsbUVBQW1FO0FBQ25FLGtCQUFlLElBQUksYUFBTyxDQUFDO0lBQ3pCLE9BQU87SUFDUCxNQUFNLEVBQUU7UUFDTix3R0FBd0c7UUFDeEcsU0FBUyxFQUFFLElBQUEsWUFBTSxFQUFDO1lBQ2hCLElBQUksRUFBRSxDQUFDLHNCQUFTLENBQUM7U0FDbEIsQ0FBQztRQUNGLGFBQWEsRUFBRSxJQUFBLFlBQU0sRUFBQztZQUNwQixJQUFJLEVBQUUsQ0FBQyxvQ0FBb0IsQ0FBQztTQUM3QixDQUFDO1FBQ0YsSUFBSSxFQUFFLElBQUEsWUFBTSxFQUFDO1lBQ1gsR0FBRyxFQUFFLENBQUMsV0FBSSxDQUFDO1NBQ1osQ0FBQztLQUNIO0NBQ0YsQ0FBQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLy8gbm9kZS9pbmRleC50c1xuLy8gSW50ZWdyYXRpb24gc2VydmljZSBlbnRyeSAod2l0aCBhIHNhZmUgbG9jYWwgbWV0cmljcyBzdHViIGZvciBkZXZlbG9wbWVudClcbi8vIE5PVEU6IFRoaXMgc3R1YiBpcyBpbnRlbnRpb25hbGx5IG5vbi1pbnZhc2l2ZSBhbmQgd2lsbCBub3QgcmVkZWNsYXJlIGJsb2NrLXNjb3BlZCBuYW1lcy5cbi8vIEluIHByb2R1Y3Rpb24gb3IgVlRFWCBydW50aW1lLCByZXBsYWNlL3JlbW92ZSB0aGUgc3R1YiBzbyB0aGUgcmVhbCBtZXRyaWNzIGNsaWVudCBpcyB1c2VkLlxuXG5pbXBvcnQgdHlwZSB7IENsaWVudHNDb25maWcsIFNlcnZpY2VDb250ZXh0LCBSZWNvcmRlclN0YXRlIH0gZnJvbSAnQHZ0ZXgvYXBpJ1xuaW1wb3J0IHsgTFJVQ2FjaGUsIG1ldGhvZCwgU2VydmljZSB9IGZyb20gJ0B2dGV4L2FwaSdcblxuaW1wb3J0IHsgQ2xpZW50cyB9IGZyb20gJy4vY2xpZW50cydcbmltcG9ydCB7IHByb2Nlc3NBYmFuZG9uZWRDYXJ0IH0gZnJvbSAnLi9taWRkbGV3YXJlcy9BYmFuZG9uZWRDYXJ0J1xuaW1wb3J0IHsgZ2V0T3JkZXJzIH0gZnJvbSAnLi9taWRkbGV3YXJlcy9PcmRlcnNIb29rJ1xuaW1wb3J0IHsgcG9uZyB9IGZyb20gJy4vbWlkZGxld2FyZXMvcGluZydcblxuLyogU2FmZSBub24tZGVjbGFyaW5nIGRldiBzdHViIGZvciBtaXNzaW5nIG1ldHJpY3MgZ2xvYmFsIChubyByZWRlY2xhcmF0aW9uKSAqL1xuOyhmdW5jdGlvbiAoKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgZyA9IChnbG9iYWxUaGlzIGFzIGFueSlcbiAgICBpZiAodHlwZW9mIGcubWV0cmljcyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGcubWV0cmljcyA9IHtcbiAgICAgICAgdHJhY2tDYWNoZTogZnVuY3Rpb24gKF9uYW1lOiBzdHJpbmcsIF92YWx1ZTogYW55KSB7fSxcbiAgICAgICAgaW5jcmVtZW50OiBmdW5jdGlvbiAoX25hbWU6IHN0cmluZywgX3ZhbHVlPzogbnVtYmVyKSB7fSxcbiAgICAgICAgZ2F1Z2U6IGZ1bmN0aW9uIChfbmFtZTogc3RyaW5nLCBfdmFsdWU/OiBudW1iZXIpIHt9LFxuICAgICAgICB0aW1pbmc6IGZ1bmN0aW9uIChfbmFtZTogc3RyaW5nLCBfbXM/OiBudW1iZXIpIHt9LFxuICAgICAgfVxuICAgIH1cbiAgICBpZiAodHlwZW9mIGcuX19tZXRyaWNzX2xvY2FsID09PSAndW5kZWZpbmVkJykge1xuICAgICAgZy5fX21ldHJpY3NfbG9jYWwgPSBnLm1ldHJpY3NcbiAgICB9XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICAvLyBkZWZlbnNpdmUgbm8tb3AgaWYgZW52aXJvbm1lbnQgcmVzdHJpY3RzIGdsb2JhbFRoaXNcbiAgfVxufSkoKVxuXG5jb25zdCBtZXRyaWNzID0gKGdsb2JhbFRoaXMgYXMgYW55KS5fX21ldHJpY3NfbG9jYWwgfHwgKGdsb2JhbFRoaXMgYXMgYW55KS5tZXRyaWNzXG5cbmNvbnN0IFRJTUVPVVRfTVMgPSAxMDAwMFxuXG4vLyBDcmVhdGUgYSBMUlUgbWVtb3J5IGNhY2hlIGZvciB0aGUgU3RhdHVzIGNsaWVudC5cbi8vIFRoZSBAdnRleC9hcGkgSHR0cENsaWVudCByZXNwZWN0cyBDYWNoZS1Db250cm9sIGhlYWRlcnMgYW5kIHVzZXMgdGhlIHByb3ZpZGVkIGNhY2hlLlxuY29uc3QgbWVtb3J5Q2FjaGUgPSBuZXcgTFJVQ2FjaGU8c3RyaW5nLCBhbnk+KHsgbWF4OiA1MDAwIH0pXG5cbi8vIFRyYWNrIHRoZSBjYWNoZSBmb3Igb2JzZXJ2YWJpbGl0eSAoc2FmZSBuby1vcCBpbiBsb2NhbCBkZXYgaWYgbWV0cmljcyBpcyBzdHViYmVkKVxudHJ5IHtcbiAgaWYgKG1ldHJpY3MgJiYgdHlwZW9mIG1ldHJpY3MudHJhY2tDYWNoZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIG1ldHJpY3MudHJhY2tDYWNoZSgnc3RhdHVzJywgbWVtb3J5Q2FjaGUpXG4gIH1cbn0gY2F0Y2ggKGUpIHtcbiAgLy8gc3dhbGxvdyBhbnkgbWV0cmljcyBlcnJvcnMgaW4gZGV2XG59XG5cbi8vIFRoaXMgaXMgdGhlIGNvbmZpZ3VyYXRpb24gZm9yIGNsaWVudHMgYXZhaWxhYmxlIGluIGBjdHguY2xpZW50c2AuXG5jb25zdCBjbGllbnRzOiBDbGllbnRzQ29uZmlnPENsaWVudHM+ID0ge1xuICAvLyBXZSBwYXNzIG91ciBjdXN0b20gaW1wbGVtZW50YXRpb24gb2YgdGhlIGNsaWVudHMgYmFnLCBjb250YWluaW5nIHRoZSBTdGF0dXMgY2xpZW50LlxuICBpbXBsZW1lbnRhdGlvbjogQ2xpZW50cyxcbiAgb3B0aW9uczoge1xuICAgIC8vIEFsbCBJTyBDbGllbnRzIHdpbGwgYmUgaW5pdGlhbGl6ZWQgd2l0aCB0aGVzZSBvcHRpb25zLCB1bmxlc3Mgb3RoZXJ3aXNlIHNwZWNpZmllZC5cbiAgICBkZWZhdWx0OiB7XG4gICAgICByZXRyaWVzOiAyLFxuICAgICAgdGltZW91dDogVElNRU9VVF9NUyxcbiAgICB9LFxuICAgIC8vIFRoaXMga2V5IHdpbGwgYmUgbWVyZ2VkIHdpdGggdGhlIGRlZmF1bHQgb3B0aW9ucyBhbmQgYWRkIHRoaXMgY2FjaGUgdG8gb3VyIFN0YXR1cyBjbGllbnQuXG4gICAgc3RhdHVzOiB7XG4gICAgICBtZW1vcnlDYWNoZSxcbiAgICB9LFxuICB9LFxufVxuXG5kZWNsYXJlIGdsb2JhbCB7XG4gIC8vIFdlIGRlY2xhcmUgYSBnbG9iYWwgQ29udGV4dCB0eXBlIGp1c3QgdG8gYXZvaWQgcmUtd3JpdGluZyBTZXJ2aWNlQ29udGV4dDxDbGllbnRzLCBTdGF0ZT4gaW4gZXZlcnkgaGFuZGxlciBhbmQgcmVzb2x2ZXJcbiAgdHlwZSBDb250ZXh0ID0gU2VydmljZUNvbnRleHQ8Q2xpZW50cywgU3RhdGU+XG5cbiAgLy8gVGhlIHNoYXBlIG9mIG91ciBTdGF0ZSBvYmplY3QgZm91bmQgaW4gYGN0eC5zdGF0ZWAuIFRoaXMgaXMgdXNlZCBhcyBzdGF0ZSBiYWcgdG8gY29tbXVuaWNhdGUgYmV0d2VlbiBtaWRkbGV3YXJlcy5cbiAgaW50ZXJmYWNlIFN0YXRlIGV4dGVuZHMgUmVjb3JkZXJTdGF0ZSB7XG4gICAgY29kZTogbnVtYmVyXG4gIH1cbn1cblxuLy8gRXhwb3J0IGEgc2VydmljZSB0aGF0IGRlZmluZXMgcm91dGUgaGFuZGxlcnMgYW5kIGNsaWVudCBvcHRpb25zLlxuZXhwb3J0IGRlZmF1bHQgbmV3IFNlcnZpY2Uoe1xuICBjbGllbnRzLFxuICByb3V0ZXM6IHtcbiAgICAvLyBgc3RhdHVzYCBpcyB0aGUgcm91dGUgSUQgZnJvbSBzZXJ2aWNlLmpzb24uIEl0IG1hcHMgdG8gYW4gYXJyYXkgb2YgbWlkZGxld2FyZXMgKG9yIGEgc2luZ2xlIGhhbmRsZXIpLlxuICAgIGdldE9yZGVyczogbWV0aG9kKHtcbiAgICAgIFBPU1Q6IFtnZXRPcmRlcnNdLFxuICAgIH0pLFxuICAgIGFiYW5kb25lZENhcnQ6IG1ldGhvZCh7XG4gICAgICBQT1NUOiBbcHJvY2Vzc0FiYW5kb25lZENhcnRdLFxuICAgIH0pLFxuICAgIHBpbmc6IG1ldGhvZCh7XG4gICAgICBHRVQ6IFtwb25nXSxcbiAgICB9KSxcbiAgfSxcbn0pXG4iXX0=