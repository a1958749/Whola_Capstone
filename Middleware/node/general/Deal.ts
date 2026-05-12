/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
export class Deal {
  dealName: string = ''
  dealStage: string = ''
  contactId: string = ''
  amount: string = ''
  closedate: string = ''
  itemlines: string[]
  companyIds: string[]


  // eslint-disable-next-line max-params
  constructor(name: string, stage: string, Amount: string, CloseDate: string) {
    this.itemlines = []
    this.companyIds = []
    this.dealName = name
    this.dealStage = stage
    this.amount = Amount
    this.closedate = CloseDate
  }

  addContactId(ContactId: string): void {
    this.contactId = ContactId
  }

  addItemLine(Itemlines1: string): void {
    this.itemlines.push(Itemlines1)
  }

  addCompanyId(companys1: string): void {
    this.companyIds.push(companys1)
  }
}
