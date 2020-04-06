export class Something {
    constructor(public n: number) { }

    do(): Something {
        console.log(`from Something: n = ${this.n}`);
        return this;
    }
}
