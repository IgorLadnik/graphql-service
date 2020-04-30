export class Utils {
    static readonly pathDelim = '.';
    static readonly handlerIdPrefix = 'handlerIdPrefix';

    static composeFullFieldPath = (arrPath: Array<string>): string =>
        arrPath.reduce((a, c) => a + `${Utils.pathDelim}${c}`)
}