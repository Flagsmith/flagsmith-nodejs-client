export class TraitModel {
    traitKey: string;
    traitValue: any;
    constructor(key: string, value: any, transient: boolean = false) {
        this.traitKey = key;
        this.traitValue = value;
    }
}
