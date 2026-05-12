"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("@vtex/api");
class Status extends api_1.ExternalClient {
    constructor(context, options) {
        super('http://httpstat.us', context, options);
    }
    async getStatus(status) {
        return this.http.get(status.toString(), {
            metric: 'status-get',
        });
    }
    async getStatusWithHeaders(status) {
        return this.http.getRaw(status.toString(), {
            metric: 'status-get-raw',
        });
    }
}
exports.default = Status;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic3RhdHVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQ0EsbUNBQTBDO0FBRTFDLE1BQXFCLE1BQU8sU0FBUSxvQkFBYztJQUNoRCxZQUFZLE9BQWtCLEVBQUUsT0FBeUI7UUFDdkQsS0FBSyxDQUFDLG9CQUFvQixFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQTtJQUMvQyxDQUFDO0lBRU0sS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFjO1FBQ25DLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxFQUFFO1lBQ3RDLE1BQU0sRUFBRSxZQUFZO1NBQ3JCLENBQUMsQ0FBQTtJQUNKLENBQUM7SUFFTSxLQUFLLENBQUMsb0JBQW9CLENBQy9CLE1BQWM7UUFFZCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsRUFBRTtZQUN6QyxNQUFNLEVBQUUsZ0JBQWdCO1NBQ3pCLENBQUMsQ0FBQTtJQUNKLENBQUM7Q0FDRjtBQWxCRCx5QkFrQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHlwZSB7IEluc3RhbmNlT3B0aW9ucywgSU9Db250ZXh0LCBJT1Jlc3BvbnNlIH0gZnJvbSAnQHZ0ZXgvYXBpJ1xyXG5pbXBvcnQgeyBFeHRlcm5hbENsaWVudCB9IGZyb20gJ0B2dGV4L2FwaSdcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFN0YXR1cyBleHRlbmRzIEV4dGVybmFsQ2xpZW50IHtcclxuICBjb25zdHJ1Y3Rvcihjb250ZXh0OiBJT0NvbnRleHQsIG9wdGlvbnM/OiBJbnN0YW5jZU9wdGlvbnMpIHtcclxuICAgIHN1cGVyKCdodHRwOi8vaHR0cHN0YXQudXMnLCBjb250ZXh0LCBvcHRpb25zKVxyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIGdldFN0YXR1cyhzdGF0dXM6IG51bWJlcik6IFByb21pc2U8c3RyaW5nPiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLmdldChzdGF0dXMudG9TdHJpbmcoKSwge1xyXG4gICAgICBtZXRyaWM6ICdzdGF0dXMtZ2V0JyxcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYXN5bmMgZ2V0U3RhdHVzV2l0aEhlYWRlcnMoXHJcbiAgICBzdGF0dXM6IG51bWJlclxyXG4gICk6IFByb21pc2U8SU9SZXNwb25zZTxzdHJpbmc+PiB7XHJcbiAgICByZXR1cm4gdGhpcy5odHRwLmdldFJhdyhzdGF0dXMudG9TdHJpbmcoKSwge1xyXG4gICAgICBtZXRyaWM6ICdzdGF0dXMtZ2V0LXJhdycsXHJcbiAgICB9KVxyXG4gIH1cclxufVxyXG4iXX0=