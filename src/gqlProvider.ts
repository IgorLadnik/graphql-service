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

    private getType = (fieldName: string) => {
        let resolveField = this.resolveFields[fieldName];
        if (!resolveField) {

            switch (fieldName) {
                case 'participants': return User;
                case 'author': return User;
                case 'messages': return ChatMessage;
            }

            return undefined;
        }

        let typeName = resolveField.type.name;
        if (!typeName)
            typeName = resolveField.type.ofType.name;

        return _.filter(this.arrGqlObject, ob => ob.name === typeName)[0];
    }

    setResolveFunctions = (...arrArgs: Array<Field>): GqlProvider => {
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

    getGqlObject = (i: number): any =>
        this.arrGqlObject.length > i ? this.arrGqlObject[i] : null;

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