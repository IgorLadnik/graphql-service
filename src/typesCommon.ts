import { ILogger } from './logger';

export class TypesCommon {
    private static readonly pathDelim = '.';

    constructor(private logger: ILogger) { }

    resolveFunc0 = async (fullFieldPath: string, query: string,
                          contextConst: any, contextVar: any): Promise<void> => {
        this.logger.log(`common resolveFunc for ${fullFieldPath}`);
        const sql = contextConst['sql'];
        const rs = await sql.query(query);
        const results = new Array<any>();
        rs.forEach((item: any) => results.push(item));
        contextVar[`${fullFieldPath}`] = results;
    }

    resolveFunc1 = async (fullFieldPath: string, type: any, query: string,
                          actionTree: any, args: any, contextConst: any, contextVar: any): Promise<void> => {
        this.logger.log(`common resolveFunc for ${fullFieldPath}`);
        const sql = contextConst['sql'];
        const arrPath = fullFieldPath.split(TypesCommon.pathDelim);
        const level = arrPath.length - 1;
        const parents = contextVar[arrPath[0]];
        for (let  i = 0; i < parents.length; i++) {
            const parent = parents[i];
            const rs = await sql.query(query.replace('${parent.id}', `${parent.id}`));

            parent[arrPath[1]] = new Array<any>();
            rs.forEach((item: any) => {
                contextVar[`${type.type}_data`] = item;
                type.resolveFunc(actionTree, args, contextConst, contextVar);
                parent[arrPath[1]].push(contextVar[`${type.type}_data`]);
            });
        }
    }

    filter = (typeName: string, contextVar: any) => {
        const strData = `${typeName}_data`;
        const strProperties = `${typeName}_properties`;
        let inItem = contextVar[strData];
        const outItem: any = { };
        contextVar[strProperties].forEach((p: string) => outItem[p] = inItem[p]);
        contextVar[strData] = outItem;
        this.logger.log(`filter() for type ${typeName}`);
    }
}
