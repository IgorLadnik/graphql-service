const graphql = require('graphql');
const { GraphQLObjectType, GraphQLSchema, GraphQLID } = graphql;
import { DocumentNode, GraphQLError } from "graphql";
import _ from 'lodash';
import { ILogger } from "./logger";
import { ValidationRule } from "graphql/validation/ValidationContext";
import { User, ChatMessage, Chat, Role } from "./types";

export interface ResolveFieldsMap {
    [fieldName: string]: Field;
}

export interface TypesMap {
    [fieldName: string]: any;
}

export type Field = { fullFieldPath: string, resolveFunc: ResolveFunction };
export type ResolveFunction = (data: Data, args: any) => void;
export type Data = { typeObj: any, resultObj: any };
export type ActionDescription = { fieldName: string, arrPath: Array<string>, outputTypeName: string, isArray: boolean, args: any, children: Array<ActionDescription> };

export class GqlProvider {
    private static readonly pathDelim = '.';

    readonly schema: any;

    private resolveFields: ResolveFieldsMap = { };
    private data: Data;

    // for recursion
    private arrPath: Array<string>;
    private args: any;
    private field: Field;
    private readonly types: TypesMap = { };

    constructor(private logger: ILogger,
                private postProcessFn = (obj: any) => obj) {
        const config = new GraphQLObjectType({ name: 'Query' }).toConfig();
        config.fields['_'] = GqlProvider.createFreshDummyField();
        this.schema = new GraphQLSchema({ query: new GraphQLObjectType(config) });

        //TEMP hardcoded
        this.types['User'] = { type: 'User', id: 0, name: '', email: '', role: '' };
        this.types['ChatMessage'] = { type: 'ChatMessage', id: 0, content: '', time: '', author: this.types['User'] };
        this.types['Chat'] = { type: 'Chat', id: 0, participants: [this.types['User']], messages: [this.types['ChatMessage']] };
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

    validateFn = (schema: any, documentAST: DocumentNode, rules: ReadonlyArray<ValidationRule>) => true;

    formatErrorFn = (error: GraphQLError) => this.logger.log(`*** Error: ${error}`);

    executeFn = (obj: any): string => {
        this.logger.log('--------------------------------------------------');
        this.data = { typeObj: new Array<any>(), resultObj: new Array<any>() };

        try {
            this.parse(obj);
        }
        catch (err) {
            this.logger.log(`*** Error on executeFn: ${err}`);
        }

        let result = GqlProvider.createOutput(this.data.resultObj);

        try {
            result = this.postProcessFn(result);
        }
        catch (err) {
             this.logger.log(`Error in \"postProcessFn()\": ${err}`);
        }

        this.logger.log(GqlProvider.jsonStringifyFormatted(result));
        this.logger.log('--------------------------------------------------');
        return result;
    }

    // Recursive
    private parse = (upperSelection: any, prevPath: string = '') => {
        let selectionSet = upperSelection?.selectionSet;
        if (!selectionSet)
            return Array<any>();

        let selections = selectionSet.selections;

        for (let i = 0; i < selections.length; i++) {
            const selection = selections[i];
            const fieldName = selection.name.value;

            if (!GqlProvider.check({fieldName}))
                return;

            const fieldFullPath = GqlProvider.getFullFieldPath(prevPath, fieldName);
            this.args = GqlProvider.extractArguments(selection);
            this.field = this.resolveFields[fieldFullPath];

            this.logger.log(`parse => ${fieldFullPath}, args = ${this.args}`);

            try {
                if (_.isFunction(this.field?.resolveFunc) && prevPath.length == 0)
                    this.field.resolveFunc(this.data, this.args);
                else
                    this.generalResolveFunc(this.data, fieldFullPath);
            } catch (err) {
                this.logger.log(`*** Error on call of resolve function for field \"${fieldName}\". ${err}`);
                return;
            }

            this.parse(selection, fieldFullPath);
        }
    }

    generalResolveFunc = (data: Data, fieldFullPath: string) => {
        this.arrPath = fieldFullPath.split(GqlProvider.pathDelim);
        this.recursiveResolveFuncInner(data.typeObj, data.resultObj);
    }

    private recursiveResolveFuncInner = (typeObj: any, resultObj: any) => {
        const depth = this.arrPath.length - 1;
        const fieldName = this.arrPath[depth];

        let parent;
        for (let i = 0; i < resultObj.length; i++)
            parent = this.getParentDescription(resultObj[i]);

        if (!_.isNil(parent)) {
            const field = this.types[parent.outputTypeName][fieldName];
            if (!_.isNil(field)) {
                const isArray = _.isArray(field);
                const obj = isArray ? field[0] : field;
                const type = _.isNil(obj.type) ? typeof obj : obj.type;
                parent.children.push({
                    fieldName,
                    arrPath: this.arrPath,
                    outputTypeName: type,
                    isArray: isArray,
                    args: this.args,
                    children: new Array<ActionDescription>()
                });
            }
        }
    }

    private getParentDescription = (obj: any): any => {
        if (GqlProvider.isParent(obj, this.arrPath))
            return obj;
        else
            for (let i = 0; i < obj.children.length; i++) {
                const parent = this.getParentDescription(obj.children[i]);
                if (!_.isNil(parent))
                    return parent;
            }

        return null;
    }

    private static isParent(saved: any, current: Array<string>): boolean {
        if (saved.arrPath.length + 1 !== current.length)
            return false;

        for (let i = 0; i < saved.arrPath.length; i++)
            if (saved.arrPath[i].toLowerCase() !== current[i].toLowerCase())
                return false;

        return true;
    }

    private fillResultObj = (typeObj: any, resultObj: any, fieldName: string) => {
        if (_.isFunction(this.field?.resolveFunc))
            this.field.resolveFunc({ typeObj, resultObj }, this.args);
        else {
            if (_.isArray(typeObj[fieldName])) {
                resultObj[fieldName] = new Array<any>();
                this.logger.log(`   fillResultObj => ${fieldName}: create array, args = ${this.args}`);
                for (let i = 0; i < typeObj[fieldName].length; i++) {
                    resultObj[fieldName].push({});
                    this.logger.log(`   fillResultObj => ${fieldName}: push to array, args = ${this.args}`);
                }
            }
            else {
                if (_.isNil(typeObj[fieldName].id)) {
                    // simple
                    resultObj[fieldName] = typeObj[fieldName];
                    this.logger.log(`   fillResultObj => ${fieldName}: set value for simple object, args = ${this.args}`);
                }
                else {
                    // complex
                    resultObj[fieldName] = { };
                    this.logger.log(`   fillResultObj => ${fieldName}: create empty object for future use, args = ${this.args}`);
                }
            }
        }
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
            this.resolveFields[field.fullFieldPath] = field;
        }

        return this;
    }

    private static check = (checkData: any): boolean => {
        if (checkData.fieldName === '__schema')
            return false;

        return true;
    }

    private static jsonStringifyFormatted = (obj: any): string =>
        //JSON.stringify(jsObj, null, "\t"); // stringify with tabs inserted at each level
        //JSON.stringify(jsObj, null, 4);    // stringify with 4 spaces at each level
        JSON.stringify(obj, null, '\t')

    private static createOutput = (arr: Array<any>): any => {
        switch (arr.length) {
            case 0:  return 'Empty';
            case 1:  return arr[0];
            default: return arr;
        }
    }

    private static getFullFieldPath = (prevPath: string, fieldName: string): string => {
        const prefix = prevPath.length > 0 ? `${prevPath}${GqlProvider.pathDelim}` : '';
        let temp = `${prefix}${fieldName}`;
        return temp.substr(0, temp.length);
    }
}