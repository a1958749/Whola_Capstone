export class Result {
  status: number;
  message: string;
  data: any;
  constructor() {
      this.status = 200;
      this.message = "";
  }

  error(message:string,data:any):void{
      this.status=500;
      this.message=message;
      this.data=data;
  }

  ok(data:any):void{
      this.status=200;
      this.data=data;
  }

  result(status:number,message:string,data:any):void{
      this.status=status;
      this.message=message;
      this.data=data;
  }
}

