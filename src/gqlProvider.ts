const graphql = require('graphql');
const { GraphQLObjectType, GraphQLSchema, GraphQLID } = graphql;
import _ from 'lodash';

export interface ResolveFieldsMap {
    [fieldName: string]: Field;
}

// export interface DataMap {
//     [parentdName: string]: Array<Data>;
// }

export type Field = { name: string, resolveFunc: ResolveFunction };
export type ResolveFunction = (data: Data, args: any, fieldFullPath: string) => void;
export type Data = { actualObj: any, creatingObj: any };

export class GqlProvider {
    readonly schema: any;

    private resolveFields: ResolveFieldsMap = { };
    private indent: string;
    private currentDepth: number;
    private data: Data;

    constructor() {
        const config = new GraphQLObjectType({ name: 'Query' }).toConfig();
        config.fields['_'] = GqlProvider.createFreshDummyField();
        this.schema = new GraphQLSchema({ query: new GraphQLObjectType(config) });
    }

    private static createFreshDummyField = () => {
        const dummyField = new GraphQLObjectType({name: '_', fields: {dummy: {}}}).toConfig().fields.dummy;
        dummyField.type = new GraphQLObjectType({
            name: '_',
            fields: () => ({
                id: { type: GraphQLID },
            })
        });
        return dummyField;
    }

    executeFn = (ob: any): string => {
        console.log('--------------------------------------------------');
        this.indent = '';
        this.currentDepth = -1;
        this.data = { actualObj: new Array<any>(), creatingObj: new Array<any>() };

        try {
            this.parse(ob, '');
        }
        catch (err) {
            console.log(`Error on executeFn: ${err}`);
        }

        console.log(`\n////////////////////////////\n${this.data}\n////////////////////////////\n`);
        return this.createOutput();
    }

    // Recursive
    private parse = (upperSelection: any, prevPath: string) => {
        let selectionSet = upperSelection?.selectionSet;
        if (!selectionSet)
            return Array<any>();

        this.indent += '\t';
        this.currentDepth++;

        let selections = selectionSet.selections;

        for (let i = 0; i < selections.length; i++) {
            const selection = selections[i];
            const fieldName = selection.name.value;

            if (!this.check({fieldName}))
                return;

            const fieldFullPath = `${prevPath}.${fieldName}`;
            const args = GqlProvider.extractArguments(selection);
            const field = this.resolveFields[fieldName];

            try {
                if (_.isFunction(field?.resolveFunc))
                    field.resolveFunc(this.data, args, fieldFullPath);
                else
                    GqlProvider.generalResolveFunc(this.data, fieldFullPath);
            } catch (err) {
                console.log(`Error on call of resolve function for field \"${fieldName}\". ${err}`);
                return;
            }

            this.parse(selection, fieldFullPath);
        }

        this.indent = this.indent.substr(1, this.indent.length - 1);
        this.currentDepth--;
    }

    static generalResolveFunc = (data: any, fieldFullPath: string) => {
        const arrPath = GqlProvider.splitFullFieldPath(fieldFullPath);
        GqlProvider.recursiveResolveFuncInner(data.actualObj, data.creatingObj, arrPath, 1, arrPath.length - 1);
    }

    private static recursiveResolveFuncInner = (actualObj: any, creatingObj: any, arrPath: Array<string>, n: number, nmax: number) => {
        const fieldName = arrPath[n];

        if (fieldName === 'id') //??
            return;

        if (_.isArray(actualObj))
            for (let i = 0; i < actualObj.length; i++)
                GqlProvider.recursiveResolveFuncInner(actualObj[i], creatingObj[i], arrPath, n, nmax);
        else
            if (actualObj[fieldName]) {
                if (n == nmax)
                    // action
                    GqlProvider.fillCreatingObj(actualObj, creatingObj, fieldName);
                else
                    GqlProvider.recursiveResolveFuncInner(actualObj[fieldName], creatingObj[fieldName], arrPath, n + 1, nmax);
            }
            else
                GqlProvider.recursiveResolveFuncInner(actualObj, creatingObj, arrPath, n, nmax);
    }

    private static fillCreatingObj = (actualObj: any, creatingObj: any, fieldName: string) => {
        if (_.isArray(actualObj[fieldName])) {
            creatingObj[fieldName] = new Array<any>();
            for (let i = 0; i < actualObj[fieldName].length; i++)
                creatingObj[fieldName].push({ name: actualObj[fieldName][i].name, id: actualObj[fieldName][i].id });
        }
        else
            creatingObj[fieldName] = _.isNil(actualObj[fieldName].name) || _.isNil(actualObj[fieldName].id)
                ? /* simple */  actualObj[fieldName]
                : /* complex */ { id: actualObj[fieldName].id };
    }

    private static extractArguments = (selection: any): any => {
        let resolveArgs: any;
        for (let i = 0; i < selection.arguments.length; i++) {
            if (i === 0)
                resolveArgs = { };
            const argument = selection.arguments[i];
            resolveArgs[argument.name.value] = parseInt(argument.value.value);
        }

        return resolveArgs;
    }

    setResolveFunctionsForFields = (...arrArgs: Array<Field>): GqlProvider => {
        for (let i = 0; i < arrArgs.length; i++) {
            const field = arrArgs[i];
            this.resolveFields[field.name] = field;
        }

        return this;
    }

    private check = (checkData: any): boolean => {
        if (checkData.fieldName === '__schema')
            return false;

        return true;
    }

    private createOutput = (): string => {
        //JSON.stringify(jsObj, null, "\t"); // stringify with tabs inserted at each level
        //JSON.stringify(jsObj, null, 4);    // stringify with 4 spaces at each level
        const outStr = this.data.creatingObj.length > 0
            ? JSON.stringify(this.data.creatingObj, null, '\t')
            : '???';

        console.log(outStr);
        return outStr;
    }

    static splitFullFieldPath = (fieldFullPath: string): Array<string> =>
        fieldFullPath.substr(1, fieldFullPath.length - 1).split('.');
}