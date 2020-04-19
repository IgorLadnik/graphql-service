import { ILogger } from './logger';
import { IGqlProvider, GqlProvider } from './gqlProvider';
import _ from 'lodash';

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
        contextVar[`${field.arrPath[0]}-0`] = results;
    }

    resolveFunc1 = async (gql: IGqlProvider, field: any, query: string,
                          args: any, contextConst: any, contextVar: any): Promise<void> => {
        const fullFieldPath = GqlProvider.composeFullFieldPath(field.arrPath);
        const type = gql.findRegisteredType(field.typeName);
        this.logger.log(`common resolveFunc for ${fullFieldPath}`);
        const sql = contextConst['sql'];
        const level = field.arrPath.length - 1;

        let count = 0;
        let parents: any;
        while (!_.isNil(parents = contextVar[`${field.arrPath[level - 1]}-${count}`])) {
            const levelFieldName = field.arrPath[level];
            for (let i = 0; i < parents.length; i++) {
                const parent = parents[i];

                const rs = await sql.query(TypesCommon.tuneQueryString(query, parent));

                parent[levelFieldName] = new Array<any>();
                contextVar[levelFieldName] = new Array<any>();
                rs.forEach((item: any) => {
                    contextVar[`${type.type}_data`] = item;
                    type.resolveFunc(field, args, contextConst, contextVar);
                    parent[levelFieldName].push(contextVar[`${type.type}_data`]);
                });

                contextVar[`${levelFieldName}-${i}`] = parent[levelFieldName];
            }

            count++;
        }
    }

    filter = (typeName: string, contextVar: any) => {
        const strData = `${typeName}_data`;
        const strProperties = `${typeName}_properties`;
        const inObj = contextVar[strData];
        const properties = contextVar[strProperties];
        const outObj = TypesCommon.filterObject(inObj, properties);
        contextVar[strData] = outObj;
        this.logger.log(`filter() for type ${typeName}`);
    }

    static filterObject = (objOrg: any, properties: Array<string>): any => {
        const objOut: any = { };
        properties.forEach((p: string) => objOut[p] = objOrg[p]);
        return objOut;
    }

    private static tuneQueryString = (query: string, parent: any): string => {
        let result = query;
        const tokenized = query.split('${', 10);
        tokenized.forEach((str: string) => {
            const index = str.indexOf('}');
            if (index > -1) {
                const toBeReplaced = str.substring(0, index);
                const someId = toBeReplaced.split('.')[1];
                const val = parent[`${someId}`];
                result = result.replace('${' + `${toBeReplaced}` + '}', `${val}`);
            }
        });

        return result;
    }
}
