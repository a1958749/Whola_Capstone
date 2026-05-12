"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Deal = void 0;
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-inferrable-types */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
class Deal {
    // eslint-disable-next-line max-params
    constructor(name, stage, Amount, CloseDate) {
        this.dealName = '';
        this.dealStage = '';
        this.contactId = '';
        this.amount = '';
        this.closedate = '';
        this.itemlines = [];
        this.companyIds = [];
        this.dealName = name;
        this.dealStage = stage;
        this.amount = Amount;
        this.closedate = CloseDate;
    }
    addContactId(ContactId) {
        this.contactId = ContactId;
    }
    addItemLine(Itemlines1) {
        this.itemlines.push(Itemlines1);
    }
    addCompanyId(companys1) {
        this.companyIds.push(companys1);
    }
}
exports.Deal = Deal;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRGVhbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIkRlYWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsc0NBQXNDO0FBQ3RDLDJEQUEyRDtBQUMzRCxxRUFBcUU7QUFDckUsTUFBYSxJQUFJO0lBVWYsc0NBQXNDO0lBQ3RDLFlBQVksSUFBWSxFQUFFLEtBQWEsRUFBRSxNQUFjLEVBQUUsU0FBaUI7UUFWMUUsYUFBUSxHQUFXLEVBQUUsQ0FBQTtRQUNyQixjQUFTLEdBQVcsRUFBRSxDQUFBO1FBQ3RCLGNBQVMsR0FBVyxFQUFFLENBQUE7UUFDdEIsV0FBTSxHQUFXLEVBQUUsQ0FBQTtRQUNuQixjQUFTLEdBQVcsRUFBRSxDQUFBO1FBT3BCLElBQUksQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFBO1FBQ25CLElBQUksQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFBO1FBQ3BCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFBO1FBQ3BCLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFBO1FBQ3RCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFBO1FBQ3BCLElBQUksQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFBO0lBQzVCLENBQUM7SUFFRCxZQUFZLENBQUMsU0FBaUI7UUFDNUIsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUE7SUFDNUIsQ0FBQztJQUVELFdBQVcsQ0FBQyxVQUFrQjtRQUM1QixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQTtJQUNqQyxDQUFDO0lBRUQsWUFBWSxDQUFDLFNBQWlCO1FBQzVCLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFBO0lBQ2pDLENBQUM7Q0FDRjtBQS9CRCxvQkErQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBlc2xpbnQtZGlzYWJsZSBwcmV0dGllci9wcmV0dGllciAqL1xyXG4vKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8taW5mZXJyYWJsZS10eXBlcyAqL1xyXG4vKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvZXhwbGljaXQtbWVtYmVyLWFjY2Vzc2liaWxpdHkgKi9cclxuZXhwb3J0IGNsYXNzIERlYWwge1xyXG4gIGRlYWxOYW1lOiBzdHJpbmcgPSAnJ1xyXG4gIGRlYWxTdGFnZTogc3RyaW5nID0gJydcclxuICBjb250YWN0SWQ6IHN0cmluZyA9ICcnXHJcbiAgYW1vdW50OiBzdHJpbmcgPSAnJ1xyXG4gIGNsb3NlZGF0ZTogc3RyaW5nID0gJydcclxuICBpdGVtbGluZXM6IHN0cmluZ1tdXHJcbiAgY29tcGFueUlkczogc3RyaW5nW11cclxuXHJcblxyXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtcGFyYW1zXHJcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBzdGFnZTogc3RyaW5nLCBBbW91bnQ6IHN0cmluZywgQ2xvc2VEYXRlOiBzdHJpbmcpIHtcclxuICAgIHRoaXMuaXRlbWxpbmVzID0gW11cclxuICAgIHRoaXMuY29tcGFueUlkcyA9IFtdXHJcbiAgICB0aGlzLmRlYWxOYW1lID0gbmFtZVxyXG4gICAgdGhpcy5kZWFsU3RhZ2UgPSBzdGFnZVxyXG4gICAgdGhpcy5hbW91bnQgPSBBbW91bnRcclxuICAgIHRoaXMuY2xvc2VkYXRlID0gQ2xvc2VEYXRlXHJcbiAgfVxyXG5cclxuICBhZGRDb250YWN0SWQoQ29udGFjdElkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRoaXMuY29udGFjdElkID0gQ29udGFjdElkXHJcbiAgfVxyXG5cclxuICBhZGRJdGVtTGluZShJdGVtbGluZXMxOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRoaXMuaXRlbWxpbmVzLnB1c2goSXRlbWxpbmVzMSlcclxuICB9XHJcblxyXG4gIGFkZENvbXBhbnlJZChjb21wYW55czE6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5jb21wYW55SWRzLnB1c2goY29tcGFueXMxKVxyXG4gIH1cclxufVxyXG4iXX0=