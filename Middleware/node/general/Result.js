"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Result = void 0;
class Result {
    constructor() {
        this.status = 200;
        this.message = "";
    }
    error(message, data) {
        this.status = 500;
        this.message = message;
        this.data = data;
    }
    ok(data) {
        this.status = 200;
        this.data = data;
    }
    result(status, message, data) {
        this.status = status;
        this.message = message;
        this.data = data;
    }
}
exports.Result = Result;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUmVzdWx0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiUmVzdWx0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLE1BQWEsTUFBTTtJQUlqQjtRQUNJLElBQUksQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDO1FBQ2xCLElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO0lBQ3RCLENBQUM7SUFFRCxLQUFLLENBQUMsT0FBYyxFQUFDLElBQVE7UUFDekIsSUFBSSxDQUFDLE1BQU0sR0FBQyxHQUFHLENBQUM7UUFDaEIsSUFBSSxDQUFDLE9BQU8sR0FBQyxPQUFPLENBQUM7UUFDckIsSUFBSSxDQUFDLElBQUksR0FBQyxJQUFJLENBQUM7SUFDbkIsQ0FBQztJQUVELEVBQUUsQ0FBQyxJQUFRO1FBQ1AsSUFBSSxDQUFDLE1BQU0sR0FBQyxHQUFHLENBQUM7UUFDaEIsSUFBSSxDQUFDLElBQUksR0FBQyxJQUFJLENBQUM7SUFDbkIsQ0FBQztJQUVELE1BQU0sQ0FBQyxNQUFhLEVBQUMsT0FBYyxFQUFDLElBQVE7UUFDeEMsSUFBSSxDQUFDLE1BQU0sR0FBQyxNQUFNLENBQUM7UUFDbkIsSUFBSSxDQUFDLE9BQU8sR0FBQyxPQUFPLENBQUM7UUFDckIsSUFBSSxDQUFDLElBQUksR0FBQyxJQUFJLENBQUM7SUFDbkIsQ0FBQztDQUNGO0FBekJELHdCQXlCQyIsInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjbGFzcyBSZXN1bHQge1xyXG4gIHN0YXR1czogbnVtYmVyO1xyXG4gIG1lc3NhZ2U6IHN0cmluZztcclxuICBkYXRhOiBhbnk7XHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgIHRoaXMuc3RhdHVzID0gMjAwO1xyXG4gICAgICB0aGlzLm1lc3NhZ2UgPSBcIlwiO1xyXG4gIH1cclxuXHJcbiAgZXJyb3IobWVzc2FnZTpzdHJpbmcsZGF0YTphbnkpOnZvaWR7XHJcbiAgICAgIHRoaXMuc3RhdHVzPTUwMDtcclxuICAgICAgdGhpcy5tZXNzYWdlPW1lc3NhZ2U7XHJcbiAgICAgIHRoaXMuZGF0YT1kYXRhO1xyXG4gIH1cclxuXHJcbiAgb2soZGF0YTphbnkpOnZvaWR7XHJcbiAgICAgIHRoaXMuc3RhdHVzPTIwMDtcclxuICAgICAgdGhpcy5kYXRhPWRhdGE7XHJcbiAgfVxyXG5cclxuICByZXN1bHQoc3RhdHVzOm51bWJlcixtZXNzYWdlOnN0cmluZyxkYXRhOmFueSk6dm9pZHtcclxuICAgICAgdGhpcy5zdGF0dXM9c3RhdHVzO1xyXG4gICAgICB0aGlzLm1lc3NhZ2U9bWVzc2FnZTtcclxuICAgICAgdGhpcy5kYXRhPWRhdGE7XHJcbiAgfVxyXG59XHJcblxyXG4iXX0=