//import { /*parse, buildSchema,*/ GraphQLObjectType, GraphQLSchema, GraphQLResolveInfo, GraphQLOutputType } from 'graphql';
import _ from 'lodash';
import { GraphQLResolveInfo, GraphQLSchema } from 'graphql';
const graphql = require('graphql');
const {
    GraphQLObjectType,
    GraphQLString,
    //GraphQLSchema,
    GraphQLID,
    GraphQLInt,
    GraphQLList,
} = graphql;

//export type ResolverFn = (parent: any, args: any, context: any, info: GraphQLResolveInfo) => any;

export interface ResolverFunctionMap {
    [fieldName: string]: ResolveFunction;
}

export type Field = { name: string, properties: any };
export type ResolveArg = { name: string, value: any, type: string };
export type ResolveFunction = (args: Array<ResolveArg>) => any;

export class GqlProvider {
    schema: any;
    config = new GraphQLObjectType({ name: 'Query' }).toConfig();
    resolveFunctions: ResolverFunctionMap = { };

    addQueryFields = (...arrArgs: Array<Field>): GqlProvider => {
        for (let i = 0; i < arrArgs.length; i++) {
            let fieldDummy = GqlProvider.createFreshDummyField();
            let name = arrArgs[i].name;
            let properties = arrArgs[i].properties;
            let field = fieldDummy;
            field.type = properties.type;
            field.args = properties.args;
            field.resolve = properties.resolve;
            this.config.fields[name] = field;
        }

        this.schema = new GraphQLSchema({ query: new GraphQLObjectType(this.config) });
        return this;
    }

    private static createFreshDummyField = () =>
        new GraphQLObjectType({ name: '_', fields: { dummy: {} } }).toConfig().fields.dummy;

    executeFn = (ob: any): Array<any> => {
        const selections = ob.selectionSet.selections;
        const retArr = new Array<any>();
        for (let i = 0; i < selections.length; i++) {
            const selection = selections[i];
            const fieldName = selection.name.value;
            const args = GqlProvider.parse1(selection);
            try {
                retArr.push({name: fieldName, value: this.resolveFunctions[fieldName](args)});
            }
            catch (err) {
                retArr.push({name: fieldName, value: `Error on \"${fieldName}\" resolver execution: ${err}`});
            }
        }

        return retArr;
    }

    static parse1 = (selection: any): Array<ResolveArg> => {
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