export class Utils {
    static readonly pathDelim = '.';
    static readonly handlerIdPrefix = 'handlerIdPrefix';

    static composeFullFieldPath = (arrPath: Array<string>): string =>
        arrPath.reduce((a, c) => a + `${Utils.pathDelim}${c}`)
}

// export function annotateName(target: any, name: any, desc: any) {
//     let method = desc.value;
//     desc.value = function () {
//         let prevMethod = this.currentMethod;
//         this.currentMethod = name;
//         method.apply(this, arguments);
//         this.currentMethod = prevMethod;
//     }
// }