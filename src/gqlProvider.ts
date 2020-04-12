const graphql = require('graphql');
const { GraphQLObjectType, GraphQLSchema, GraphQLID } = graphql;
import _ from 'lodash';

export interface ResolveFieldsMap {
    [fieldName: string]: Field;
}

export type Field = { name: string, /*type: any,*/ isArray: boolean, fn: ResolveFunction };
export type ResolveFunction = (parent: any, args: any) => any;

export class GqlProvider {
    readonly schema: any;
    private resolveFields: ResolveFieldsMap = { };
    private indent: string;
    private currentDepth: number;
    private result: Array<any>;

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
        this.result = new Array<any>();

        try {
            this.parse('', ob);
        }
        catch (err) {
            console.log(`Error on executeFn: ${err}`);
        }

        return this.result ? JSON.stringify(this.result) : '???';
    }

    // Recursive
    private parse = (parentName: string, ob: any, parents: Array<any> = new Array<any>()) => {
        let selectionSet = ob?.selectionSet;
        if (!selectionSet)
            return Array<any>();

        this.indent += '\t';
        this.currentDepth++;

        let selections = selectionSet.selections;
        for (let i = 0; i < selections.length; i++) {
            const selection = selections[i];
            const fieldName = selection.name.value;

            if (fieldName === '__schema')
                return;

            const args = GqlProvider.parseInner(selection);

            const field = this.resolveFields[fieldName];

            console.log(`depth: ${this.currentDepth} fieldName:  ${this.indent}\"${fieldName}\" isResolveFunction: ${_.isFunction(field?.fn)}`);

            let currentParents = new Array<any>();
            const n = this.currentDepth === 0 ? 1 : parents.length;
            for (let j = 0; j < n; j++) {
                const parent = parents[j];
                let result;
                try {
                    result = _.isFunction(field?.fn) ? field?.fn(parent, args) : parent[fieldName];
                }
                catch (err) {
                    console.log(`Error on call of resolve function for field \"${fieldName}\". ${err}`);
                } 

                if (result) {
                    let lResult: any = result;
                    if (field?.isArray) {
                        lResult = new Array<any>();

                        if (_.isArray(result))
                            lResult = result;
                        else
                            lResult.push(result);
                    }

                    currentParents = lResult;
                    if (this.currentDepth === 0)
                        this.result = lResult;
                    else
                        parent[fieldName] = lResult;
                }
            }

            this.parse(fieldName, selection, currentParents);
        }

        this.indent = this.indent.substr(1, this.indent.length - 1);
        this.currentDepth--;
    }

    private static parseInner = (selection: any): any => {
        let resolveArgs: any = { };
        for (let i = 0; i < selection.arguments.length; i++) {
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
}