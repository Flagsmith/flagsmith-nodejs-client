export class TraitModel {
    traitKey: string | null;
    traitValue: any;

    constructor(key: string | null, value: any) {
        this.traitKey = key;
        this.traitValue = value;
    }
}
