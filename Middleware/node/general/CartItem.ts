export class CartItem {
  sku: string
  qty: string
  seller: string

  constructor(Sku: string, Qty: string, Seller: string) {
    this.sku = Sku
    this.qty = Qty
    this.seller = Seller
  }
}
