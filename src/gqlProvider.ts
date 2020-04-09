const graphql = require('graphql');
const {
    GraphQLObjectType,
    GraphQLString,
    GraphQLSchema,
    GraphQLID,
} = graphql;
import _ from 'lodash';

export interface ResolverFunctionMap {
    [fieldName: string]: ResolveFunction;
}

export type Field = { name: string, fn: ResolveFunction };
export type ResolveField = { parentName: string, depth: number, name: string, args: Array<ResolveArg>, argsSelection: Array<ResolveField> };
export type ResolveArg = { name: string, value: any, type: string };
export type ResolveFunction = (args: ResolveField) => any;

export class GqlProvider {
    readonly schema: any;
    private resolveFunctions: ResolverFunctionMap = { };
    private indent: string;
    private currentDepth: number;
    private arrResolveField: Array<ResolveField>;

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
                username: { type: GraphQLString },
                email: { type: GraphQLString },
                role: { type: GraphQLString }
            })
        });
        return dummyField;
    }

    executeFn = (ob: any): string => {
        this.indent = '';
        this.currentDepth = -1;
        this.arrResolveField = new Array<ResolveField>();
        this.parse('', ob.selectionSet);
        const resolvedField = _.filter(this.arrResolveField, rf => rf.depth === 0)[0];
        return this.resolveFunctions[resolvedField.name](resolvedField);

        //const retArr = new Array<any>();
        // for (let i = 0; i < this.arrResolveField.length; i++) {
        //     const fieldName = this.arrResolveField[i].name;
        //     const fn = this.resolveFunctions[fieldName];
        //     if (fn) {
        //         try {
        //             retArr.push({name: fieldName, value: fn(this.arrResolveField[i])});
        //         }
        //         catch (err) {
        //             retArr.push({name: fieldName, value: `Error on \"${fieldName}\" resolver execution: ${err}`});
        //         }
        //     }
        //     else
        //         retArr.push({name: fieldName, value: `Error on \"${fieldName}\": resolve function is not defined`});
        // }
        //
        // return retArr;
    }

    setResolveFunctions = (...arrArgs: Array<Field>) => {
        for (let i = 0; i < arrArgs.length; i++) {
            const field = arrArgs[i];
            this.resolveFunctions[field.name] = field.fn;
        }
    }

    // Currently recursive - interim
    private parse = (parentName: string, selectionSet: any): Array<ResolveField> => {
        const retArr = new Array<ResolveField>();
        if (!selectionSet)
            return retArr;

        this.indent += '\t';
        this.currentDepth++;

        let selections = selectionSet.selections;
        for (let i = 0; i < selections.length; i++) {
            const selection = selections[i];
            const fieldName = selection.name.value;
            const args = this.parseInner(selection);
            const argsSelection = this.parse(fieldName, selection.selectionSet);

            console.log(`fieldName = ${this.currentDepth} ${this.indent}\"${fieldName}\"`);

            const resolveField: ResolveField = {
                parentName,
                depth: this.currentDepth,
                name: fieldName,
                args,
                argsSelection
            };

            retArr.push(resolveField);
            this.arrResolveField.push(resolveField);
        }

        this.indent = this.indent.substr(1, this.indent.length - 1);
        this.currentDepth--;
        return retArr;
    }

    private parseInner = (selection: any): Array<ResolveArg> => {
        const resolveArgs = new Array<ResolveArg>();
        for (let j = 0; j < selection.arguments.length; j++) {
            const argument = selection.arguments[j];
            let resolveArg: ResolveArg;
            switch (argument.value.kind) {
                case 'IntValue':
                    resolveArg = {
                        name: argument.name.value,
                        value: parseInt(argument.value.value),
                        type: 'number',
                    };
                    break;
                default:
                    resolveArg = {
                        name: argument.name.value,
                        value: argument.value.value,
                        type: 'string',
                    };
                    break;
            }

            resolveArgs.push(resolveArg);
        }

        return resolveArgs;
    }
}