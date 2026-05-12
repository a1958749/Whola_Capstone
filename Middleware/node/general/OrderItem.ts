/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable prettier/prettier */
/* eslint-disable max-params */
export class OrderItem{
  sku: string
  qty: string
  seller: string
  price: string
  name: string

  constructor(Sku: string, Qty: string, Seller: string,Price: string,Name: string) {
    this.sku = Sku
    this.qty = Qty
    this.seller = Seller
    this.price = Price
    this.name = Name
  }
}
