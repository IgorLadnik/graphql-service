import { ILogger } from './logger';

export class TypesCommon {
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

    filter = (typeName: string, contextVar: any) => {
        const strData = `${typeName}_data`;
        const strProperties = `${typeName}_properties`;
        let inItem = contextVar[strData];
        const outItem: any = { };
        contextVar[strProperties].forEach((p: string) => outItem[p] = inItem[p]);
        contextVar[strData] = outItem;
        this.logger.log('resolve() for type ${typeName}');
    }
}
