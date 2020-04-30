import _ from 'lodash';
import { ILogger } from '../logger';
import { FieldDescription } from './gqlRequestHandler';
import { IGqlProvider } from "./gqlProvider";
import { Utils } from './utils';

export class GqlTypesCommon {
    static readonly suffixData = '_data';
    static readonly suffixPropsFilter = '_properties_filter';
    static readonly suffixArray = '_array';

    constructor(private gql: IGqlProvider, private logger: ILogger) { }

    resolveFunc = async (field: any, args: any, contextConst: any, contextVar: any,
                         queryFn: Function, currentLevel: number = 0): Promise<void> => {
        const level = field.arrPath.length - 1;
        if (level > 1 && currentLevel < level - 1) {
            const fieldName = field.arrPath[currentLevel];
            const parents = contextVar[`${fieldName}`][0][0][fieldName];
            for (let i = 0; i < parents.length; i++)
                await this.resolveFunc(field, args, contextConst, contextVar, queryFn, currentLevel + 1);
        }
        else {
            // Fetching data from storage on a level - access to database
            await queryFn(field, args, contextConst, contextVar, null);

            const fullFieldPath = Utils.composeFullFieldPath(field.arrPath);
            const type = this.gql.findRegisteredType(field.typeName);
            this.logger.log(`${contextVar[Utils.handlerIdPrefix]}common resolveFunc for ${fullFieldPath}`);

            const fieldName = level === 0 ? fullFieldPath : field.arrPath[level - 1];
            const arrParentsObj = contextVar[`${fieldName}`]?.[0];
            const levelFieldName = field.arrPath[level];
            const arrOuter = new Array<any>();

            // Levels loop
            let promisesLevel = new Array<Promise<void>>();
            const iMax = _.isNil(arrParentsObj) || arrParentsObj.length === 0 ? 1 : arrParentsObj.length;
            for (let i = 0; i < iMax; i++) {
                promisesLevel.push((async (): Promise<void> => {
                    const parentsObj = _.isNil(arrParentsObj) ? undefined : arrParentsObj[i];
                    let parents = _.isNil(parentsObj) ? undefined : parentsObj[fieldName];
                    const arr = new Array<any>();

                    // Properties loop
                    let promisesProp = new Array<Promise<void>>();
                    const jMax = _.isNil(parents) || parents.length === 0 ? 1 : parents.length;
                    for (let j = 0; j < jMax; j++) {
                        promisesProp.push((async (): Promise<void> => {
                            const parent: any = _.isNil(parents) ? { } : parents[j];

                            const items = await queryFn(field, args, contextConst, contextVar, parent);

                            parent[levelFieldName] = new Array<any>();
                            items.forEach((item: any) => {
                                const dataName = `${type.type}${GqlTypesCommon.suffixData}`;
                                contextVar[dataName] = item;

                                type.resolveFunc(field, args, contextConst, contextVar);

                                const updatedItem = contextVar[dataName];
                                delete contextVar[dataName];

                                if (field.isArray)
                                    parent[levelFieldName].push(updatedItem);
                                else
                                    parent[levelFieldName] = updatedItem;
                            });

                            contextVar[`${fieldName}${GqlTypesCommon.suffixArray}`]?.push(parent);

                            let obj: any = { };
                            obj[levelFieldName] = parent[levelFieldName];
                            arr.push(obj);
                        })());
                    }

                    await Promise.all(promisesProp);
                    arrOuter.push(arr);
                })());
            }

            await Promise.all(promisesLevel);
            contextVar[`${levelFieldName}`] = arrOuter;
        }
    }

    filter = (typeName: string, contextVar: any) => {
        const strData = `${typeName}${GqlTypesCommon.suffixData}`;
        const strProperties = `${typeName}${GqlTypesCommon.suffixPropsFilter}`;
        const inObj = contextVar[strData];
        if (_.isNil(inObj))
            return;

        const properties = contextVar[strProperties];
        const outObj = GqlTypesCommon.filterInner(inObj, properties);
        contextVar[strData] = outObj;
        this.logger.log(`${contextVar[Utils.handlerIdPrefix]}filter() for type ${typeName}`);
    }

    private static filterInner = (objOrg: any, properties: Array<string>): any => {
        if (_.isNil(properties))
            return objOrg;

        const objOut: any = { };
        properties.forEach((p: string) => objOut[p] = objOrg[p]);
        return objOut;
    }

    static setFilter = (fieldName: string, arrFilter: Array<string>, contextVar: any) => {
        contextVar[`${fieldName}${GqlTypesCommon.suffixPropsFilter}`] = arrFilter;
        contextVar[`${fieldName}${GqlTypesCommon.suffixArray}`] = new Array<any>();
    }

    static applyFilter = (fieldName: string, contextVar: any) => {
        const properties = contextVar[`${fieldName}${GqlTypesCommon.suffixPropsFilter}`];
        const arr = contextVar[`${fieldName}${GqlTypesCommon.suffixArray}`];
        if (properties?.length === 0 || _.isNil(arr) || arr.length === 0)
            return;

        for (let i = 0; i < arr.length; i++)
            for (let objProperty in arr[i])
                if (!properties.includes(objProperty))
                    delete arr[i][objProperty];
    }

    static getQueryArgs = (field: FieldDescription): Array<string> =>
        field.children.map((c: FieldDescription) => c.fieldName);

    static updateFieldTypeFilter = (field: FieldDescription, contextVar: any) =>
        contextVar[`${field.typeName}${GqlTypesCommon.suffixPropsFilter}`] =
            field.children.map((c: FieldDescription) => c.fieldName);
}
