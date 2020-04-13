const graphql = require('graphql');
const { GraphQLObjectType, GraphQLSchema, GraphQLID } = graphql;
import _ from 'lodash';

export interface ResolveFieldsMap {
    [fieldName: string]: Field;
}

export interface DataMap {
    [parentdName: string]: Array<any>;
}

export type Field = { name: string, fn: ResolveFunction };
//export type ResolveFunctionResult = { actual: Array<any>, constructed: Array<any>, description: string, error: string };
export type ResolveFunction = (parent: any, args: any, depth: number, fieldFullPath: string) => any;

export class GqlProvider {
    readonly schema: any;

    private resolveFields: ResolveFieldsMap = { };
    private indent: string;
    private currentDepth: number;
    //private data: ResolveFunctionResult;
    private parent: DataMap;

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
        //this.data = { actual: new Array<any>(), constructed: new Array<any>(), description: '', error: '' };
        this.parent = { };

        try {
            this.parse(ob, '');
        }
        catch (err) {
            console.log(`Error on executeFn: ${err}`);
        }

        console.log(`\n////////////////////////////\n${this.parent}\n////////////////////////////\n`);
        return this.createOutput();
    }

    // Recursive
    private parse = (upperSelection: any, prevPath: string) => {
        let selectionSet = upperSelection?.selectionSet;
        if (!selectionSet)
            return Array<any>();

        const parentName = upperSelection?.name?.value;
        let parent = parentName?.length > 0
            ? { a: this.parent[`@${parentName}`], c: this.parent[parentName] }
            : { a: new Array<any>(), c: new Array<any>() };

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

            if (_.isFunction(field?.fn)) {
                try {
                    const result = field.fn(parent, args, this.currentDepth, fieldFullPath);
                    this.updateThisParent(fieldName, result);
                } catch (err) {
                    console.log(`Error on call of resolve function for field \"${fieldName}\". ${err}`);
                    return;
                }
            }

            this.parse(selection, fieldFullPath);
        }

        this.indent = this.indent.substr(1, this.indent.length - 1);
        this.currentDepth--;
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

    updateThisParent = (fieldName: string, result: any) => {
        this.parent[`@${fieldName}`] = result.a;
        this.parent[fieldName] = result.c;
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
        const outStr = this.parent.constructed.length > 0
            ? JSON.stringify(this.parent.constructed, null, '\t')
            : '???';

        console.log(outStr);
        return outStr;
    }

    static recursiveArrayHandling = (arr0: Array<any>, arr1: Array<any>, fieldName: string) => {
        for (let i = 0; i < arr0.length; i++) {
            if (_.isArray(arr0[i]))
                GqlProvider.recursiveArrayHandling(arr0[i], arr1[i], fieldName);
            else
                arr1[i][fieldName] = arr0[i][fieldName];
        }
    }


    //TEMP
    static resolver1 = (fieldName: string, parent: any, args: any): any => {
        const result = { a: new Array<Array<any>>(), c: new Array<Array<any>>() };
        for (let i = 0; i < parent.c.length; i++) {
            const ax = parent.a[i][fieldName];
            result.a[i] = new Array<any>();
            result.c[i] = new Array<any>();
            for (let j = 0; j < ax.length; j++) {
                const t = ax[j];
                result.a[i].push(t);
                result.c[i].push({ name: t.name, id: t.id });
            }
        }
        return result;
    }
}