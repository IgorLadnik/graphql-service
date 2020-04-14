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
export type ResolveFunction = (parent: any, args: any, depth: number, fieldFullPath: string) => void;

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
        this.parent = { a: new Array<any>(), c: new Array<any>() };

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
                if (_.isFunction(field?.fn))
                    field.fn(this.parent, args, this.currentDepth, fieldFullPath);
                else
                    GqlProvider.recursiveArrayHandling(this.parent.a, this.parent.c, fieldFullPath);
            } catch (err) {
                console.log(`Error on call of resolve function for field \"${fieldName}\". ${err}`);
                return;
            }

            this.parse(selection, fieldFullPath);
        }

        this.indent = this.indent.substr(1, this.indent.length - 1);
        this.currentDepth--;
    }

    static recursiveArrayHandlingInner = (ob0: any, ob1: any, arrPath: Array<string>, n: number, nmax: number) => {
        const fieldName = arrPath[n];

        if (fieldName === 'id' || fieldName === 'name')
            return;

        if (_.isArray(ob0)) {
            for (let i = 0; i < ob0.length; i++)
                GqlProvider.recursiveArrayHandlingInner(ob0[i], ob1[i], arrPath, n, nmax);
        }
        else {
            if (ob0[fieldName]) {
                if (n == nmax) {
                    // action
                    if (_.isArray(ob0[fieldName])) {
                        ob1[fieldName] = new Array<any>();
                        for (let i = 0; i < ob0[fieldName].length; i++) {
                            ob1[fieldName].push({ name: ob0[fieldName][i].name, id: ob0[fieldName][i].id });
                        }
                    }
                    else {
                        if (ob0[fieldName].name && ob0[fieldName].id)
                            // complex
                            ob1[fieldName] = { name: ob0[fieldName].name, id: ob0[fieldName].id };
                        else
                            // simple
                            ob1[fieldName] = ob0[fieldName]
                    }
                    return;
                }
                else
                    GqlProvider.recursiveArrayHandlingInner(ob0[fieldName], ob1[fieldName], arrPath, n + 1, nmax);
            }
            else
                GqlProvider.recursiveArrayHandlingInner(ob0, ob1, arrPath, n, nmax);
        }
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
        const outStr = this.parent.constructed.length > 0
            ? JSON.stringify(this.parent.constructed, null, '\t')
            : '???';

        console.log(outStr);
        return outStr;
    }

    static recursiveArrayHandling = (ob0: any, ob1: any, fieldFullPath: string) => {
        const arrPath = GqlProvider.splitFullFieldPath(fieldFullPath);
        GqlProvider.recursiveArrayHandlingInner(ob0, ob1, arrPath, 1, arrPath.length - 1);
    }

    static splitFullFieldPath = (fieldFullPath: string): Array<string> =>
        fieldFullPath.substr(1, fieldFullPath.length - 1).split('.');
}