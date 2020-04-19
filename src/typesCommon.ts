import { ILogger } from './logger';
import { IGqlProvider, GqlProvider } from './gqlProvider';

export class TypesCommon {
    private static readonly pathDelim = '.';

    constructor(private logger: ILogger) { }

    resolveFunc0 = async (field: any, query: string,
                          contextConst: any, contextVar: any): Promise<void> => {
        this.logger.log(`common resolveFunc for ${field.arrPath[0]}`);
        const sql = contextConst['sql'];
        const rs = await sql.query(query);
        const results = new Array<any>();
        rs.forEach((item: any) => results.push(item));
        contextVar[field.arrPath[0]] = results;
    }

    resolveFunc1 = async (gql: IGqlProvider, field: any, query: string,
                          args: any, contextConst: any, contextVar: any): Promise<void> => {
        const fullFieldPath = GqlProvider.composeFullFieldPath(field.arrPath);
        const type = gql.findRegisteredType(field.typeName);
        this.logger.log(`common resolveFunc for ${fullFieldPath}`);
        const sql = contextConst['sql'];
        const parents = contextVar[field.arrPath[0]];

        //contextVar[`${type.type}_properties`] = field.children.map((c: any) => c.fieldName);

        for (let  i = 0; i < parents.length; i++) {
            const parent = parents[i];
            const rs = await sql.query(query.replace('${parent.id}', `${parent.id}`));

            parent[field.arrPath[1]] = new Array<any>();
            rs.forEach((item: any) => {
                contextVar[`${type.type}_data`] = item;
                type.resolveFunc(field, args, contextConst, contextVar);
                parent[field.arrPath[1]].push(contextVar[`${type.type}_data`]);
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
