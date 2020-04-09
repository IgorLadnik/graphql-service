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
import { User, Chat, ChatMessage, Role } from './schema';
import { users } from './app';

//export type ResolverFn = (parent: any, args: any, context: any, info: GraphQLResolveInfo) => any;

export interface ResolverFunctionMap {
    [fieldName: string]: ResolveFunction;
}

export type Field = { name: string, properties: any };
export type ResolveField = { name: string, args: Array<ResolveArg> };
export type ResolveArg = { name: string, value: any, type: string };
export type ResolveFunction = (args: ResolveField) => any;

export class GqlProvider {
    schema: any;
    config = new GraphQLObjectType({ name: 'Query' }).toConfig();
    resolveFunctions: ResolverFunctionMap = { };

    constructor() {
        this.addQueryFields(
            {
                name: 'me',
                properties: {
                    type: User,
                    resolve: (parent: any, args: any) => users[0]
                }
            });
    }

    private addQueryFields = (...arrArgs: Array<Field>): GqlProvider => {
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
        const args = GqlProvider.parse(ob.selectionSet);
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

    private static parse = (selectionSet: any): Array<ResolveField> => {
        const selections = selectionSet.selections;
        const retArr = new Array<ResolveField>();
        for (let i = 0; i < selections.length; i++) {
            const selection = selections[i];
            const fieldName = selection.name.value;
            const args = GqlProvider.parseInner(selection);
            const resolveField: ResolveField = {
                name: fieldName,
                args: args
            };
            retArr.push(resolveField);
        }

        return retArr;
    }

    private static parseInner = (selection: any): Array<ResolveArg> => {
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