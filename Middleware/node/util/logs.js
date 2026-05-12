"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogsSchema = createLogsSchema;
exports.addLog = addLog;
const DATA_ENTITY = 'hubspot_logs';
const SCHEMA = 'hubspot';
async function createLogsSchema(ctx) {
    var _a;
    const { clients: { masterdata }, } = ctx;
    try {
        const schema = await masterdata.getSchema({
            dataEntity: DATA_ENTITY,
            schema: SCHEMA,
        });
        if (!schema) {
            await masterdata.createOrUpdateSchema({
                dataEntity: DATA_ENTITY,
                schemaName: SCHEMA,
                schemaBody: {
                    properties: {
                        orderId: {
                            type: 'string',
                            title: 'Vtex Order Id',
                        },
                        message: {
                            type: 'string',
                            title: 'Message',
                        },
                        body: {
                            type: 'string',
                            title: 'Body',
                        },
                    },
                    'v-indexed': ['orderId'],
                    'v-security': {
                        allowGetAll: false,
                        publicRead: ['id', 'orderId', 'message', 'body'],
                        publicWrite: ['orderId', 'message', 'body'],
                        publicFilter: ['orderId', 'message', 'body'],
                    },
                },
            });
        }
        return {
            isError: false,
        };
    }
    catch (e) {
        console.log(e.message);
        console.log(e.response);
        if (((_a = e.response) === null || _a === void 0 ? void 0 : _a.status) === 304) {
            return { isError: false };
        }
        return {
            isError: true,
        };
    }
}
async function addLog(ctx, log) {
    var _a, _b, _c;
    const { clients: { masterdata }, } = ctx;
    console.log('ADD LOG', log);
    try {
        await masterdata.createDocument({
            dataEntity: DATA_ENTITY,
            schema: SCHEMA,
            fields: {
                orderId: (_a = log.orderId) !== null && _a !== void 0 ? _a : '',
                message: (_b = log.message) !== null && _b !== void 0 ? _b : '',
                body: (_c = log.body) !== null && _c !== void 0 ? _c : '',
            },
        });
    }
    catch (e) {
        console.log('Error in the addLog function', e.message);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9ncy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImxvZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFHQSw0Q0FzREM7QUFFRCx3QkE0QkM7QUF2RkQsTUFBTSxXQUFXLEdBQUcsY0FBYyxDQUFDO0FBQ25DLE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQztBQUVsQixLQUFLLFVBQVUsZ0JBQWdCLENBQUMsR0FBUTs7SUFDN0MsTUFBTSxFQUNKLE9BQU8sRUFBRSxFQUFFLFVBQVUsRUFBRSxHQUN4QixHQUFHLEdBQUcsQ0FBQztJQUVSLElBQUksQ0FBQztRQUNILE1BQU0sTUFBTSxHQUFHLE1BQU0sVUFBVSxDQUFDLFNBQVMsQ0FBQztZQUN4QyxVQUFVLEVBQUUsV0FBVztZQUN2QixNQUFNLEVBQUUsTUFBTTtTQUNmLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNaLE1BQU0sVUFBVSxDQUFDLG9CQUFvQixDQUFDO2dCQUNwQyxVQUFVLEVBQUUsV0FBVztnQkFDdkIsVUFBVSxFQUFFLE1BQU07Z0JBQ2xCLFVBQVUsRUFBRTtvQkFDVixVQUFVLEVBQUU7d0JBQ1YsT0FBTyxFQUFFOzRCQUNQLElBQUksRUFBRSxRQUFROzRCQUNkLEtBQUssRUFBRSxlQUFlO3lCQUN2Qjt3QkFDRCxPQUFPLEVBQUU7NEJBQ1AsSUFBSSxFQUFFLFFBQVE7NEJBQ2QsS0FBSyxFQUFFLFNBQVM7eUJBQ2pCO3dCQUNELElBQUksRUFBRTs0QkFDSixJQUFJLEVBQUUsUUFBUTs0QkFDZCxLQUFLLEVBQUUsTUFBTTt5QkFDZDtxQkFDRjtvQkFDRCxXQUFXLEVBQUUsQ0FBQyxTQUFTLENBQUM7b0JBQ3hCLFlBQVksRUFBRTt3QkFDWixXQUFXLEVBQUUsS0FBSzt3QkFDbEIsVUFBVSxFQUFFLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsTUFBTSxDQUFDO3dCQUNoRCxXQUFXLEVBQUUsQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLE1BQU0sQ0FBQzt3QkFDM0MsWUFBWSxFQUFFLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUM7cUJBQzdDO2lCQUNGO2FBQ0YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELE9BQU87WUFDTCxPQUFPLEVBQUUsS0FBSztTQUNmLENBQUM7SUFDSixDQUFDO0lBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUNYLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZCLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3hCLElBQUksQ0FBQSxNQUFBLENBQUMsQ0FBQyxRQUFRLDBDQUFFLE1BQU0sTUFBSyxHQUFHLEVBQUUsQ0FBQztZQUMvQixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO1FBQzVCLENBQUM7UUFDRCxPQUFPO1lBQ0wsT0FBTyxFQUFFLElBQUk7U0FDZCxDQUFDO0lBQ0osQ0FBQztBQUNILENBQUM7QUFFTSxLQUFLLFVBQVUsTUFBTSxDQUMxQixHQUFRLEVBQ1IsR0FJQzs7SUFFRCxNQUFNLEVBQ0osT0FBTyxFQUFFLEVBQUUsVUFBVSxFQUFFLEdBQ3hCLEdBQUcsR0FBRyxDQUFDO0lBRVIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFFNUIsSUFBSSxDQUFDO1FBQ0gsTUFBTSxVQUFVLENBQUMsY0FBYyxDQUFDO1lBQzVCLFVBQVUsRUFBRSxXQUFXO1lBQ3ZCLE1BQU0sRUFBRSxNQUFNO1lBQ2QsTUFBTSxFQUFFO2dCQUNOLE9BQU8sRUFBRSxNQUFBLEdBQUcsQ0FBQyxPQUFPLG1DQUFJLEVBQUU7Z0JBQzFCLE9BQU8sRUFBRSxNQUFBLEdBQUcsQ0FBQyxPQUFPLG1DQUFJLEVBQUU7Z0JBQzFCLElBQUksRUFBRSxNQUFBLEdBQUcsQ0FBQyxJQUFJLG1DQUFJLEVBQUU7YUFDckI7U0FDRixDQUFDLENBQUM7SUFDUCxDQUFDO0lBQ0QsT0FBTSxDQUFDLEVBQUUsQ0FBQztRQUNSLE9BQU8sQ0FBQyxHQUFHLENBQUMsOEJBQThCLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFBO0lBQ3hELENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgREFUQV9FTlRJVFkgPSAnaHVic3BvdF9sb2dzJztcclxuY29uc3QgU0NIRU1BID0gJ2h1YnNwb3QnO1xyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUxvZ3NTY2hlbWEoY3R4OiBhbnkpIHtcclxuICBjb25zdCB7XHJcbiAgICBjbGllbnRzOiB7IG1hc3RlcmRhdGEgfSxcclxuICB9ID0gY3R4O1xyXG5cclxuICB0cnkge1xyXG4gICAgY29uc3Qgc2NoZW1hID0gYXdhaXQgbWFzdGVyZGF0YS5nZXRTY2hlbWEoe1xyXG4gICAgICBkYXRhRW50aXR5OiBEQVRBX0VOVElUWSxcclxuICAgICAgc2NoZW1hOiBTQ0hFTUEsXHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgaWYgKCFzY2hlbWEpIHtcclxuICAgICAgYXdhaXQgbWFzdGVyZGF0YS5jcmVhdGVPclVwZGF0ZVNjaGVtYSh7XHJcbiAgICAgICAgZGF0YUVudGl0eTogREFUQV9FTlRJVFksXHJcbiAgICAgICAgc2NoZW1hTmFtZTogU0NIRU1BLFxyXG4gICAgICAgIHNjaGVtYUJvZHk6IHtcclxuICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgb3JkZXJJZDoge1xyXG4gICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgIHRpdGxlOiAnVnRleCBPcmRlciBJZCcsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIG1lc3NhZ2U6IHtcclxuICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICB0aXRsZTogJ01lc3NhZ2UnLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBib2R5OiB7XHJcbiAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgdGl0bGU6ICdCb2R5JyxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICAndi1pbmRleGVkJzogWydvcmRlcklkJ10sXHJcbiAgICAgICAgICAndi1zZWN1cml0eSc6IHtcclxuICAgICAgICAgICAgYWxsb3dHZXRBbGw6IGZhbHNlLFxyXG4gICAgICAgICAgICBwdWJsaWNSZWFkOiBbJ2lkJywgJ29yZGVySWQnLCAnbWVzc2FnZScsICdib2R5J10sXHJcbiAgICAgICAgICAgIHB1YmxpY1dyaXRlOiBbJ29yZGVySWQnLCAnbWVzc2FnZScsICdib2R5J10sXHJcbiAgICAgICAgICAgIHB1YmxpY0ZpbHRlcjogWydvcmRlcklkJywgJ21lc3NhZ2UnLCAnYm9keSddLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBpc0Vycm9yOiBmYWxzZSxcclxuICAgIH07XHJcbiAgfSBjYXRjaCAoZSkge1xyXG4gICAgY29uc29sZS5sb2coZS5tZXNzYWdlKTtcclxuICAgIGNvbnNvbGUubG9nKGUucmVzcG9uc2UpO1xyXG4gICAgaWYgKGUucmVzcG9uc2U/LnN0YXR1cyA9PT0gMzA0KSB7XHJcbiAgICAgIHJldHVybiB7IGlzRXJyb3I6IGZhbHNlIH07XHJcbiAgICB9XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBpc0Vycm9yOiB0cnVlLFxyXG4gICAgfTtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhZGRMb2coXHJcbiAgY3R4OiBhbnksXHJcbiAgbG9nOiB7XHJcbiAgICBvcmRlcklkOiBzdHJpbmcgfCBudWxsO1xyXG4gICAgbWVzc2FnZTogc3RyaW5nIHwgbnVsbDtcclxuICAgIGJvZHk6IHN0cmluZyB8IG51bGw7XHJcbiAgfSxcclxuKSB7XHJcbiAgY29uc3Qge1xyXG4gICAgY2xpZW50czogeyBtYXN0ZXJkYXRhIH0sXHJcbiAgfSA9IGN0eDtcclxuXHJcbiAgY29uc29sZS5sb2coJ0FERCBMT0cnLCBsb2cpO1xyXG5cclxuICB0cnkgeyBcclxuICAgIGF3YWl0IG1hc3RlcmRhdGEuY3JlYXRlRG9jdW1lbnQoe1xyXG4gICAgICAgIGRhdGFFbnRpdHk6IERBVEFfRU5USVRZLFxyXG4gICAgICAgIHNjaGVtYTogU0NIRU1BLFxyXG4gICAgICAgIGZpZWxkczoge1xyXG4gICAgICAgICAgb3JkZXJJZDogbG9nLm9yZGVySWQgPz8gJycsXHJcbiAgICAgICAgICBtZXNzYWdlOiBsb2cubWVzc2FnZSA/PyAnJyxcclxuICAgICAgICAgIGJvZHk6IGxvZy5ib2R5ID8/ICcnLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0pO1xyXG4gIH1cclxuICBjYXRjaChlKSB7XHJcbiAgICBjb25zb2xlLmxvZygnRXJyb3IgaW4gdGhlIGFkZExvZyBmdW5jdGlvbicsIGUubWVzc2FnZSlcclxuICB9XHJcbn1cclxuIl19