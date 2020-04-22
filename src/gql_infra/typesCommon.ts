import { ILogger } from '../logger';
import { IGqlProvider, GqlProvider, FieldDescription } from './gqlProvider';
import _ from 'lodash';

export class TypesCommon {
    constructor(private logger: ILogger) { }

    resolveFunc01 = async (gql: IGqlProvider, field: any, args: any, contextConst: any, contextVar: any,
                           queryFn: Function): Promise<void> => {
        const fullFieldPath = GqlProvider.composeFullFieldPath(field.arrPath);
        const type = gql.findRegisteredType(field.typeName);
        this.logger.log(`common resolveFunc for ${fullFieldPath}`);
        const level = field.arrPath.length - 1;

        let count = 0;
        let parentsObj: any;
        const fieldName = level === 0 ? fullFieldPath : field.arrPath[level - 1];

        if (level === 0)
            contextVar[`${fieldName}-${count}`] = { };

        while (!_.isNil(parentsObj = contextVar[`${fieldName}-${count}`])) {
            let parents = parentsObj[fieldName];
            const levelFieldName = field.arrPath[level];
            const n = _.isNil(parents) || parents.length === 0 ? 1 : parents.length;
            for (let i = 0; i < n; i++) {
                const parent: any = _.isNil(parents) ? { } : parents[i];

                const items = await queryFn(field, args, contextConst, contextVar, parent);

                parent[levelFieldName] = new Array<any>();
                contextVar[levelFieldName] = new Array<any>();
                items.forEach((item: any) => {
                    const dataName = `${type.type}_data`;
                    contextVar[dataName] = item;
                    type.resolveFunc(field, args, contextConst, contextVar);
                    const updatedItem = contextVar[dataName];
                    if (field.isArray)
                        parent[levelFieldName].push(updatedItem);
                    else
                        parent[levelFieldName] = updatedItem;
                });

                contextVar[`${fieldName}_array`]?.push(parent);

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
        if (_.isNil(inObj))
            return;

        const properties = contextVar[strProperties];
        const outObj = TypesCommon.filterInner(inObj, properties);
        contextVar[strData] = outObj;
        this.logger.log(`filter() for type ${typeName}`);
    }

    private static filterInner = (objOrg: any, properties: Array<string>): any => {
        if (_.isNil(properties))
            return objOrg;

        const objOut: any = { };
        properties.forEach((p: string) => objOut[p] = objOrg[p]);
        return objOut;
    }

    static filterObject = (fieldName: string, contextVar: any) => {
        const properties = contextVar[`${fieldName}_properties`];
        const arr = contextVar[`${fieldName}_array`];
        if (properties?.length === 0 || arr?.length === 0)
            return;

        for (let i = 0; i < arr.length; i++)
            for (let objProperty in arr[i])
                if (!properties.includes(objProperty))
                    delete arr[i][objProperty];
    }

    static tuneQueryString = (query: string, parent: any): string => {
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

    static getQueryArgs = (field: FieldDescription): Array<string> =>
        field.children.map((c: FieldDescription) => c.fieldName);

    static updateFieldTypeFilter = (field: FieldDescription, contextVar: any) =>
        contextVar[`${field.typeName}_properties`] = field.children.map((c: FieldDescription) => c.fieldName);
}