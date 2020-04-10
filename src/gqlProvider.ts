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

        let depth = -1;
        let arrObj = new Array<any>();
        for (let i = 0; i < this.arrResolveField.length; i++) {
            depth++;
            let fields = _.filter(this.arrResolveField, rf => rf.depth === depth);
            for (let j = 0; j < fields.length; j++) {
                let field = fields[j];

                let resolveField = this.resolveFields[field.name];
                if (resolveField?.fn) {
                    // Resolve function is assigned
                    try {
                        arrObj.push({ depth, fieldName: field.name, result: resolveField.fn(field) });
                        arrObj = _.flatten(arrObj);
                    }
                    catch (err) {
                        console.log(`Error on calling resolve function for \"${field.name}\" field: ${err}`);
                    }
                }
                else {
                    // Resolve function is not assigned
                    const arr = _.filter(arrObj, ob =>ob.depth === depth - 1);
                    const parentFields = this.getParentType(field.parentName)?.getFields();

                    if (!parentFields) {
                        let o = 0;
                    }

                    for (let k = 0; k < arr?.length; k++) {
                        const objk = arrObj[k];
                        for (let x = 0; x < objk.result.length; x++) {
                            const objx = objk.result[x];
                            objx[`$_${field.name}`] = parentFields && parentFields[field.name].resolve
                                ? parentFields[field.name].resolve(objx)
                                : objx[field.name];
                            //let o = 0;
                        }
                    }
                 }
            }
        }

        return JSON.stringify(arrObj.map(o => o.result)); //TEMP
    }

    private getParentType = (fieldParentName: string) => {
        let resolveField = this.resolveFields[fieldParentName];
        if (!resolveField)
            return undefined;

        let typeName = resolveField.type.name;
        if (!typeName)
            typeName = resolveField.type.ofType.name;

        return _.filter(this.arrGqlObject, ob =>ob.name === typeName)[0];
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