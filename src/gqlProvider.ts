const graphql = require('graphql');
const { GraphQLObjectType, GraphQLSchema, GraphQLID } = graphql;
import _ from 'lodash';

export interface ResolveFieldsMap {
    [fieldName: string]: Field;
}

export type Field = { name: string, fn: ResolveFunction };
export type ResolveFunctionResult = { actual: Array<any>, constructed: Array<any>, description: string, error: string };
export type ResolveFunction = (parent: any, args: any, data: ResolveFunctionResult) => void;

export class GqlProvider {
    readonly schema: any;
    private resolveFields: ResolveFieldsMap = { };
    private indent: string;
    private currentDepth: number;
    private data: ResolveFunctionResult;

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
        this.data = { actual: new Array<any>(), constructed: new Array<any>(), description: '', error: '' };

        try {
            this.parse('', ob);
        }
        catch (err) {
            console.log(`Error on executeFn: ${err}`);
        }

        console.log(`\n////////////////////////////\n${this.data}\n////////////////////////////\n`);
        return this.createOutput();
    }

    // Recursive
    private parse = (parentName: string, ob: any, parent: any = undefined) => {
        let selectionSet = ob?.selectionSet;
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

            const args = GqlProvider.extractArguments(selection);
            const field = this.resolveFields[fieldName];

            let resultPrefix = `depth: ${this.currentDepth} fieldName:  ${this.indent}\"${fieldName}\" isResolveFunction: ${_.isFunction(field?.fn)}`;
            console.log(resultPrefix);

            if (_.isFunction(field?.fn)) {
                try {
                    //_.isFunction(field?.fn) ? field?.fn(parent, args, this.result) : parent[fieldName];
                    field.fn(parent, args, this.data);
                } catch (err) {
                    this.data.error = `Error on call of resolve function for field \"${fieldName}\". ${err}`;
                    console.log(this.data.error);
                    return;
                }
            }

            if (this.data.error === '')
                this.parse(fieldName, selection, field);
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
        const outStr = this.data.constructed.length > 0
            ? JSON.stringify(this.data.constructed, null, '\t')
            : '???';

            console.log(outStr);
            return outStr;
    }
}