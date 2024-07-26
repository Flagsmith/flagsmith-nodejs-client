export class TraitModel {
    traitKey: string;
    traitValue: any;
    transient?: boolean;
    constructor(key: string, value: any, transient: boolean = false) {
        this.traitKey = key;
        this.traitValue = value;
        this.transient = transient;
    }
}
