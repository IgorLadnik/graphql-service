import {ChatMessage, User} from "./schema";

const graphql = require('graphql');
const {
    GraphQLObjectType,
    GraphQLString,
    GraphQLSchema,
    GraphQLID,
} = graphql;
import _ from 'lodash';

export interface ResolveFieldsMap {
    [fieldName: string]: Field;
}

export interface FieldToTypeMap {
    [fieldName: string]: any;
}

export type Field = { name: string, type: any, fn: ResolveFunction };
export type ResolveField = { parentName: string, depth: number, name: string, args: Array<ResolveArg>, argsSelection: Array<ResolveField> };
export type ResolveArg = { name: string, value: any, type: string };
export type ResolveFunction = (args: ResolveField) => any;

export class GqlProvider {
    readonly schema: any;
    private resolveFields: ResolveFieldsMap = { };
    private indent: string;
    private currentDepth: number;
    private arrResolveField: Array<ResolveField>;
    private arrGqlObject = new Array<any>();
    private fieldToTypeMap: FieldToTypeMap = { };

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

        let depth = 0;
        let arrFinal = new Array<any>();
        let count = 0;
        while (count < this.arrResolveField.length) {
            let fields = _.filter(this.arrResolveField, o => o.depth === depth);
            for (let i = 0; i < fields.length; i++) {
                count++;
                let field = fields[i];
                let resolveField = this.resolveFields[field.name];

                arrFinal.push({ depth, parentName: field.parentName, fieldName: field.name, result: resolveField?.fn(field) });

                if (field.parentName.length > 0) {
                    let parentType = this.getType(field.parentName);
                    let parentFields = parentType.getFields();
                    let fieldObj = parentFields[field.name];
                    arrFinal.push({ depth, parentName: field.parentName, fieldName: field.name,
                        result: fieldObj.resolve ? fieldObj.resolve(parentType) : fieldObj });
                }

                let t = 0;
            }

            depth++;
        }

        return JSON.stringify(arrFinal[0]);
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

    // Recursive
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
            const args = GqlProvider.parseInner(selection);

            // For future use ----
            let type = this.getType(fieldName);
            let fn = this.getResolveFunction(fieldName);
            //--------------------

            console.log(`fieldName = ${this.currentDepth} ${this.indent}\"${fieldName}\"`);

            const argsSelection = this.parse(fieldName, selection.selectionSet);

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

    private static parseInner = (selection: any): Array<ResolveArg> => {
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