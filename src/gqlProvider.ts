import {ChatMessage, User} from "./schema";

const graphql = require('graphql');
const {
    GraphQLObjectType,
    GraphQLString,
    GraphQLSchema,
    GraphQLID,
} = graphql;
import _ from 'lodash';
//import { OperationDefinitionNode } from 'graphql/language/ast'

export interface ResolveFieldsMap {
    [fieldName: string]: Field;
}

export interface FieldToTypeMap {
    [fieldName: string]: any;
}

export type Field = { name: string, type: any, fn: ResolveFunction };
//export type ResolveField = { parentName: string, depth: number, name: string, args: any, argsSelection: Array<ResolveField> };
//export type ResolveArg = { name: string, value: any, type: string };
export type ResolveFunction = (args: any) => any;

export class GqlProvider {
    readonly schema: any;
    private resolveFields: ResolveFieldsMap = { };
    private indent = '';
    private currentDepth = -1;
    //private arrResolveField: Array<ResolveField>;
    private arrGqlObject = new Array<any>();
    private fieldToTypeMap: FieldToTypeMap = { };
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
                username: { type: GraphQLString },
                email: { type: GraphQLString },
                role: { type: GraphQLString }
            })
        });
        return dummyField;
    }

    executeFn = (ob: any): string => {
        console.log('--------------------------------------------------');
        this.parse('', ob);
        return JSON.stringify(this.result);
    }

    // Recursive
    private parse = (parentName: string, ob: /*OperationDefinitionNode*/any) => {
        let selectionSet = ob?.selectionSet;
        if (!selectionSet)
            return Array<any>();

        this.indent += '\t';
        this.currentDepth++;

        let selections = selectionSet.selections;
        for (let i = 0; i < selections.length; i++) {
            const selection = selections[i];
            const fieldName = selection.name.value;
            const args = GqlProvider.parseInner(selection);

            // For future use ----
            let type = this.getType(fieldName);
            let fn = this.getResolveFunction(fieldName);
            //--------------------

            console.log(`depth: ${this.currentDepth} fieldName:  ${this.indent}\"${fieldName}\" isResolveFunction: ${_.isFunction(fn)}`);

            const result = _.isFunction(fn) ? fn(args) : undefined;

            if (result) {
                let arrResult = new Array<any>();

                if (_.isArray(result))
                    arrResult = result;
                else
                    arrResult.push(result);

                if (this.currentDepth === 0)
                    this.result = arrResult;
                else {

                }
            }

            this.parse(fieldName, selection);
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

    // Return either type object.
    // In case of list returns item's type object
    private getType = (fieldName: string) => {
        let resolveField = this.resolveFields[fieldName];
        if (!resolveField)
            return this.fieldToTypeMap[fieldName];

        let typeName = resolveField.type.name;
        if (!typeName)
            // In case of list
            typeName = resolveField.type.ofType.name;

        // Field name coincides with type name (regardless letter case)
        return _.filter(this.arrGqlObject, ob => ob.name.toLowerCase() === typeName.toLowerCase())[0];
    }

    setFieldToTypeMapping = (...arrArgs: Array<any>): GqlProvider => {
        for (let i = 0; i < arrArgs.length; i++) {
            const item = arrArgs[i];
            this.fieldToTypeMap[item.field] = item.type;
        }

        return this;
    }

    setResolveFunctionsForFields = (...arrArgs: Array<Field>): GqlProvider => {
        for (let i = 0; i < arrArgs.length; i++) {
            const field = arrArgs[i];
            this.resolveFields[field.name] = field;
        }

        return this;
    }

    setGqlObjects = (...arrArgs: Array<any>): GqlProvider => {
        for (let i = 0; i < arrArgs.length; i++) {
            const ob = arrArgs[i];
            if (ob.isTypeOf === GraphQLObjectType)
                this.arrGqlObject.push(ob);
        }

        return this;
    }

    private getResolveFunction = (fieldName: string): any => {
        //let type = this.getType(fieldName);
        //let fieldObj = type.getFields()[fieldName];
        const field = this.resolveFields[fieldName];
        if (field && field.fn)
            return field.fn;
        else {
            const type = this.getType(fieldName);
            if (type && type.resolve)
                return type.resolve;
        }

        return null;
    }

    private getGqlObject = (i: number): any =>
        this.arrGqlObject.length > i ? this.arrGqlObject[i] : null;
}