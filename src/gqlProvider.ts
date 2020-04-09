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
export type ResolveField = { name: string, args: Array<ResolveArg>, argsSelection: Array<ResolveArg> };
export type ResolveArg = { name: string, value: any, type: string };
export type ResolveFunction = (args: ResolveField) => any;

export class GqlProvider {
    readonly schema: any;
    private resolveFunctions: ResolverFunctionMap = { };
    private indent: string;

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

    executeFn = (ob: any): Array<any> => {
        this.indent = '';
        const args = this.parse(ob.selectionSet);
        const retArr = new Array<any>();
        for (let i = 0; i < args.length; i++) {
            const fieldName = args[i].name;
            const fn = this.resolveFunctions[fieldName];
            if (fn) {
                try {
                    retArr.push({name: fieldName, value: fn(args[i])});
                }
                catch (err) {
                    retArr.push({name: fieldName, value: `Error on \"${fieldName}\" resolver execution: ${err}`});
                }
            }
            else
                retArr.push({name: fieldName, value: `Error on \"${fieldName}\": resolve function is not defined`});
        }

        return retArr;
    }

    setResolveFunctions = (...arrArgs: Array<Field>) => {
        for (let i = 0; i < arrArgs.length; i++) {
            const field = arrArgs[i];
            this.resolveFunctions[field.name] = field.fn;
        }
    }

    // Currently recursive - interim
    private parse = (selectionSet: any): Array<ResolveField> => {
        const retArr = new Array<ResolveField>();
        if (!selectionSet)
            return retArr;

        //console.log('parse');
        this.indent += '\t';

        let selections = selectionSet.selections;
        for (let i = 0; i < selections.length; i++) {
            const selection = selections[i];
            const fieldName = selection.name.value;
            const args = this.parseInner(selection);

            const argsSelection = this.parse(selection.selectionSet);
            const selections1 = new Array<ResolveArg>();
            if (argsSelection.length > 0) {
                const names: Array<string> = argsSelection.map(ob => ob.name);
                for (let j = 0; j < argsSelection.length; j++)
                    selections1.push({ name: names[i], value: undefined, type: '' });
            }

            console.log(`fieldName = ${this.indent.length} ${this.indent}\"${fieldName}\"`);

            const resolveField: ResolveField = {
                name: fieldName,
                args: args,
                argsSelection: selections1
            };
            retArr.push(resolveField);
        }

        this.indent = this.indent.substr(1, this.indent.length - 1);
        return retArr;
    }

    private parseInner = (selection: any): Array<ResolveArg> => {
        const args = new Array<ResolveArg>();
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

            args.push(resolveArg);
        }

        return args;
    }
}