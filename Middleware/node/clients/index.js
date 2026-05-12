"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Clients = void 0;
const api_1 = require("@vtex/api");
const status_1 = __importDefault(require("./status"));
// Extend the default IOClients implementation with our own custom clients.
class Clients extends api_1.IOClients {
    get status() {
        return this.getOrSet('status', status_1.default);
    }
}
exports.Clients = Clients;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxtQ0FBcUM7QUFFckMsc0RBQTZCO0FBRTdCLDJFQUEyRTtBQUMzRSxNQUFhLE9BQVEsU0FBUSxlQUFTO0lBQ3BDLElBQVcsTUFBTTtRQUNmLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsZ0JBQU0sQ0FBQyxDQUFBO0lBQ3hDLENBQUM7Q0FDRjtBQUpELDBCQUlDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSU9DbGllbnRzIH0gZnJvbSAnQHZ0ZXgvYXBpJ1xyXG5cclxuaW1wb3J0IFN0YXR1cyBmcm9tICcuL3N0YXR1cydcclxuXHJcbi8vIEV4dGVuZCB0aGUgZGVmYXVsdCBJT0NsaWVudHMgaW1wbGVtZW50YXRpb24gd2l0aCBvdXIgb3duIGN1c3RvbSBjbGllbnRzLlxyXG5leHBvcnQgY2xhc3MgQ2xpZW50cyBleHRlbmRzIElPQ2xpZW50cyB7XHJcbiAgcHVibGljIGdldCBzdGF0dXMoKSB7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRPclNldCgnc3RhdHVzJywgU3RhdHVzKVxyXG4gIH1cclxufVxyXG4iXX0=