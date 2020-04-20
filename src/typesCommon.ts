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
        const parent: any = { };
        const fieldName = field.arrPath[0];
        parent[fieldName] = results;
        contextVar[`${fieldName}-0`] = parent;
    }

    resolveFunc1 = async (gql: IGqlProvider, field: any, query: string,
                          args: any, contextConst: any, contextVar: any): Promise<void> => {
        const fullFieldPath = GqlProvider.composeFullFieldPath(field.arrPath);
        const type = gql.findRegisteredType(field.typeName);
        this.logger.log(`common resolveFunc for ${fullFieldPath}`);
        const sql = contextConst['sql'];
        const level = field.arrPath.length - 1;

        let count = 0;
        let parentsObj: any;
        const fieldName = field.arrPath[level - 1];
        while (!_.isNil(parentsObj = contextVar[`${fieldName}-${count}`])) {
            let parents = parentsObj[fieldName];
            const levelFieldName = field.arrPath[level];
            for (let i = 0; i < parents.length; i++) {
                const parent = parents[i];

                const rs = await sql.query(TypesCommon.tuneQueryString(query, parent));

                parent[levelFieldName] = new Array<any>();
                contextVar[levelFieldName] = new Array<any>();
                rs.forEach((item: any) => {
                    const dataName = `${type.type}_data`;
                    contextVar[dataName] = item;
                    type.resolveFunc(field, args, contextConst, contextVar);
                    const updatedItem = contextVar[dataName];
                    if (field.isArray)
                        parent[levelFieldName].push(updatedItem);
                    else
                        parent[levelFieldName] = updatedItem;
                });

                contextVar[`${levelFieldName}-${i}`] = { };
                contextVar[`${levelFieldName}-${i}`][levelFieldName] = parent[levelFieldName];
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
